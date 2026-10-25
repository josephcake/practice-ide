#!/usr/bin/env python3
"""Point graph.html at the locally vendored vis-network build.

Graphify emits a CDN <script> tag. The IDE serves the graph from the same
origin, so a local copy keeps the panel working offline. Rebuilt graphs are
patched automatically by tools/build-graph.sh.
"""
from __future__ import annotations

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
HTML = ROOT / "graphify-out" / "graph.html"
VENDOR = ROOT / "graphify-vendor" / "vis-network.min.js"
RELATIVE = "../graphify-vendor/vis-network.min.js"


def main() -> int:
    if not HTML.exists():
        print("graphify-out/graph.html not found; nothing to patch", file=sys.stderr)
        return 0
    if not VENDOR.exists():
        print("graphify-vendor/vis-network.min.js missing; leaving CDN URL", file=sys.stderr)
        return 0

    text = HTML.read_text(encoding="utf-8")
    patched = re.sub(
        r'https://unpkg\.com/vis-network@[^"\']+/standalone/umd/vis-network\.min\.js',
        RELATIVE,
        text,
    )
    if patched == text:
        print("graph.html already points at the local vis-network build")
        return 0
    HTML.write_text(patched, encoding="utf-8")
    print("patched graph.html -> " + RELATIVE)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
