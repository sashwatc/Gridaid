# GridAid

For Arjun: [handoff and artifact inventory](docs/handoff.md). The tested full-stack app is in `backend/` + `frontend/`. The shared repository's existing root `src/` Base44 design prototype is preserved separately and is not connected to this engine; its original instructions are in [the archived Base44 setup](docs/base44_setup_original.md). Use the commands below for the validated application.

A working local emergency-resource **planning simulator** for Davenport / Scott County, Iowa. The default screen compares three placements with one action and gives a clear recommendation on a satellite map. Optional detailed tools retain scenario controls, placement switching, explanations and paired seeded Monte Carlo incidents. [Simple planner and verification](docs/simple_planner.md).

The backend implements Dijkstra, greedy coverage, OR-Tools/SCIP maximum coverage and p-median, normalized multi-scenario optimization, explanations, and bounded FastAPI operations. React/TypeScript/Leaflet displays the actual backend results. This is not dispatch software or a claim about emergency outcomes.

## Clean setup

Prerequisites: macOS or Linux, Python 3.10+ to bootstrap uv, Node **22.12+** and npm, internet for initial dependency/browser installation. Tested on macOS arm64, Python 3.12.15, Node 26.3.1, npm 11.16.0. uv downloads Python 3.12 if necessary. Windows commands and other hardware have not been verified.

From the repository root:

```bash
python3 -m venv .bootstrap
.bootstrap/bin/pip install uv==0.13.5
.bootstrap/bin/uv sync --frozen
npm --prefix frontend ci
npm --prefix frontend run build
./scripts/serve.sh
```

Open **http://127.0.0.1:8000**. Enter a resource count and travel-time target, then click **Find a plan**. The app compares three real backend placements automatically and shows one recommendation, coverage in normal and difficult conditions, and numbered locations on a satellite map. The default is the documented four-resource Iowa road/weather case. Failed requests have retry actions; satellite failures fall back to the saved road network. [Simple planner behavior and verification](docs/simple_planner.md).

No credentials or paid APIs are needed for the local planner. Satellite imagery requires internet access. The committed synthetic fixture and compressed public-data snapshot need no data downloads after setup. **Detailed tools** at **http://127.0.0.1:8000/?view=advanced** retain the manual workflow, scenario controls, paired simulation, explanations and model information; see the [five-minute research walkthrough](docs/real_data_demo.md). ML Risk and Blended are available there for the Iowa snapshot, labeled as a **retrospective January 2024 transportation forecast**. They are unavailable for the synthetic corridor fixture.

Optional variables are in `.env.example`. `GRIDAID_HOST` defaults to `127.0.0.1`, `GRIDAID_PORT` to `8000`, and `GRIDAID_CORS` to the two local Vite origins. The launcher reads exported variables; it does not automatically load `.env`. Keep one Uvicorn worker so the local rate/run limits apply consistently. Run identifiers are ephemeral and at most 100 runs are retained.

For frontend development, run `.venv/bin/uvicorn backend.api.app:app --host 127.0.0.1 --port 8000` and, in another terminal, `npm --prefix frontend run dev`. Vite proxies `/api` to FastAPI.

## Verification

```bash
.venv/bin/pytest -q
npm --prefix frontend run build
npm --prefix frontend exec -- playwright install chromium
# Leave ./scripts/serve.sh running in a second terminal:
npm --prefix frontend run test:browser
# Or run all application checks with the server already running:
./scripts/verify.sh
```

Browser checks launch actual Chromium, complete the fixture and Iowa/Blended workflows, compare displayed numbers to responses, and exercise stale results, errors, mobile width, model metrics, and console errors. The in-app browser connector failed to initialize in the implementation environment; local Playwright Chromium was used successfully.

Security scans:

```bash
mkdir -p artifacts
.venv/bin/pip-audit --format=json --output=artifacts/pip-audit.json
npm --prefix frontend audit --json > artifacts/npm-audit.json
.venv/bin/bandit -r backend ml scripts -f json -o artifacts/bandit.json
.venv/bin/detect-secrets scan --all-files --exclude-files '(^|/)(\.git|\.venv[^/]*|\.bootstrap|node_modules|dist|artifacts|data/raw|data/processed|\.pytest_cache|__pycache__|test-results)(/|$)' > artifacts/secrets.json
```

Review entropy findings: dataset/model SHA-256 hashes are expected, not credentials. Actual executions, scan outcomes, limitations and timings are in [docs/validation.md](docs/validation.md).

## Rebuild data and experiments

These operations are offline scripts, not upload/fetch API endpoints. The default Geofabrik source is a dated 134 MB download, capped at 160 MB. Raw cache files are SHA-256 checked; `--refresh` explicitly downloads again.

```bash
.venv/bin/python -m scripts.make_fixture
.venv/bin/python -m scripts.ingest
.venv/bin/python -m scripts.dot_snapshot
.venv/bin/python -m ml.train
.venv/bin/python -m ml.real_train
.venv/bin/python -m scripts.geography_audit
.venv/bin/python -m scripts.real_demo
.venv/bin/python -m scripts.precompute
.venv/bin/python -m scripts.experiments
.venv/bin/python -m scripts.benchmark
```

`ingest` rebuilds roads/population and clears the processed ML flag. Run `ml.real_train` afterward to attach the evaluated risk output and refresh the committed compressed snapshot. `dot_snapshot` records current roadway/traffic attributes but **does not use them as historical predictors**. `ml.train` is a separate synthetic segment-month experiment. The real pipeline uses tract spatial cells, calendar and lagged reported counts, including zero-incident cell-months. Rebuilding from cached raw data reproduces the forecasts; dependency versions are pinned in `uv.lock` and `frontend/package-lock.json`.

The current public snapshot preserves original Census internal points and fixed directed road-segment arrivals. Default travel includes an **assumed straight access connector at 20 km/h**, slowed by winter too. Road-only mode is an optimistic diagnostic. These are whole-tract weights at representative points, **not exact household coverage**. The study rectangle is 41.50–41.63°N / 90.70–90.48°W; selected whole tracts extend outside it. [Geographic audit](docs/geography.md) records every point/candidate, city classification and snapping/access sensitivity.

`geography_audit` updates original coordinates/road attachments without retraining ML. `real_demo` writes all 12 predeclared real cases, access sensitivity, and the version-checked UI preset. Rerun it after rebuilding the public snapshot; a stale preset is rejected.

The 2020 Census fallback replaces ACS because the ACS request required a key. Prepared scenarios are synthetic assumptions. Iowa 511 XML access requires an access request, so live/historical 511 replay is not implemented. Historical as-of crash reporting timestamps were unavailable; retrospective lag counts can include later revisions. Read the model card before interpreting risk.

## API and documentation

Routes follow the source specification; `/api/baseline` also accepts POST for the full typed configuration. `/api/scenarios/evaluate` returns isolated stored metrics under the run's attached scenario definitions; changed settings require new runs. `/api/runs/{id}` exports the complete run JSON. `/api/ml/model-card` includes actual real and fixture metrics; `/api/ml/risk-layer?dataset_id=iowa` serves precomputed historical forecasts. OpenAPI is at `/openapi.json`.

- [Requirement matrix](docs/requirements.md), [progress](docs/progress.md), [decisions](docs/decisions.md), [final audit](docs/audit.md)
- [Methodology](docs/methodology.md), [data sources](docs/data_sources.md), [model card](docs/model_card.md)
- [Threat model](docs/threat_model.md), [security policy](SECURITY.md), [validation](docs/validation.md)

Competition release gates are **not all met**: HTTPS deployment, historical as-of feature-availability validation, professional/user studies, final name clearance, video, ten human rehearsals and submission remain unverified or human tasks. The historical schedule does not establish completion.
