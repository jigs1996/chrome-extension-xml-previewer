# XML Previewer

Chrome extension that turns raw XML pages into a readable preview.

- **Sitemap / sitemap index:** searchable table (loc, lastmod, changefreq, priority), clickable links, URL count.
- **RSS / Atom:** table of items (title, link, date, guid); click a row to see every field.
- **Any other XML:** collapsible tree with attributes.
- Table / Tree / Raw toggle, filter, copy.

## Install (unpacked)
1. `chrome://extensions` -> enable **Developer mode** -> **Load unpacked** -> select this folder.
2. Open any XML URL. For local `file://` XML, open the extension's **Details** and enable **Allow access to file URLs**.

## Security
Feed data is only inserted as text, never HTML or script. Only `http(s)` links are clickable (`noopener noreferrer`).
Remote images and article HTML are never rendered. The extension has no permissions, makes no network requests and loads no remote code.

## Develop
`npm install && npm test` (Node's built-in test runner; `linkedom` is a dev-only DOM).
