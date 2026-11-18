// DOM builders. Text only: never innerHTML. Depends on XP.safeHref (parse.js).
(function (root) {
  const XP = root.XP || (root.XP = {});
  const TRUNCATE = 300;

  function h(d, tag, cls, txt) {
    const el = d.createElement(tag);
    if (cls) el.className = cls;
    if (txt != null) el.textContent = txt;
    return el;
  }
  const ln = (el) => String(el.localName || '').split(':').pop();

  function cellContent(d, value) {
    const href = XP.safeHref(value);
    if (!href) return d.createTextNode(value);
    const a = h(d, 'a', null, value);
    a.setAttribute('href', href);
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
    return a;
  }

  function copyButton(d, getText, label) {
    const b = h(d, 'button', 'xp-btn', label || 'Copy');
    b.setAttribute('type', 'button');
    b.addEventListener('click', () => {
      const w = d.defaultView;
      if (w && w.navigator && w.navigator.clipboard) w.navigator.clipboard.writeText(getText());
    });
    return b;
  }

  function detailList(d, fields) {
    const dl = h(d, 'dl', 'xp-fields');
    for (const [k, v] of Object.entries(fields)) {
      dl.appendChild(h(d, 'dt', null, k));
      const dd = h(d, 'dd');
      const full = String(v);
      if (full.length <= TRUNCATE) {
        dd.appendChild(cellContent(d, full));
      } else {
        dd.appendChild(d.createTextNode(full.slice(0, TRUNCATE) + '…'));
        const more = h(d, 'button', 'xp-btn xp-expand', 'Show more');
        more.setAttribute('type', 'button');
        more.addEventListener('click', () => {
          dd.textContent = full;
        });
        dd.appendChild(more);
      }
      dl.appendChild(dd);
    }
    return dl;
  }

  // Saves text as a local file via a Blob URL; nothing leaves the browser.
  function download(d, name, mime, content) {
    const w = d.defaultView;
    const url = w.URL.createObjectURL(new w.Blob([content], { type: mime + ';charset=utf-8' }));
    const a = h(d, 'a');
    a.setAttribute('href', url);
    a.setAttribute('download', name);
    a.click();
    w.setTimeout(() => w.URL.revokeObjectURL(url), 1000);
  }

  function button(d, label, onClick) {
    const b = h(d, 'button', 'xp-btn', label);
    b.setAttribute('type', 'button');
    b.addEventListener('click', onClick);
    return b;
  }

  XP.renderTable = function (d, data, opts) {
    const pageSize = (opts && opts.pageSize) || 500;
    const filename = (opts && opts.filename) || 'xml-preview';
    const { columns, rows, details, analysis } = data;
    const flags = analysis ? analysis.flags : null;
    const haystack = rows.map((r) => r.join('\u0000').toLowerCase());
    let matches = rows.map((_, i) => i);
    let shown = pageSize;
    let sortCol = -1;
    let sortDir = 1;

    const wrap = h(d, 'div', 'xp-table');
    if (analysis) {
      const sum = wrap.appendChild(h(d, 'div', 'xp-summary'));
      for (const it of analysis.items) sum.appendChild(h(d, 'span', it.warn ? 'xp-chip xp-warn' : 'xp-chip', it.text));
    }
    const bar = h(d, 'div', 'xp-tablebar');
    const search = h(d, 'input');
    search.setAttribute('type', 'search');
    search.setAttribute('placeholder', 'Filter…');
    bar.appendChild(search);
    let issue = null;
    if (analysis && Object.keys(analysis.counts).length) {
      issue = bar.appendChild(h(d, 'select'));
      issue.setAttribute('aria-label', 'Show only rows with an issue');
      issue.appendChild(h(d, 'option', null, 'All rows')).setAttribute('value', '');
      for (const k of Object.keys(XP.FLAG_LABELS)) {
        if (!analysis.counts[k]) continue;
        issue.appendChild(h(d, 'option', null, `${XP.FLAG_LABELS[k]} (${analysis.counts[k]})`)).setAttribute('value', k);
      }
    }
    const count = bar.appendChild(h(d, 'span', 'xp-count'));
    const picked = () => matches.map((i) => rows[i]);
    bar.append(
      copyButton(d, () => picked().map((r) => r.join('\t')).join('\n'), 'Copy rows'),
      button(d, 'CSV', () => download(d, filename + '.csv', 'text/csv', XP.toCsv(columns, picked()))),
      button(d, 'JSON', () => download(d, filename + '.json', 'application/json', XP.toJson(columns, picked())))
    );

    const table = h(d, 'table');
    const headRow = h(d, 'tr');
    const heads = [];
    ['#'].concat(columns).forEach((c, i) => {
      const th = headRow.appendChild(h(d, 'th'));
      th.appendChild(button(d, c, () => {
        if (i === 0) sortCol = -1;
        else if (sortCol === i - 1) sortDir = -sortDir;
        else { sortCol = i - 1; sortDir = 1; }
        refilter();
      })).className = 'xp-sort';
      heads.push(th);
    });
    table.appendChild(h(d, 'thead')).appendChild(headRow);
    const tbody = table.appendChild(h(d, 'tbody'));
    const more = h(d, 'button', 'xp-btn xp-more', 'Show more');
    more.setAttribute('type', 'button');

    function draw() {
      tbody.textContent = '';
      matches.slice(0, shown).forEach((idx) => {
        const hasDetail = !!(details && details[idx]);
        const tr = h(d, 'tr', hasDetail ? 'row xp-click' : 'row');
        if (flags && flags[idx].length) {
          tr.setAttribute('title', flags[idx].map((k) => XP.FLAG_LABELS[k]).join(', '));
          tr.className += ' xp-flagged';
        }
        tr.appendChild(h(d, 'td', 'xp-num', String(idx + 1)));
        for (const v of rows[idx]) tr.appendChild(h(d, 'td')).appendChild(cellContent(d, v));
        if (hasDetail) {
          tr.addEventListener('click', (e) => {
            if (e.target && e.target.localName === 'a') return;
            const next = tr.nextSibling;
            if (next && next.className === 'detail') return next.remove();
            const dr = h(d, 'tr', 'detail');
            const td = dr.appendChild(h(d, 'td'));
            td.setAttribute('colspan', String(columns.length + 1));
            td.appendChild(detailList(d, details[idx]));
            tr.after(dr);
          });
        }
        tbody.appendChild(tr);
      });
      heads.forEach((th, i) => {
        if (i - 1 === sortCol) th.setAttribute('aria-sort', sortDir > 0 ? 'ascending' : 'descending');
        else th.removeAttribute('aria-sort');
      });
      count.textContent = `${matches.length} of ${rows.length}`;
      more.hidden = matches.length <= shown;
      if (more.hidden) more.setAttribute('hidden', '');
      else more.removeAttribute('hidden');
    }

    // Empty cells always sort last; numbers compare numerically, everything else as text.
    function compare(x, y) {
      const a = rows[x][sortCol];
      const b = rows[y][sortCol];
      if (a === b) return 0;
      if (!a) return 1;
      if (!b) return -1;
      const na = Number(a);
      const nb = Number(b);
      const r = Number.isFinite(na) && Number.isFinite(nb) ? na - nb : a < b ? -1 : 1;
      return r * sortDir;
    }

    function refilter() {
      const q = search.value.trim().toLowerCase();
      const f = issue ? issue.value : '';
      matches = [];
      for (let i = 0; i < rows.length; i++) {
        if ((!q || haystack[i].includes(q)) && (!f || flags[i].includes(f))) matches.push(i);
      }
      if (sortCol >= 0) matches.sort(compare);
      shown = pageSize;
      draw();
    }

    search.addEventListener('input', refilter);
    if (issue) issue.addEventListener('change', refilter);
    more.addEventListener('click', () => {
      shown += pageSize;
      draw();
    });

    wrap.append(bar, table, more);
    draw();
    return wrap;
  };

  const CHUNK = 100; // children built per node at a time; keeps huge files responsive

  function treeNode(d, el, depth, map) {
    const attrs = Array.from(el.attributes || []);
    const label = (parent) => {
      parent.appendChild(h(d, 'span', 'xp-tag', ln(el)));
      for (const a of attrs) {
        parent.appendChild(h(d, 'span', 'xp-attr', ` ${a.name}="${a.value}"`));
      }
    };
    const kids = Array.from(el.childNodes).filter(
      (n) => n.nodeType === 1 || ((n.nodeType === 3 || n.nodeType === 4) && n.nodeValue.trim())
    );
    if (!kids.some((n) => n.nodeType === 1)) {
      const line = h(d, 'div', 'xp-leaf');
      map.set(line, el);
      label(line);
      const t = kids.map((n) => n.nodeValue.trim()).join(' ');
      if (t) line.appendChild(h(d, 'span', 'xp-text', ' ' + t));
      return line;
    }
    const det = h(d, 'details');
    map.set(det, el);
    label(det.appendChild(h(d, 'summary')));

    let built = 0;
    let more = null;
    const fill = () => {
      if (more) more.remove();
      const end = Math.min(built + CHUNK, kids.length);
      for (; built < end; built++) {
        const k = kids[built];
        det.appendChild(k.nodeType === 1 ? treeNode(d, k, depth + 1, map) : h(d, 'div', 'xp-text', k.nodeValue.trim()));
      }
      if (built < kids.length) {
        more = h(d, 'button', 'xp-btn xp-more', `Show ${Math.min(CHUNK, kids.length - built)} more (${kids.length - built} left)`);
        more.setAttribute('type', 'button');
        more.addEventListener('click', fill);
        det.appendChild(more);
      }
    };

    if (depth <= 3) {
      det.setAttribute('open', '');
      fill();
    } else {
      // Collapsed nodes build their children the first time they are opened.
      const onToggle = () => {
        if (!det.hasAttribute('open')) return;
        det.removeEventListener('toggle', onToggle);
        fill();
      };
      det.addEventListener('toggle', onToggle);
    }
    return det;
  }

  const MAX_RESULTS = 200;

  // Runs an XPath against the document and lists what it finds, as text only.
  function runXPath(d, rootEl, expr, out) {
    out.textContent = '';
    if (!expr) return;
    const lines = [];
    let note = '';
    try {
      const doc = rootEl.ownerDocument;
      const r = doc.evaluate(expr, doc, doc.createNSResolver(rootEl), 0, null);
      if (r.resultType === 1) lines.push(String(r.numberValue));
      else if (r.resultType === 2) lines.push(r.stringValue);
      else if (r.resultType === 3) lines.push(String(r.booleanValue));
      else {
        for (let n = r.iterateNext(); n; n = r.iterateNext()) {
          if (lines.length === MAX_RESULTS) { note = ` (showing first ${MAX_RESULTS})`; break; }
          if (n.nodeType === 1) lines.push(`${XP.xpathOf(n)}  →  ${(n.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120)}`);
          else if (n.nodeType === 2) lines.push(`${n.name}="${n.value}"`);
          else lines.push(String(n.nodeValue));
        }
      }
    } catch (e) {
      out.appendChild(h(d, 'div', 'xp-warn', 'Invalid XPath: ' + (e && e.message ? e.message : e)));
      return;
    }
    if (!lines.length) {
      out.appendChild(h(d, 'div', 'xp-muted', "No match. If the file has a default namespace, use //*[local-name()='name']."));
      return;
    }
    out.appendChild(h(d, 'div', 'xp-muted', `${lines.length} result${lines.length === 1 ? '' : 's'}${note}`));
    out.appendChild(copyButton(d, () => lines.join('\n'), 'Copy results'));
    for (const l of lines) out.appendChild(h(d, 'div', 'xp-result', l));
  }

  XP.renderTree = function (d, rootEl) {
    const wrap = h(d, 'div', 'xp-tree');
    const bar = h(d, 'div', 'xp-tablebar');
    const map = new WeakMap(); // rendered node -> source element, for XPath lookup
    const body = treeNode(d, rootEl, 1, map);
    const setAll = (open) => {
      for (const x of wrap.querySelectorAll('details')) {
        if (open) {
          x.setAttribute('open', '');
          x.dispatchEvent(new (d.defaultView.Event)('toggle'));
        } else x.removeAttribute('open');
      }
    };
    for (const [label, open] of [['Expand all', true], ['Collapse all', false]]) {
      bar.appendChild(button(d, label, () => setAll(open)));
    }
    const out = h(d, 'div', 'xp-xpath-out');
    const query = bar.appendChild(h(d, 'input'));
    query.setAttribute('type', 'search');
    query.setAttribute('placeholder', 'XPath, e.g. //item/title (Enter)');
    query.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runXPath(d, rootEl, query.value.trim(), out);
    });

    // The last hovered or clicked node's XPath stays put so the Copy button can reach it.
    let current = '';
    const pathBar = h(d, 'div', 'xp-tablebar');
    const pathText = h(d, 'code', 'xp-path', 'Hover or click a node to see its XPath');
    pathBar.append(pathText, copyButton(d, () => current, 'Copy XPath'));
    const track = (e) => {
      const t = e.target && e.target.closest ? e.target.closest('details, .xp-leaf') : null;
      const src = t && map.get(t);
      if (src) {
        current = XP.xpathOf(src);
        pathText.textContent = current;
      }
    };
    body.addEventListener('mouseover', track);
    body.addEventListener('click', track);

    wrap.append(bar, pathBar, out, body);
    return wrap;
  };

  XP.renderRaw = function (d, xmlText) {
    const wrap = h(d, 'div', 'xp-raw');
    const bar = h(d, 'div', 'xp-tablebar');
    bar.appendChild(copyButton(d, () => xmlText, 'Copy XML'));
    wrap.append(bar, h(d, 'pre', null, xmlText));
    return wrap;
  };

  if (typeof module !== 'undefined') module.exports = XP;
})(typeof globalThis !== 'undefined' ? globalThis : this);
