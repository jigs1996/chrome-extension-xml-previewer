const fs = require('node:fs');
const path = require('node:path');
const { DOMParser, parseHTML } = require('linkedom');

function loadXml(name) {
  const text = fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
  return new DOMParser().parseFromString(text, 'text/xml');
}
// A fresh HTML document to build views with.
function htmlDoc() {
  return parseHTML('<!doctype html><html><body></body></html>').document;
}
module.exports = { loadXml, htmlDoc };
