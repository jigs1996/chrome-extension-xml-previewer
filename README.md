# XML Previewer

[![CI](https://github.com/jigs1996/chrome-extension-xml-previewer/actions/workflows/ci.yml/badge.svg)](https://github.com/jigs1996/chrome-extension-xml-previewer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Chrome extension that turns raw XML pages into a readable preview, for developers checking data and links.
No permissions, no network requests, no tracking.

## Features
- **Sitemap / sitemap index:** searchable, sortable table (loc, lastmod, changefreq, priority) with clickable links.
  - Health summary: 50,000-URL limit, duplicates, mixed hosts and protocols, missing or invalid `lastmod`, bad `priority` / `changefreq`. All checked locally.
  - "Show only" filter for rows with a given issue.
  - Click a row for hreflang alternates and image, video and news entries.
  - Export the filtered rows as CSV or JSON, or copy them.
- **RSS / Atom:** items table (title, link, date, guid); click a row for every field, including enclosures.
- **Any other XML:** collapsible tree with attributes, copy XPath of any node, and an XPath query box.
- Table / Tree / Raw toggle, filter, copy. Light and dark theme follows your system.
- Shortcuts: `/` focuses the filter or XPath box, `1`-`3` switch views, `Esc` leaves the box.

## Install (unpacked)
1. `chrome://extensions` -> enable **Developer mode** -> **Load unpacked** -> select this folder.
2. Open any XML URL. For local `file://` XML, open the extension's **Details** and enable **Allow access to file URLs**.

## Privacy and security
The extension collects nothing and sends nothing anywhere. Feed data is only inserted as text, never HTML or script.
Only `http(s)` links are clickable (`noopener noreferrer`). Remote images and article HTML are never rendered.
Pages that are not plain XML (HTML, SVG, XHTML, malformed, or styled by their author) are left untouched.
Found a vulnerability? See [SECURITY.md](SECURITY.md).

## Develop
```
npm install
npm test
./scripts/security-check.sh
```
Node's built-in test runner is used; `linkedom` is a dev-only DOM. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Changelog
See [CHANGELOG.md](CHANGELOG.md).

## License
[MIT](LICENSE)
