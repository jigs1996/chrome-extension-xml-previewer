// Replaces a raw XML page with the preview UI. Does nothing for non-XML or malformed pages.
(function () {
  const XP = globalThis.XP;
  if (!XP) return;

  const XHTML = 'http://www.w3.org/1999/xhtml';
  const MAX_TEXT = 20 * 1024 * 1024;
  const serialize = (node) => new XMLSerializer().serializeToString(node);

  // Chrome shows XML three ways: as a real XML document, inside its built-in XML viewer
  // (source kept in #webkit-xml-viewer-source-xml), or as a plain-text <pre> (e.g. application/rss+xml).
  function load() {
    const ct = (document.contentType || '').toLowerCase();
    if (ct === 'image/svg+xml' || ct === 'application/xhtml+xml' || ct === 'text/html') return null;
    if (document.documentElement.localName !== 'html') {
      return XP.isPreviewable(document, ct) ? { doc: document, raw: serialize(document) } : null;
    }
    let raw = null;
    const viewer = document.getElementById('webkit-xml-viewer-source-xml');
    if (viewer && viewer.firstElementChild) {
      raw = serialize(viewer.firstElementChild);
    } else if (ct === 'text/plain' && document.body && document.body.children.length === 1) {
      const pre = document.body.firstElementChild;
      if (pre.localName === 'pre' && pre.textContent.length <= MAX_TEXT && /^\s*</.test(pre.textContent)) raw = pre.textContent;
    }
    if (raw === null) return null;
    const doc = new DOMParser().parseFromString(raw, 'application/xml');
    return XP.isPreviewable(doc, 'application/xml') ? { doc, raw } : null;
  }

  const loaded = load();
  if (!loaded) return;
  const { doc, raw } = loaded;
  const rootEl = doc.documentElement;
  const kind = XP.detectKind(doc);

  // Everything that reads the XML runs before the page is replaced.
  const tableData =
    kind === 'sitemap' || kind === 'sitemapindex' ? XP.extractSitemap(doc)
    : kind === 'rss' || kind === 'atom' ? XP.extractFeed(doc)
    : null;

  // Views build elements in the XHTML namespace so tables/buttons/details behave in an XML document.
  const d = {
    createElement: (t) => document.createElementNS(XHTML, t),
    createTextNode: (t) => document.createTextNode(t),
    defaultView: window,
  };
  const make = (tag, cls, txt) => {
    const e = d.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };

  const views = {
    table: () => XP.renderTable(d, tableData),
    tree: () => XP.renderTree(d, rootEl),
    raw: () => XP.renderRaw(d, raw),
  };
  const labels = { table: 'Table', tree: 'Tree', raw: 'Raw' };
  const order = tableData ? ['table', 'tree', 'raw'] : ['tree', 'raw'];

  let html;
  try {
    const kindLabel = { sitemap: 'Sitemap', sitemapindex: 'Sitemap index', rss: 'RSS', atom: 'Atom', generic: 'XML' }[kind];
    html = make('html', 'xp');
    const head = html.appendChild(make('head'));
    head.appendChild(make('title', null, `${kindLabel} · ${location.hostname || location.pathname}`));
    const meta = head.appendChild(make('meta'));
    meta.setAttribute('name', 'viewport');
    meta.setAttribute('content', 'width=device-width, initial-scale=1');
    const body = html.appendChild(make('body'));
    const app = body.appendChild(make('div'));
    app.id = 'xp-root';

    const bar = app.appendChild(make('header', 'xp-toolbar'));
    bar.appendChild(make('span', 'xp-badge', kindLabel));
    bar.appendChild(make('span', 'xp-url', location.href));
    const tabs = bar.appendChild(make('nav', 'xp-tabs'));
    const view = app.appendChild(make('main', 'xp-view'));

    const buttons = {};
    const built = {}; // keep each view once built: no rebuild cost, filter text survives tab switches
    const show = (name) => {
      view.textContent = '';
      view.appendChild(built[name] || (built[name] = views[name]()));
      for (const n of order) buttons[n].setAttribute('aria-pressed', String(n === name));
    };
    for (const name of order) {
      const b = tabs.appendChild(make('button', 'xp-btn', labels[name]));
      b.setAttribute('type', 'button');
      b.addEventListener('click', () => show(name));
      buttons[name] = b;
    }
    show(order[0]);
  } catch (e) {
    console.warn('XML Previewer: leaving page untouched', e);
    return;
  }
  document.replaceChild(html, document.documentElement);
})();
