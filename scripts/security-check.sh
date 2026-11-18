#!/usr/bin/env bash
# The project's security rules (see CONTRIBUTING.md). Exits non-zero on any violation.
set -u
cd "$(dirname "$0")/.."
fail=0

hits=$(grep -rnE "innerHTML|outerHTML|insertAdjacentHTML|eval\(|new Function|document\.write" src/ | grep -v "^[^:]*:[0-9]*: *//")
if [ -n "$hits" ]; then echo "Forbidden HTML/code injection API:"; echo "$hits"; fail=1; fi

hits=$(grep -rnE "fetch\(|XMLHttpRequest|WebSocket|sendBeacon|importScripts|<script|<img|<iframe" src/)
if [ -n "$hits" ]; then echo "Forbidden network or remote-content use:"; echo "$hits"; fail=1; fi

node -e '
const m = require("./manifest.json");
const bad = [];
if (JSON.stringify(m.permissions) !== "[]") bad.push("permissions must be []");
for (const k of ["host_permissions", "optional_permissions", "background", "web_accessible_resources"]) if (k in m) bad.push(k + " is not allowed");
if (bad.length) { console.log("manifest.json: " + bad.join("; ")); process.exit(1); }
' || fail=1

[ "$fail" -eq 0 ] && echo "Security check passed."
exit "$fail"
