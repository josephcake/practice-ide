#!/usr/bin/env bash
# One-time Graphify CLI setup for the Code Graph panel.
# The build script looks for /tmp/gs-graphify-venv/bin/graphify by default;
# set GRAPHIFY_BIN or GRAPHIFY_VENV to use a different location.
set -euo pipefail

VENV="${GRAPHIFY_VENV:-/tmp/gs-graphify-venv}"
CACHE="${GRAPHIFY_UV_CACHE:-/tmp/gs-uv-cache}"

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required (https://docs.astral.sh/uv/)." >&2
  exit 1
fi

uv venv --python 3.13 "$VENV"
UV_CACHE_DIR="$CACHE" uv pip install --python "$VENV/bin/python" graphifyy
echo "Graphify installed: $VENV/bin/graphify"
