# XML Previewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Chrome MV3 extension that replaces raw XML pages with a table preview (sitemap, RSS/Atom) or a collapsible tree (any other XML), with Table/Tree/Raw toggle, search and copy.

**Architecture:** Three classic content-script files sharing one global namespace `XP` (content scripts cannot be ES modules): `parse.js` (pure extraction from an XML `Document`), `views.js` (DOM builders, text-only), `content.js` (detect, replace page, wire toggles). Node tests (`node:test` + dev-only `linkedom` for a DOM) cover parse and views; the real browser is checked by hand.

**Tech Stack:** Plain JavaScript, Manifest V3, no runtime dependencies, no build step. Dev-only: `linkedom`.

**Spec:** `docs/superpowers/specs/2026-11-18-xml-previewer-design.md`

## Global Constraints

- Manifest V3; no `host_permissions`, no background script, no network requests, no remote code.
- Never use `innerHTML`, `outerHTML` assignment, `insertAdjacentHTML`, `eval`, `new Function`. Feed data goes in via `textContent` / `setAttribute` only.
- Links clickable only when scheme is `http:` or `https:`, with `target="_blank"` and `rel="noopener noreferrer"`; otherwise plain text.
- `content:encoded` / `description` shown as escaped text, truncated to 300 chars with a "show more" expand.
- Content script matches `<all_urls>`, runs at `document_end`, acts only on XML content types (see Task 3).
- Tables render 500 rows at a time ("show more" button); search filters the full array.
- Light/dark via `prefers-color-scheme`.
- Do not commit unless the user says so (user's standing rule); the commit steps below are therefore "stop point" markers: skip them unless told.

## Review Focus

- Malformed XML: Chrome serves a `parsererror` document; extension must leave the page untouched.
- `image/svg+xml` and XHTML are XML content types but must NOT be hijacked.
- XML with an XSLT stylesheet (root becomes `html`): leave untouched.
- Namespaced/prefixed elements and Atom `<link href rel>` with several links: pick `rel="alternate"` (or first) as the item link.
- Hostile values: `javascript:`, `data:`, `vbscript:` URLs and `<script>` text inside CDATA must be inert text.
- Empty sitemap (`<urlset/>`) and sitemap with 50k URLs: no crash, no frozen tab.
- Missing optional fields (no lastmod, no pubDate): blank cell, not "undefined".

---

### Task 1: Parsing core

**Files:**
- Create: `package.json` (`"private": true`, `"scripts": {"test": "node --test test/"}`, devDependency `linkedom`)
- Create: `src/parse.js`
- Create: `test/fixtures/{sitemap,sitemapindex,rss,atom,generic,hostile}.xml`, `test/helpers.js` (`loadXml(name): Document` via linkedom `DOMParser`, `mime: 'text/xml'`)
- Test: `test/parse.test.js`

**Interfaces:**
- Produces (all on `XP`, and `module.exports` when `typeof module !== 'undefined'`):
  - `XP.detectKind(doc: Document): 'sitemap' | 'sitemapindex' | 'rss' | 'atom' | 'generic'` — by `doc.documentElement.localName`: `urlset`, `sitemapindex`, `rss`, `feed`, else generic.
  - `XP.extractSitemap(doc): {columns: string[], rows: string[][]}` — columns `['loc','lastmod','changefreq','priority']` for urlset, `['loc','lastmod']` for index; missing field -> `''`.
  - `XP.extractFeed(doc): {columns: string[], rows: string[][], details: Record<string,string>[]}` — columns `['title','link','date','guid']`; `details[i]` holds every direct child of that item as `localName -> textContent` (first occurrence wins), for row expansion.
  - `XP.safeHref(value: string): string | null` — returns the trimmed value only if it parses with `new URL` to `http:`/`https:`, else `null`.
  - `XP.isPreviewable(doc: Document, contentType: string): boolean` — false for `image/svg+xml`, `application/xhtml+xml`, when root is `parsererror` or `html`, or a `parsererror` element exists anywhere; true for `text/xml`, `application/xml`, or any `+xml` type otherwise.

- [ ] **Step 1: Write failing tests** in `test/parse.test.js` (names): `detectKind identifies all five kinds`; `extractSitemap returns 4 columns and blanks for missing lastmod`; `extractSitemap on sitemapindex returns loc,lastmod`; `extractSitemap on empty urlset returns zero rows`; `extractFeed rss maps title/link/date/guid and details`; `extractFeed atom picks rel=alternate link, falls back to first link, date from updated|published`; `safeHref rejects javascript:, data:, vbscript:, relative, empty and accepts https`; `isPreviewable rejects svg, xhtml, parsererror, html root`. Fixtures: `sitemap.xml` has 3 URLs (one without lastmod); `atom.xml` has an entry with two links (`rel="self"` first, `rel="alternate"` second); `hostile.xml` is an RSS whose item has `<link>javascript:alert(1)</link>` and `<description><![CDATA[<script>alert(1)</script>]]></description>`.
- [ ] **Step 2:** `npm install && npm test` — expect FAIL (`src/parse.js` missing).
- [ ] **Step 3:** Implement `src/parse.js` per the signatures. Use `getElementsByTagNameNS('*', name)` style lookups by `localName` so prefixes never matter.
- [ ] **Step 4:** `npm test` — expect all PASS.
- [ ] **Step 5:** (commit only if the user says so)

---

### Task 2: Views

**Files:**
- Create: `src/views.js`
- Test: `test/views.test.js`

**Interfaces:**
- Consumes: `XP.safeHref`, `XP.extractSitemap`, `XP.extractFeed`.
- Produces on `XP` (all take a `document` to build with, so tests can pass the linkedom one, and return an `HTMLElement`):
  - `XP.renderTable(d: Document, data: {columns: string[], rows: string[][], details?: object[]}, opts?: {pageSize?: number}): HTMLElement` — search input filters rows (case-insensitive, any cell); header shows `N of M`; first `pageSize` (default 500) rows then a "Show more" button; cells whose `safeHref` is non-null render as `<a>`; rows with `details` expand on click to a definition list of all fields (long values truncated at 300 chars with "show more").
  - `XP.renderTree(d: Document, root: Element): HTMLElement` — nested `<details open>` per element (collapsed beyond depth 3), attributes as `name="value"` spans, text nodes/CDATA as text spans, Expand all / Collapse all buttons.
  - `XP.renderRaw(d: Document, xmlText: string): HTMLElement` — `<pre>` with `textContent = xmlText` and a Copy button (`navigator.clipboard.writeText`).

- [ ] **Step 1: Write failing tests** in `test/views.test.js`: `table renders first pageSize rows and show-more reveals the rest` (1200 rows, pageSize 500 -> 500 `tr`, click -> 1000); `table search filters across all rows, not just rendered ones`; `javascript: link is plain text, https link is an anchor with rel noopener noreferrer and target _blank`; `hostile feed produces no script element and no javascript: href anywhere` (render `hostile.xml` through `extractFeed` + `renderTable`, expand the row, assert `querySelectorAll('script').length === 0` and no `a[href^="javascript"]`); `blank cells for missing fields never contain "undefined"`; `tree renders nested elements, attributes and CDATA as text, with no innerHTML-created elements from CDATA`; `raw view is a pre whose textContent equals the input`.
- [ ] **Step 2:** `npm test` — expect FAIL.
- [ ] **Step 3:** Implement `src/views.js`. Build only with `createElement`/`textContent`/`setAttribute`. Search must debounce-free filter a precomputed lowercase string per row.
- [ ] **Step 4:** `npm test` — expect PASS.
- [ ] **Step 5:** (commit only if the user says so)

---

### Task 3: Extension shell and manual check

**Files:**
- Create: `manifest.json`, `src/content.js`, `src/style.css`, `icons/icon{16,48,128}.png` (simple generated placeholders), `README.md` (load-unpacked steps, file:// toggle)
- Test: none automated for this task; manual checklist below.

**Interfaces:**
- Consumes: `XP.isPreviewable`, `XP.detectKind`, `XP.extract*`, `XP.render*`.
- Produces: the shipped extension.

- [ ] **Step 1:** `manifest.json`: `manifest_version: 3`, `permissions: []`, `content_scripts: [{matches: ["<all_urls>"], js: ["src/parse.js","src/views.js","src/content.js"], css: ["src/style.css"], run_at: "document_end"}]`. (CSS is injected in the XML document; scope every rule under `#xp-root` so raw-XML styling is unaffected before replacement.)
- [ ] **Step 2:** `src/content.js`: if `!XP.isPreviewable(document, document.contentType)` return. Capture raw text with `new XMLSerializer().serializeToString(document)` before touching the DOM. Build a toolbar (kind badge, Table/Tree/Raw buttons; Table only for sitemap/sitemapindex/rss/atom) and a view container; replace body content of the document element with `#xp-root` (create an `html`-free structure appropriate for an XML document: use `document.createElementNS('http://www.w3.org/1999/xhtml', 'div')` so styling applies). Default view: Table for known kinds, Tree for generic.
- [ ] **Step 3:** `src/style.css`: system font, `prefers-color-scheme` variables, sticky toolbar, readable table, monospace tree/raw. Everything scoped under `#xp-root`.
- [ ] **Step 4: Manual verification** (Chrome -> `chrome://extensions` -> Developer mode -> Load unpacked): open `https://latent.space/feeds/all.xml`, `https://agentic.ai/feed.xml`, `https://latent.space/feed`, a real `/sitemap.xml`, and local fixtures (after enabling file URL access). Expected: table with clickable links; Tree and Raw toggles work; search filters; `hostile.xml` shows `javascript:` as plain text and runs nothing; an SVG file and an HTML page are unchanged; a malformed XML file is unchanged.
- [ ] **Step 5:** `npm test` still PASS. (commit only if the user says so)
