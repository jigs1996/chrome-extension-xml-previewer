# XML Previewer: project guide

Chrome MV3 extension that replaces raw XML pages with a readable preview, for developers verifying data and links.
Spec: `docs/superpowers/specs/2026-11-18-xml-previewer-design.md`. Plan: `docs/superpowers/plans/2026-11-18-xml-previewer.md`.

## Goals
- Sitemap / sitemap index: searchable table (loc, lastmod, changefreq, priority), clickable links, URL count.
- RSS / Atom: items table (title, link, date, guid); click a row for every field.
- Any other XML: collapsible tree. Table / Tree / Raw toggle, filter, copy.
- Calm, distraction-free, light/dark by system setting.
- Secure by construction. Fast on 50k-URL sitemaps.

## Non-goals
Reading article HTML, schema validation, editing XML, live link checking (needs network permissions), other browsers.

## Status
Done: everything above, 21 unit tests, verified in real Chromium.
Backlog (deferred review minors): Atom link with no `rel` should count as alternate; ignore namespaced `<atom:link>` in RSS items;
count only direct children of root/channel as rows; use `Object.create(null)` for item fields; show `<enclosure url>`;
Raw view should keep the `<?xml?>` declaration on Chrome's viewer path; Copy fallback on http pages and copy filtered rows only;
guard very deep trees against stack overflow; only treat Chrome's own `parsererror` as an error.
Ideas (needs your decision): link checking (HEAD requests), Chrome Web Store listing.

## Architecture
Content script files share one global `XP` (content scripts cannot be ES modules), loaded in this order by `manifest.json`:
- `src/parse.js`: pure extraction from an XML `Document` (`detectKind`, `extractSitemap`, `extractFeed`, `safeHref`, `isPreviewable`).
- `src/views.js`: DOM builders (`renderTable`, `renderTree`, `renderRaw`), text only.
- `src/content.js`: detects Chrome's three XML presentations (real XML doc, built-in XML viewer, plain-text `<pre>`), replaces the page.
- `src/style.css`: every rule scoped under `html.xp` (a test enforces it).
No build step. No runtime dependencies (`linkedom` is dev-only, for tests).

## Security rules (non-negotiable)
- Never `innerHTML`, `outerHTML=`, `insertAdjacentHTML`, `eval`, `new Function`, `document.write`. Feed data goes in via `textContent` / `setAttribute` only.
- Links clickable only via `XP.safeHref` (http/https), with `target="_blank"` and `rel="noopener noreferrer"`.
- No `host_permissions`, no `permissions`, no background script, no network requests, no remote code, no remote images.
- Leave non-XML, SVG, XHTML, malformed and stylesheeted pages untouched.

## Before every commit
1. `npm test` must pass.
2. Security check, all must be empty/true:
   - `grep -rnE "innerHTML|outerHTML|insertAdjacentHTML|eval\(|new Function|document\.write" src/ | grep -v "^[^:]*:[0-9]*: *//"` returns nothing (comment lines are ignored).
   - `manifest.json` has `"permissions": []` and no `host_permissions`, `background`, or `web_accessible_resources`.
   - `grep -rnE "fetch\(|XMLHttpRequest|WebSocket|sendBeacon|importScripts|<script|<img|<iframe" src/` returns nothing. (XML namespace strings like `http://www.w3.org/...` are fine; they are not requests.)
   - No secrets or tokens staged: `git diff --cached` read through.
3. If the change touches parsing, rendering or detection, verify in real Chromium with the fixtures (see Testing).

## Git rules
- Never commit or push until the user explicitly says so; approval covers only that commit.
- Never add Claude/Anthropic as co-author or mention AI authorship in commit messages, any repo.
- Conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`. Subject under 72 chars, body explains why.
- Work on a branch for anything non-trivial; `main` stays releasable.

## Release process (proposed; edit as needed)
1. Everything above passes on `main`; backlog items for the release are done or consciously deferred.
2. Bump the same version in `manifest.json` and `package.json` (semver: fix = patch, feature = minor).
3. Add a line to a `CHANGELOG.md` (create it at first release).
4. Commit `chore: release vX.Y.Z` (only after user confirmation), tag `vX.Y.Z`.
5. Package: `zip -r xml-previewer-vX.Y.Z.zip manifest.json src icons` (exclude tests, docs, node_modules).
6. Upload to the Chrome Web Store only when the user asks; pushing tags and publishing are always confirmed first.

## Testing
- Unit: `npm install && npm test` (Node test runner + `linkedom`). Note linkedom keeps the namespace prefix in `localName`, reports XHTML for every `namespaceURI`, and drops processing instructions, so code reads `xmlns` attributes and strips prefixes.
- Real browser: load unpacked (`chrome://extensions` -> Developer mode -> Load unpacked), open files from `test/fixtures/` served over http with `Content-Type: application/xml` (also try `application/rss+xml`, which Chrome shows as plain text).
