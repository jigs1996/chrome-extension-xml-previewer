# Security Policy

XML Previewer opens untrusted XML from any website, so security reports are taken seriously.

## Reporting a vulnerability
Please **do not open a public issue**. Report privately through GitHub:
**Security tab -> Report a vulnerability** on this repository (private vulnerability reporting).

Include the XML sample or steps that reproduce the problem, the Chrome version, and what you expected to happen.
You can expect a first reply within 7 days.

## What counts
- Feed or XML content that runs as HTML or script, or loads remote content.
- A clickable link that is not `http:` or `https:`.
- The extension making a network request, or needing a permission.
- A page that should be left alone (non-XML, SVG, XHTML, malformed, or styled by its author) being replaced.

## Design guarantees
- No `permissions`, no `host_permissions`, no background script, no network requests, no remote code or images.
- Data is inserted with `textContent` and `setAttribute` only, never `innerHTML` or `eval`.
- Run `./scripts/security-check.sh` to verify these rules locally; CI runs it on every pull request.

## Supported versions
Only the latest release receives fixes.
