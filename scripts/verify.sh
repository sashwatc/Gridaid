#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
.venv/bin/python -m scripts.make_fixture
.venv/bin/pytest -q
npm --prefix frontend run build
# Browser tests require the built application running on port 8000.
if curl --fail --silent http://127.0.0.1:8000/api/health >/dev/null; then
  npm --prefix frontend run test:browser
else
  echo 'Browser checks not executed: start ./scripts/serve.sh and rerun.' >&2
  exit 1
fi
