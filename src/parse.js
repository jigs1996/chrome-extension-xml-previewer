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
    const rows = all(doc, index ? 'sitemap' : 'url').map((el) => columns.map((c) => text(first(el, c))));
    return { columns, rows };
  };

  XP.extractFeed = function (doc) {
    const items = all(doc, ln(doc.documentElement) === 'feed' ? 'entry' : 'item');
    const columns = ['title', 'link', 'date', 'guid'];
    const rows = [];
    const details = [];
    for (const item of items) {
      const d = {};
      for (const c of item.children) {
        const k = ln(c);
        if (!(k in d)) d[k] = text(c) || c.getAttribute('href') || '';
      }
      const links = children(item, 'link');
      const alt = links.find((l) => l.getAttribute('rel') === 'alternate') || links[0];
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
