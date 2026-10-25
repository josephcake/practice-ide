#!/usr/bin/env bash
# Rebuild the code graph for this project (code-only, local AST, no API key).
# Used by the IDE's Code Graph panel through POST /api/graph/build.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="${GRAPHIFY_BIN:-}"

if [[ -z "$BIN" || ! -x "$BIN" ]]; then
  BIN="/tmp/gs-graphify-venv/bin/graphify"
fi
if [[ ! -x "$BIN" ]]; then
  BIN="$(command -v graphify || true)"
fi
if [[ -z "$BIN" || ! -x "$BIN" ]]; then
  echo "graphify CLI not found. Install it with: uv tool install graphifyy" >&2
  exit 127
fi

cd "$ROOT"
"$BIN" extract . --code-only
"$BIN" cluster-only . --no-label
python3 "$ROOT/tools/patch-graph-html.py"
