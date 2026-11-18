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

  XP.renderTable = function (d, data, opts) {
    const pageSize = (opts && opts.pageSize) || 500;
    const { columns, rows, details } = data;
    const haystack = rows.map((r) => r.join('\u0000').toLowerCase());
    let matches = rows.map((_, i) => i);
    let shown = pageSize;

    const wrap = h(d, 'div', 'xp-table');
    const bar = h(d, 'div', 'xp-tablebar');
    const search = h(d, 'input');
    search.setAttribute('type', 'search');
    search.setAttribute('placeholder', 'Filter…');
    const count = h(d, 'span', 'xp-count');
    bar.append(search, count, copyButton(d, () => rows.map((r) => r.join('\t')).join('\n'), 'Copy rows'));

    const table = h(d, 'table');
    const headRow = h(d, 'tr');
    headRow.appendChild(h(d, 'th', null, '#'));
    for (const c of columns) headRow.appendChild(h(d, 'th', null, c));
    table.appendChild(h(d, 'thead')).appendChild(headRow);
    const tbody = table.appendChild(h(d, 'tbody'));
    const more = h(d, 'button', 'xp-btn xp-more', 'Show more');
    more.setAttribute('type', 'button');

    function draw() {
      tbody.textContent = '';
      matches.slice(0, shown).forEach((idx) => {
        const tr = h(d, 'tr', 'row');
        tr.appendChild(h(d, 'td', 'xp-num', String(idx + 1)));
        for (const v of rows[idx]) tr.appendChild(h(d, 'td')).appendChild(cellContent(d, v));
        if (details && details[idx]) {
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
      count.textContent = `${matches.length} of ${rows.length}`;
      more.hidden = matches.length <= shown;
      if (more.hidden) more.setAttribute('hidden', '');
      else more.removeAttribute('hidden');
    }

    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      matches = [];
      for (let i = 0; i < rows.length; i++) if (!q || haystack[i].includes(q)) matches.push(i);
      shown = pageSize;
      draw();
    });
    more.addEventListener('click', () => {
      shown += pageSize;
      draw();
    });

    wrap.append(bar, table, more);
    draw();
    return wrap;
  };

  const CHUNK = 100; // children built per node at a time; keeps huge files responsive

  function treeNode(d, el, depth) {
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
      label(line);
      const t = kids.map((n) => n.nodeValue.trim()).join(' ');
      if (t) line.appendChild(h(d, 'span', 'xp-text', ' ' + t));
      return line;
    }
    const det = h(d, 'details');
    label(det.appendChild(h(d, 'summary')));

    let built = 0;
    let more = null;
    const fill = () => {
      if (more) more.remove();
      const end = Math.min(built + CHUNK, kids.length);
      for (; built < end; built++) {
        const k = kids[built];
        det.appendChild(k.nodeType === 1 ? treeNode(d, k, depth + 1) : h(d, 'div', 'xp-text', k.nodeValue.trim()));
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

  XP.renderTree = function (d, rootEl) {
    const wrap = h(d, 'div', 'xp-tree');
    const bar = h(d, 'div', 'xp-tablebar');
    const body = treeNode(d, rootEl, 1);
    const setAll = (open) => {
      for (const x of wrap.querySelectorAll('details')) {
        if (open) {
          x.setAttribute('open', '');
          x.dispatchEvent(new (d.defaultView.Event)('toggle'));
        } else x.removeAttribute('open');
      }
    };
    for (const [label, open] of [['Expand all', true], ['Collapse all', false]]) {
      const b = h(d, 'button', 'xp-btn', label);
      b.setAttribute('type', 'button');
      b.addEventListener('click', () => setAll(open));
      bar.appendChild(b);
    }
    wrap.append(bar, body);
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
