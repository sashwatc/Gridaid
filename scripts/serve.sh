#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -f frontend/dist/index.html ]]; then
  echo 'Build the frontend first: npm --prefix frontend ci && npm --prefix frontend run build' >&2
  exit 1
fi
exec .venv/bin/uvicorn backend.api.app:app --host "${GRIDAID_HOST:-127.0.0.1}" --port "${GRIDAID_PORT:-8000}"
