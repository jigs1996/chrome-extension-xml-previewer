const test = require('node:test');
const assert = require('node:assert/strict');
const { loadXml } = require('./helpers');
const XP = require('../src/parse.js');
const { DOMParser } = require('linkedom');

test('detectKind identifies all five kinds', () => {
  assert.equal(XP.detectKind(loadXml('sitemap.xml')), 'sitemap');
  assert.equal(XP.detectKind(loadXml('sitemapindex.xml')), 'sitemapindex');
  assert.equal(XP.detectKind(loadXml('rss.xml')), 'rss');
  assert.equal(XP.detectKind(loadXml('atom.xml')), 'atom');
  assert.equal(XP.detectKind(loadXml('generic.xml')), 'generic');
});

test('extractSitemap returns 4 columns and blanks for missing lastmod', () => {
  const r = XP.extractSitemap(loadXml('sitemap.xml'));
  assert.deepEqual(r.columns, ['loc', 'lastmod', 'changefreq', 'priority']);
  assert.equal(r.rows.length, 3);
  assert.deepEqual(r.rows[2], ['https://example.com/no-lastmod', '', '', '']);
});

test('extractSitemap on sitemapindex returns loc,lastmod', () => {
  const r = XP.extractSitemap(loadXml('sitemapindex.xml'));
  assert.deepEqual(r.columns, ['loc', 'lastmod']);
  assert.deepEqual(r.rows[1], ['https://example.com/sitemap-2.xml', '']);
});

test('extractSitemap on empty urlset returns zero rows', () => {
  const doc = new DOMParser().parseFromString('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>', 'text/xml');
  assert.equal(XP.extractSitemap(doc).rows.length, 0);
});

test('extractFeed rss maps title/link/date/guid and details', () => {
  const r = XP.extractFeed(loadXml('rss.xml'));
  assert.deepEqual(r.columns, ['title', 'link', 'date', 'guid']);
  assert.deepEqual(r.rows[0], ['First', 'https://example.com/1', 'Tue, 17 Nov 2026 15:00:00 GMT', 'g1']);
  assert.deepEqual(r.rows[1], ['Second', 'https://example.com/2', '', '']);
  assert.equal(r.details[0].creator, 'Ann');
  assert.equal(r.details[0].description, 'Hello');
});

test('extractFeed atom picks rel=alternate link, falls back to first link, date from updated|published', () => {
  const r = XP.extractFeed(loadXml('atom.xml'));
  assert.deepEqual(r.rows[0], ['E1', 'https://example.com/alt', '2026-03-01T00:00:00Z', 'id1']);
  assert.deepEqual(r.rows[1], ['E2', 'https://example.com/only', '2026-04-01T00:00:00Z', 'id2']);
});

test('safeHref rejects javascript:, data:, vbscript:, relative, empty and accepts https', () => {
  for (const bad of ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,x', 'vbscript:x', '/rel', '', 'ftp://x.com'])
    assert.equal(XP.safeHref(bad), null, bad);
  assert.equal(XP.safeHref(' https://a.com/x '), 'https://a.com/x');
  assert.equal(XP.safeHref('http://a.com'), 'http://a.com');
});

test('isPreviewable rejects svg, xhtml, parsererror, html root', () => {
  const rss = loadXml('rss.xml');
  assert.equal(XP.isPreviewable(rss, 'text/xml'), true);
  assert.equal(XP.isPreviewable(rss, 'application/rss+xml'), true);
  assert.equal(XP.isPreviewable(rss, 'image/svg+xml'), false);
  assert.equal(XP.isPreviewable(rss, 'application/xhtml+xml'), false);
  assert.equal(XP.isPreviewable(rss, 'text/html'), false);
  const html = new DOMParser().parseFromString('<html><body/></html>', 'text/xml');
  assert.equal(XP.isPreviewable(html, 'text/xml'), false);
  // Chrome embeds a <parsererror> element when XML is malformed.
  const bad = new DOMParser().parseFromString('<a><parsererror>oops</parsererror></a>', 'text/xml');
  assert.equal(XP.isPreviewable(bad, 'text/xml'), false);
});

test('isPreviewable rejects svg/mathml/xhtml roots served as xml and (xml-stylesheet is verified in a real browser: linkedom drops PIs)', () => {
  const P = (s) => new DOMParser().parseFromString(s, 'text/xml');
  assert.equal(XP.isPreviewable(P('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'text/xml'), false);
  assert.equal(XP.isPreviewable(P('<math xmlns="http://www.w3.org/1998/Math/MathML"/>'), 'application/xml'), false);
  assert.equal(XP.isPreviewable(P('<div xmlns="http://www.w3.org/1999/xhtml"/>'), 'text/xml'), false);
  assert.equal(XP.isPreviewable(P('<a/>'), 'text/xml'), true);
});
