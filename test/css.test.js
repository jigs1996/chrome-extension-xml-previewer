const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('every css selector is scoped to html.xp so ordinary pages are never styled', () => {
  const css = fs.readFileSync(path.join(__dirname, '../src/style.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const bad = [];
  for (const m of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    const sel = m[1].trim();
    if (sel.startsWith('@')) continue;
    for (const s of sel.split(',')) if (!s.trim().startsWith('html.xp')) bad.push(s.trim());
  }
  assert.deepEqual(bad, []);
});
