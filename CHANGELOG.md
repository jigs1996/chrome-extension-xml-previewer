# Changelog

All notable changes to XML Previewer are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-11-18

### Added
- Sitemap health summary chips: URL count against the 50,000 limit, multiple hosts, mixed http/https, duplicate URLs, non-http(s) URLs, missing/invalid/future `lastmod`, `priority` outside 0-1, invalid `changefreq`. Local checks only.
- "Show only" issue filter, with counts, and a marker on flagged rows.
- Sortable columns (numbers numerically, empty cells last).
- Export the filtered rows as CSV or JSON; "Copy rows" now copies only the filtered rows. CSV cells that could run as spreadsheet formulas are neutralised.
- Sitemap rows expand to show hreflang alternates, image, video and news entries.
- Tree view: hover or click a node to see its XPath and copy it; XPath query box with results list and copy.
- Keyboard shortcuts: `/` focuses the filter or XPath box, `1`-`3` switch views, `Esc` leaves the box.
- RSS/Atom: `<enclosure>` URL shown in the item details.
- 10 more unit tests (31 total).
- Open source files: MIT license, security policy, contributing guide, code of conduct, issue and PR templates, CI workflow, and `scripts/security-check.sh`.

### Fixed
- Atom `<link>` without `rel` now counts as the item link.
- `<atom:link>` inside an RSS item no longer replaces the item's own `<link>`.
- A feed field named like an Object property (for example `<constructor>`) is no longer dropped.

### Not included
- Link checking (HTTP requests): it needs network permissions, which would break the "no network, no permissions" guarantee.

## [0.1.0] - 2026-11-18

### Added
- Chrome MV3 extension that replaces raw XML pages with a readable preview.
- Sitemap and sitemap index view: searchable table (loc, lastmod, changefreq, priority), clickable links, URL count.
- RSS and Atom view: items table (title, link, date, guid) with a detail panel per row.
- Collapsible tree view for any other XML, plus Table / Tree / Raw toggle, filter and copy.
- Light and dark theme following the system setting.
- Detection of Chrome's three XML presentations (XML document, built-in viewer, plain-text `<pre>`).
- 21 unit tests (Node test runner + `linkedom`).

### Security
- No `innerHTML`/`eval`, no permissions, no network requests, no remote code; links limited to http/https with `rel="noopener noreferrer"`.

[Unreleased]: https://github.com/jigs1996/chrome-extension-xml-previewer/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/jigs1996/chrome-extension-xml-previewer/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/jigs1996/chrome-extension-xml-previewer/releases/tag/v0.1.0
