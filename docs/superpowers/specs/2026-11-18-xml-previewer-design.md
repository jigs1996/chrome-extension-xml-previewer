# XML Previewer: Chrome extension design

## Intent
A developer opens an XML URL (sitemap, RSS/Atom feed, anything else) and gets a calm, readable view
instead of raw XML, so data and links can be verified quickly. Not an article reader.

## Goals
- Auto-replace raw XML pages with a structured preview.
- Sitemap / sitemap index: searchable table (loc, lastmod, changefreq, priority), clickable links, URL count.
- RSS 2.0 / Atom: table of items (title, link, date, guid/id); rows expand to show every field.
- Any other XML: collapsible tree with attributes, colouring, expand/collapse all.
- Toggle Table / Tree / Raw; search/filter; copy (value, row, raw).
- Secure by construction; no distractions (single clean page, light/dark per system).

## Non-goals
- Reading/rendering article HTML. Link checking (HEAD requests), validation against schemas, editing XML.
- Publishing to Chrome Web Store (out of scope for now). Other browsers.

## Anti-goals (failure even if it works)
- Any feed content executing as HTML/script, or any network request made by the extension.
- Slow or frozen tab on large sitemaps (50k URLs).

## Constraints
- Manifest V3, plain JavaScript (ES modules not required), no dependencies, no build step.
- Content script matches `<all_urls>` but acts only when `document.contentType` is an XML type
  (`text/xml`, `application/xml`, `application/rss+xml`, `application/atom+xml`, `+xml`). `file://` needs the
  user to enable "Allow access to file URLs" in Chrome.
- No `host_permissions`, no background network, no remote code, no `innerHTML`/`eval`.

## Approaches considered
- A: generic tree only: simplest, poor for sitemaps.
- **B (chosen): type-aware views with tree fallback.**
- C: B plus live link checking: needs network permissions, conflicts with "secure"; deferred.

## Design
- **Detect:** content script reads the already-parsed `document` (XMLDocument), plus `document.documentElement.outerHTML`-free
  raw text via `XMLSerializer` for the Raw view. Detect by root element: `urlset`/`sitemapindex` -> sitemap,
  `rss`/`feed` -> feed, otherwise generic.
- **Render:** replace document content with own DOM built via `createElement` + `textContent` only. Styles via
  injected stylesheet (`web_accessible_resources` not needed if CSS is bundled as a content-script CSS file
  scoped to the replaced page).
- **Links:** clickable only if scheme is `http:` or `https:`, with `rel="noopener noreferrer"`, `target="_blank"`;
  others shown as plain text.
- **Images/HTML in feeds:** never rendered; `content:encoded`/`description` shown as escaped text, truncated with expand.
- **Performance:** table renders in chunks (virtual/paged, ~500 rows at a time) with search over a pre-built array.
- **Files:** `manifest.json`, `content.js` (detect + views), `style.css`, `icons/`, small `test/` fixtures
  (sitemap, sitemapindex, RSS, Atom, malicious `<script>` and `javascript:` samples) with a Node check of the pure
  parsing/extraction functions.

## Left to the builder
Exact visual styling, icon, keyboard shortcuts, chunk size, how fixtures are tested.
My calls (not yours): paged rendering, truncation lengths, dark/light via `prefers-color-scheme`.
