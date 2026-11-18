# Contributing

Thanks for helping. This is a small, security-focused Chrome extension, so a few rules are strict.

## Setup
```
npm install
npm test
./scripts/security-check.sh
```
Load it in Chrome: `chrome://extensions` -> Developer mode -> **Load unpacked** -> select this folder. Serve files from `test/fixtures/` over http with `Content-Type: application/xml` to try it (RSS served as `application/rss+xml` shows as plain text in Chrome, which is also handled).

## Project layout
- `src/parse.js`: pure extraction from an XML `Document`.
- `src/views.js`: DOM builders, text only.
- `src/content.js`: detects Chrome's XML presentations and replaces the page.
- `src/style.css`: every rule must be scoped under `html.xp` (a test enforces it).
- No build step and no runtime dependencies. `linkedom` is dev-only, for tests.

## Rules that will block a pull request
- No `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `new Function` or `document.write`. Use `textContent` / `setAttribute`.
- Links are clickable only through `XP.safeHref` (http/https), with `target="_blank"` and `rel="noopener noreferrer"`.
- No permissions, background script, network requests, remote code or remote images. Features that need network access (such as link checking) are out of scope.
- Non-XML, SVG, XHTML, malformed and author-styled pages must stay untouched.

`./scripts/security-check.sh` checks the mechanical parts, and CI runs it.

## Pull requests
1. Open an issue first for anything bigger than a small fix.
2. Branch from `main`. Add or update tests; `npm test` must pass.
3. If you changed parsing, rendering or detection, check it in real Chromium with the fixtures.
4. Add a line under **Unreleased** in `CHANGELOG.md`.
5. Use conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), subject under 72 characters, body explains why.

## Reporting security problems
Do not open a public issue. See [SECURITY.md](SECURITY.md).

By contributing you agree your work is released under the [MIT License](LICENSE).
