const test = require('node:test');
const assert = require('node:assert/strict');
const { loadXml, htmlDoc } = require('./helpers');
const XP = require('../src/parse.js');
require('../src/views.js');

const bigData = (n) => ({
  columns: ['loc', 'lastmod'],
  rows: Array.from({ length: n }, (_, i) => [`https://example.com/p${i}`, i % 2 ? 'odd' : 'even']),
});
const rowsOf = (el) => el.querySelectorAll('tbody tr.row');
const click = (el) => el.dispatchEvent(new (el.ownerDocument.defaultView.Event)('click', { bubbles: true }));

test('table renders first pageSize rows and show-more reveals the rest', () => {
  const d = htmlDoc();
  const t = XP.renderTable(d, bigData(1200), { pageSize: 500 });
  assert.equal(rowsOf(t).length, 500);
  click(t.querySelector('button.xp-more'));
  assert.equal(rowsOf(t).length, 1000);
});

test('table search filters across all rows, not just rendered ones', () => {
  const d = htmlDoc();
  const t = XP.renderTable(d, bigData(1200), { pageSize: 10 });
  const input = t.querySelector('input[type=search]');
  input.value = 'P1199';
  input.dispatchEvent(new (d.defaultView.Event)('input', { bubbles: true }));
  assert.equal(rowsOf(t).length, 1);
  assert.match(t.querySelector('.xp-count').textContent, /1 of 1200/);
});

test('javascript: link is plain text, https link is an anchor with rel noopener noreferrer and target _blank', () => {
  const d = htmlDoc();
  const t = XP.renderTable(d, { columns: ['link'], rows: [['javascript:alert(1)'], ['https://a.com/x']] });
  const anchors = t.querySelectorAll('a');
  assert.equal(anchors.length, 1);
  assert.equal(anchors[0].getAttribute('href'), 'https://a.com/x');
  assert.equal(anchors[0].getAttribute('rel'), 'noopener noreferrer');
  assert.equal(anchors[0].getAttribute('target'), '_blank');
  assert.match(t.textContent, /javascript:alert\(1\)/);
});

test('hostile feed produces no script element and no javascript: href anywhere', () => {
  const d = htmlDoc();
  const data = XP.extractFeed(loadXml('hostile.xml'));
  const t = XP.renderTable(d, data);
  click(rowsOf(t)[0]);
  assert.equal(t.querySelectorAll('script').length, 0);
  assert.equal(t.querySelectorAll('img').length, 0);
  assert.equal(t.querySelectorAll('a[href^="javascript"]').length, 0);
  assert.match(t.textContent, /<script>alert\(1\)<\/script>/); // shown as text
});

test('blank cells for missing fields never contain "undefined"', () => {
  const d = htmlDoc();
  const t = XP.renderTable(d, XP.extractSitemap(loadXml('sitemap.xml')));
  assert.ok(!t.textContent.includes('undefined'));
});

test('long detail values are truncated with a show-more expand', () => {
  const d = htmlDoc();
  const long = 'x'.repeat(1000);
  const t = XP.renderTable(d, { columns: ['title'], rows: [['a']], details: [{ description: long }] });
  click(rowsOf(t)[0]);
  const detail = t.querySelector('tr.detail');
  assert.ok(detail.textContent.length < 600);
  click(detail.querySelector('button.xp-expand'));
  assert.ok(t.querySelector('tr.detail').textContent.includes(long));
});

test('tree renders nested elements, attributes and CDATA as text', () => {
  const d = htmlDoc();
  const tree = XP.renderTree(d, loadXml('generic.xml').documentElement);
  assert.match(tree.textContent, /config/);
  assert.match(tree.textContent, /env="prod"/);
  assert.match(tree.textContent, /<b>raw<\/b>/);
  assert.equal(tree.querySelectorAll('b').length, 0);
});

test('tree collapses elements deeper than 3 levels', () => {
  const d = htmlDoc();
  const xml = new (require('linkedom').DOMParser)().parseFromString('<a><b><c><d><e><f>x</f></e><g>y</g></d></c></b></a>', 'text/xml');
  const tree = XP.renderTree(d, xml.documentElement);
  const details = Array.from(tree.querySelectorAll('details'));
  assert.ok(details.some((x) => x.hasAttribute('open')));
  assert.ok(details.some((x) => !x.hasAttribute('open')));
});

test('raw view is a pre whose textContent equals the input', () => {
  const d = htmlDoc();
  const raw = XP.renderRaw(d, '<a>&amp;<b/></a>');
  assert.equal(raw.querySelector('pre').textContent, '<a>&amp;<b/></a>');
});

test('tree of a 50k-child file builds a bounded number of elements and show-more reveals more', () => {
  const d = htmlDoc();
  const xml = new (require('linkedom').DOMParser)().parseFromString(
    '<urlset>' + Array.from({ length: 50000 }, (_, i) => `<url><loc>u${i}</loc></url>`).join('') + '</urlset>', 'text/xml');
  const tree = XP.renderTree(d, xml.documentElement);
  const before = tree.querySelectorAll('*').length;
  assert.ok(before < 3000, `built ${before} elements`);
  click(tree.querySelector('button.xp-more'));
  assert.ok(tree.querySelectorAll('*').length > before);
});

test('tree builds collapsed nodes only when opened', () => {
  const d = htmlDoc();
  const xml = new (require('linkedom').DOMParser)().parseFromString('<a><b><c><d><e><f>x</f></e></d></c></b></a>', 'text/xml');
  const tree = XP.renderTree(d, xml.documentElement);
  const closed = Array.from(tree.querySelectorAll('details')).find((x) => !x.hasAttribute('open'));
  assert.equal(closed.children.length, 1); // only its summary
  closed.setAttribute('open', '');
  closed.dispatchEvent(new (d.defaultView.Event)('toggle'));
  assert.ok(closed.children.length > 1);
});
