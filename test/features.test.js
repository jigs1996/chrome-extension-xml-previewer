const test = require('node:test');
const assert = require('node:assert/strict');
const { loadXml, htmlDoc } = require('./helpers');
const XP = require('../src/parse.js');
require('../src/views.js');

const NOW = Date.parse('2026-11-18T00:00:00Z');
const extras = () => XP.extractSitemap(loadXml('sitemap-extras.xml'));
const click = (el) => el.dispatchEvent(new (el.ownerDocument.defaultView.Event)('click', { bubbles: true }));

test('sitemap rows carry hreflang, image, video and news details', () => {
  const { details } = extras();
  assert.match(details[0].alternates, /de: https:\/\/example.com\/de\//);
  assert.match(details[0].alternates, /fr: /);
  assert.equal(details[0].images, 'https://example.com/a.jpg');
  assert.match(details[0].videos, /Intro/);
  assert.match(details[0].news, /Headline/);
  assert.equal(details[1], null);
});

test('analyzeSitemap flags duplicates, bad dates, priority, changefreq, hosts and non-http urls', () => {
  const a = XP.analyzeSitemap(extras(), { now: NOW });
  assert.deepEqual(a.flags[0], []);
  assert.ok(a.flags[1].includes('duplicate') && a.flags[1].includes('bad-lastmod') && a.flags[1].includes('bad-priority'));
  assert.ok(a.flags[2].includes('future-lastmod') && a.flags[2].includes('bad-changefreq'));
  assert.ok(a.flags[3].includes('invalid-url') && a.flags[3].includes('missing-lastmod'));
  const text = a.items.map((i) => i.text).join(' | ');
  assert.match(text, /4 URLs/);
  assert.match(text, /mixes http and https/);
});

test('analyzeSitemap warns when over the 50,000 URL limit', () => {
  const rows = Array.from({ length: 50001 }, (_, i) => [`https://e.com/${i}`, '2024-01-01', 'daily', '0.5']);
  const a = XP.analyzeSitemap({ columns: ['loc', 'lastmod', 'changefreq', 'priority'], rows });
  assert.ok(a.items.some((i) => i.warn && /50,000 limit/.test(i.text)));
});

test('a clean sitemap reports no issues; the fixture only lacks one lastmod', () => {
  const clean = { columns: ['loc', 'lastmod'], rows: [['https://e.com/', '2026-01-01']] };
  assert.ok(XP.analyzeSitemap(clean, { now: NOW }).items.every((i) => !i.warn));
  const a = XP.analyzeSitemap(XP.extractSitemap(loadXml('sitemap.xml')), { now: NOW });
  assert.deepEqual(a.items.filter((i) => i.warn).map((i) => i.text), ['1 missing lastmod']);
});

test('toCsv quotes cells and neutralises spreadsheet formulas; toJson keys by column', () => {
  const csv = XP.toCsv(['a', 'b'], [['x,y', '=SUM(A1)'], ['q"r', '-5'], ['-cmd', 'ok']]);
  assert.equal(csv, 'a,b\r\n"x,y",\'=SUM(A1)\r\n"q""r",-5\r\n\'-cmd,ok\r\n');
  assert.deepEqual(JSON.parse(XP.toJson(['a', 'b'], [['1', '2']])), [{ a: '1', b: '2' }]);
});

test('xpathOf numbers same-name siblings and uses local-name() for namespaced elements', () => {
  const doc = loadXml('sitemap-extras.xml');
  const urls = doc.getElementsByTagNameNS('*', 'url');
  assert.match(XP.xpathOf(urls[2]), /\[3\]$/);
  assert.match(XP.xpathOf(urls[2]), /local-name\(\)='urlset'/);
});

const tableWith = (data, opts) => XP.renderTable(htmlDoc(), data, opts);
const firstCol = (t) => Array.from(t.querySelectorAll('tbody tr.row td:nth-child(2)')).map((td) => td.textContent);

test('clicking a header sorts, clicking again reverses, empties stay last', () => {
  const t = tableWith({ columns: ['n'], rows: [['10'], [''], ['9'], ['100']] });
  const head = t.querySelectorAll('th button')[1];
  click(head);
  assert.deepEqual(firstCol(t), ['9', '10', '100', '']);
  click(head);
  assert.deepEqual(firstCol(t), ['100', '10', '9', '']);
});

test('issue filter narrows rows and export/copy use the filtered set', () => {
  const data = extras();
  data.analysis = XP.analyzeSitemap(data, { now: NOW });
  const t = tableWith(data);
  const sel = t.querySelector('select');
  Array.from(sel.options).find((o) => o.getAttribute('value') === 'duplicate').selected = true;
  sel.dispatchEvent(new (t.ownerDocument.defaultView.Event)('change', { bubbles: true }));
  assert.equal(t.querySelectorAll('tbody tr.row').length, 1);
  assert.match(t.querySelector('.xp-count').textContent, /1 of 4/);
});

test('rows with extras expand on click', () => {
  const t = tableWith(extras());
  click(t.querySelector('tbody tr.row'));
  assert.match(t.querySelector('tr.detail').textContent, /alternates/);
});

test('RSS: enclosure url shown, atom:link ignored, Atom link without rel is the item link', () => {
  const rss = new (require('linkedom').DOMParser)().parseFromString(
    '<rss xmlns:atom="http://www.w3.org/2005/Atom"><channel><item><title>T</title><atom:link href="https://self/"/><link>https://real/</link><enclosure url="https://e/a.mp3" length="1" type="audio/mpeg"/><constructor>c</constructor></item></channel></rss>', 'text/xml');
  const f = XP.extractFeed(rss);
  assert.equal(f.rows[0][1], 'https://real/');
  assert.equal(f.details[0].enclosure, 'https://e/a.mp3');
  assert.equal(f.details[0].constructor, 'c');
  const atom = new (require('linkedom').DOMParser)().parseFromString(
    '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>T</title><link rel="self" href="https://self/"/><link href="https://plain/"/></entry></feed>', 'text/xml');
  assert.equal(XP.extractFeed(atom).rows[0][1], 'https://plain/');
});
