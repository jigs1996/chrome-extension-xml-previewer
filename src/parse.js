// Pure extraction helpers. Shared as a global `XP` in the browser, module.exports in Node tests.
(function (root) {
  const XP = root.XP || {};

  const text = (el) => (el ? (el.textContent || '').trim() : '');

  // Local name without any namespace prefix (some DOM implementations keep it in localName).
  const ln = (el) => String(el.localName || '').split(':').pop();

  // Direct child elements by local name (ignores namespace prefixes).
  function children(el, name) {
    return Array.from(el.children || []).filter((c) => ln(c) === name);
  }
  const first = (el, name) => children(el, name)[0] || null;
  const all = (doc, name) => Array.from(doc.getElementsByTagNameNS('*', name));

  XP.detectKind = function (doc) {
    switch (doc.documentElement && ln(doc.documentElement)) {
      case 'urlset': return 'sitemap';
      case 'sitemapindex': return 'sitemapindex';
      case 'rss': return 'rss';
      case 'feed': return 'atom';
      default: return 'generic';
    }
  };

  XP.extractSitemap = function (doc) {
    const index = XP.detectKind(doc) === 'sitemapindex';
    const columns = index ? ['loc', 'lastmod'] : ['loc', 'lastmod', 'changefreq', 'priority'];
    const els = all(doc, index ? 'sitemap' : 'url');
    const rows = els.map((el) => columns.map((c) => text(first(el, c))));
    // Hreflang alternates, image, video and news entries show when a row is expanded.
    const details = index ? null : els.map(sitemapExtras);
    return { columns, rows, details };
  };

  function sitemapExtras(el) {
    const f = Object.create(null);
    const alts = children(el, 'link').filter((l) => l.getAttribute('hreflang'));
    if (alts.length) f.alternates = alts.map((l) => `${l.getAttribute('hreflang')}: ${l.getAttribute('href') || ''}`).join('\n');
    const imgs = children(el, 'image').map((i) => text(first(i, 'loc'))).filter(Boolean);
    if (imgs.length) f.images = imgs.join('\n');
    const vids = children(el, 'video')
      .map((v) => [text(first(v, 'title')), text(first(v, 'content_loc')) || text(first(v, 'player_loc'))].filter(Boolean).join(' · '))
      .filter(Boolean);
    if (vids.length) f.videos = vids.join('\n');
    const news = first(el, 'news');
    if (news) {
      const n = [text(first(news, 'title')), text(first(news, 'publication_date'))].filter(Boolean).join(' · ');
      if (n) f.news = n;
    }
    return Object.keys(f).length ? f : null;
  }

  const SITEMAP_LIMIT = 50000;
  const FREQ = new Set(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']);
  const W3C_DATE = /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?)?)?$/;
  XP.FLAG_LABELS = {
    duplicate: 'duplicate URLs',
    'invalid-url': 'non-http(s) URLs',
    'missing-lastmod': 'missing lastmod',
    'bad-lastmod': 'invalid lastmod',
    'future-lastmod': 'lastmod in the future',
    'bad-priority': 'priority outside 0-1',
    'bad-changefreq': 'invalid changefreq',
  };

  // Local checks on extracted sitemap rows: per-row flags plus summary chips. No network.
  XP.analyzeSitemap = function (data, opts) {
    const now = (opts && opts.now) || Date.now();
    const index = data.columns.length === 2;
    const flags = [];
    const counts = {};
    const seen = new Set();
    const hosts = new Set();
    const protocols = new Set();
    data.rows.forEach((r, i) => {
      const f = (flags[i] = []);
      const add = (k) => { f.push(k); counts[k] = (counts[k] || 0) + 1; };
      const [loc, lastmod, changefreq, priority] = r;
      if (seen.has(loc)) add('duplicate'); else seen.add(loc);
      if (XP.safeHref(loc)) {
        const u = new URL(loc);
        hosts.add(u.host);
        protocols.add(u.protocol);
      } else add('invalid-url');
      if (!lastmod) add('missing-lastmod');
      else if (!W3C_DATE.test(lastmod) || Number.isNaN(Date.parse(lastmod))) add('bad-lastmod');
      else if (Date.parse(lastmod) > now + 864e5) add('future-lastmod');
      if (!index) {
        if (priority && !(Number.isFinite(Number(priority)) && Number(priority) >= 0 && Number(priority) <= 1)) add('bad-priority');
        if (changefreq && !FREQ.has(changefreq.toLowerCase())) add('bad-changefreq');
      }
    });
    const n = data.rows.length;
    const noun = index ? 'sitemaps' : 'URLs';
    const items = [{ text: `${n.toLocaleString('en-US')} ${noun}`, warn: false }];
    if (n > SITEMAP_LIMIT) items.push({ text: `over the ${SITEMAP_LIMIT.toLocaleString('en-US')} limit`, warn: true });
    if (hosts.size > 1) items.push({ text: `${hosts.size} hosts: ${Array.from(hosts).slice(0, 3).join(', ')}${hosts.size > 3 ? '…' : ''}`, warn: true });
    if (protocols.size > 1) items.push({ text: 'mixes http and https', warn: true });
    for (const k of Object.keys(XP.FLAG_LABELS)) if (counts[k]) items.push({ text: `${counts[k]} ${XP.FLAG_LABELS[k]}`, warn: true });
    if (items.length === 1) items.push({ text: 'no issues found', warn: false });
    return { flags, counts, items };
  };

  // Cells starting with = + @ (or - not followed by a digit) would run as formulas in Excel/Sheets.
  function csvCell(v) {
    let s = String(v);
    if (/^[=+@\t\r]|^-(?![\d.])/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  XP.toCsv = (columns, rows) => [columns].concat(rows).map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  XP.toJson = (columns, rows) =>
    JSON.stringify(rows.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i]]))), null, 2);

  // Namespaced elements use *[local-name()='x'] so the path evaluates in any document.
  XP.xpathOf = function (el) {
    const parts = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentNode) {
      const name = ln(n);
      const same = n.parentNode && n.parentNode.children
        ? Array.from(n.parentNode.children).filter((s) => ln(s) === name && s.namespaceURI === n.namespaceURI)
        : [n];
      const seg = n.namespaceURI ? `*[local-name()='${name}']` : name;
      parts.push(same.length > 1 ? `${seg}[${same.indexOf(n) + 1}]` : seg);
    }
    return '/' + parts.reverse().join('/');
  };

  XP.extractFeed = function (doc) {
    const items = all(doc, ln(doc.documentElement) === 'feed' ? 'entry' : 'item');
    const columns = ['title', 'link', 'date', 'guid'];
    const rows = [];
    const details = [];
    for (const item of items) {
      const d = Object.create(null);
      for (const c of item.children) {
        const k = ln(c);
        // <atom:link> inside an RSS item is not the item's own <link>.
        if (k === 'link' && ln(item) === 'item' && String(c.tagName).includes(':')) continue;
        if (!(k in d)) d[k] = text(c) || c.getAttribute('href') || c.getAttribute('url') || '';
      }
      const links = children(item, 'link').filter((l) => !(ln(item) === 'item' && String(l.tagName).includes(':')));
      const alt = links.find((l) => l.getAttribute('rel') === 'alternate' || !l.hasAttribute('rel')) || links[0];
      const link = alt ? (alt.getAttribute('href') || text(alt)) : '';
      const date = text(first(item, 'pubDate')) || text(first(item, 'updated')) || text(first(item, 'published'));
      const guid = text(first(item, 'guid')) || text(first(item, 'id'));
      rows.push([text(first(item, 'title')), link, date, guid]);
      details.push(d);
    }
    return { columns, rows, details };
  };

  XP.safeHref = function (value) {
    const v = String(value == null ? '' : value).trim();
    if (!v) return null;
    try {
      const u = new URL(v);
      return u.protocol === 'http:' || u.protocol === 'https:' ? v : null;
    } catch (e) {
      return null;
    }
  };

  XP.isPreviewable = function (doc, contentType) {
    const ct = String(contentType || '').toLowerCase().split(';')[0].trim();
    if (ct === 'image/svg+xml' || ct === 'application/xhtml+xml') return false;
    if (!(ct === 'text/xml' || ct === 'application/xml' || ct.endsWith('+xml'))) return false;
    const rootEl = doc.documentElement;
    if (!rootEl) return false;
    const name = ln(rootEl);
    if (name === 'html' || name === 'parsererror') return false;
    // Roots that browsers render natively, and author-styled documents, are left alone.
    const tag = String(rootEl.tagName || '');
    const ns = rootEl.getAttribute(tag.includes(':') ? 'xmlns:' + tag.split(':')[0] : 'xmlns') || '';
    if (ns === 'http://www.w3.org/1999/xhtml' || ns === 'http://www.w3.org/2000/svg' || ns === 'http://www.w3.org/1998/Math/MathML') return false;
    for (const n of Array.from(doc.childNodes || [])) {
      if (n.nodeType === 7 && n.target === 'xml-stylesheet') return false;
    }
    if (doc.getElementsByTagNameNS('*', 'parsererror').length) return false;
    return true;
  };

  root.XP = XP;
  if (typeof module !== 'undefined') module.exports = XP;
})(typeof globalThis !== 'undefined' ? globalThis : this);
