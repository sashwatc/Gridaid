# Executed validation — continuation

The current implementation passed **52 backend tests, strict TypeScript/build, and 4 actual Chromium tests**. The previous checkpoint is retained below as history; its zero-access semantics, timings and test totals are not current claims. Original sources and reports were read, then checked against actual code and counterexamples. No public deployment or submission occurred.

## Current commands actually executed

| Command / evidence | Actual outcome |
|---|---|
| Initial `.venv/bin/pytest -q` before changes | 42 passed, 4 dependency deprecation warnings, 8.97 s; valid prior mathematics evidence reused |
| `.venv/bin/python -m scripts.geography_audit` | Completed original-point/segment/place audit and compressed snapshot update without ML retraining; 39 points/32 sites retained |
| `.venv/bin/python -m scripts.real_demo` | Completed all 12 predeclared real cases, separate six-scenario reference, fixed/reoptimized access sensitivity; selected transparent version-checked preset |
| `.venv/bin/pytest -q --junitxml=artifacts/pytest-followup.xml` | **52 passed**, 0 failed, 12.04 s |
| `./scripts/serve.sh` | Started/reused local full-stack server on **127.0.0.1:8000**, left running |
| `./scripts/verify.sh` | Exit 0: **52 passed** (11.26 s final repeat), TypeScript/build passed (Vite 466 ms), **4 Chromium tests passed** (21.6 s final repeat), no skipped/flaky tests |
| pip-audit / npm audit reruns | 76 Python dependencies and npm tree: **0 known vulnerabilities** |
| Bandit rerun on backend/ml/scripts | **0 findings** |
| detect-secrets rerun | **392** public edge/content hash flags reviewed; **0 credentials**. Exact review in secret_scan_review_followup.json |

Raw follow-up reports are in `artifacts/*-followup.*`; committed summaries are `security_scan_results_followup.json` and `browser_validation_followup.json`. The four Python warnings are dependency deprecations (Starlette/httpx and OR-Tools SWIG); no new runtime-warning claim is hidden. Browser unexpected console/page errors: zero; deliberate invalid-input 422 remains expected in the fixture test.

## New independent evidence and confirmed failures before repair

- **Directed terminal access:** hand calculation of a quarter of a one-way edge plus source/destination connectors; downstream cannot travel backward; reverse edge permits its own 3/4 approach; road closure removes the approach; winter doubles both road/access seconds. Geometric construction independently projects a 100 m offset and verifies 1/4 and 3/4 arrival fractions. Actual point/road distances are checked in EPSG:26915, not degree space.
- **P-median independent oracle:** an additional 8-choose-3 enumeration includes 100,000-second finite trips and derives the explicit 103,600-second unreachable penalty independently, without importing the production penalty helper. Prior complete 56-configuration coverage/p-median and NetworkX comparisons still pass.
- **Shared normalized decision:** a hand case with unequal scenario mass has a single shared optimum; multiplying one scenario's weights cannot change the normalized objective. The original tiny brute-force portfolio and fragile bridge tests remain.
- **Real zero-access defect:** previously no original-to-road time was charged, up to 871 m, and demand was drawn at relocated nodes. Fixed directed segment arrivals/original symbols/default explicit connectors; all sensitivity outcomes published. No verified-path/household claim was added.
- **Computation deadline:** a worker emitted only an IPC header and stalled; the old implementation blocked beyond the timeout (failed regression). Receive now obeys the deadline and cleanup kills/joins the worker.
- **Cancellation capacity:** cancelling a waiting request allowed a second job while the first kept running (failed regression). Shielded tracked jobs retain the capacity slot until completion.
- **Cache race:** a test evicts a cache file after existence check but before read (failed regression). It now rebuilds safely; verified bytes are loaded directly and eviction enumeration tolerates concurrent removal.
- **Browser trial-count race:** delaying an actual API response, changing 10k→20k trials, then releasing it reproduced a visible stale 10k result. With the guard temporarily removed, the browser test failed exactly at that assertion (artifacts/browser-race-before.json). Restored cancellation/trial guard passed the complete browser suite. No fake successful solver response was used.

New counterexamples are in `tests/test_followup.py`; the existing tests were retained. Initial new geometry testing exposed a test-CRS error: a projected straight segment was checked in degree space; the assertion now uses the actual metric processing CRS rather than loosening the mathematical result. No optimizer objective expectations were changed to fit a returned placement.

## Geography and real-data demo evidence

[geography.md](geography.md) distinguishes the **265.008 km² selection rectangle**, **232.193 km² whole-tract footprint** (61.750 km² outside the rectangle), and irregular buffered graph. Original points classify as Davenport 31 / Bettendorf 7 / unincorporated 1. Candidates classify as Davenport 20 / Bettendorf 5 / Eldridge 1 / unincorporated 6. Selected polygons also overlap Buffalo, which has no selected internal point. This is not all Scott County or exact household coverage.

The largest retained point-to-road gap is still 871.046 m (tract 19163012601, weight 5,484). Median falls from 59.095 m at junctions to 36.440 m on road segments. Default 20 km/h access adds 2.61 minutes at the maximum gap before winter scaling. Connectors remain unverified straight lower-bound distances.

The 12-case grid is fixed at p=2/3/4, winter 1.25/1.6, central/east closure zones, Population demand, five-minute threshold and 0.6 average / 0.4 minimum objective. Every normal/average/worst metric for all three placements is in [real_data_results.md](real_data_results.md) and JSON. Four cases select identical static/resilient sites. Chosen p4/1.6/central: baseline **37.898 / 22.188 / 8.486%**, static **78.220 / 50.736 / 23.616%**, resilient **67.245 / 53.475 / 38.799%** (normal/average/worst). Under fixed placements, changing access from 20 to 5 km/h lowers resilient worst coverage to **25.63%**; reoptimized sensitivity is separately retained.

All candidates, closure zones, uniform winter factors and access speeds are **assumptions**, not observed disruptions or current facilities. Exact controls and a five-minute walkthrough are in [real_data_demo.md](real_data_demo.md). The fragile synthetic teaching graph remains separate.

## ML claim verification

Production artifact hash matches the existing file; all public-snapshot forecasts equal the saved forecast table. Real data has 2,340 cell-month rows, 39 cells, 90 zero-count rows. New instrumented actual-pipeline tests on separate generated data fit every imputer only on training indices; changing held-out labels cannot change validation metrics, model selection or artifact bytes. Cells cannot switch geography group across periods. Production final-test metrics were not retuned/replaced: forest validation winner, final MAE **1.774909**; Poisson final MAE **1.749958**.

The 2023 test is monthly rolling retrospective; prior test-month counts may enter later months' lag inputs without entering training/selection. January 2024 forecast and unverified historical reporting/revision latency remain explicit in the UI/card. No claim of a current or operational emergency predictor is supported.

## Integrated browser evidence

In-app browser connection was retried and failed at initialization as before; local Playwright Chromium executed the checks. Four tests cover fixture workflow, mobile width, observed Iowa blended workflow, and the real preset. The preset test executes baseline → static → disrupted view → shared resilience → comparison endpoint → paired simulation; exact displayed normal/minimum/sample coverage and site unique/marginal contributions match API JSON. Loading, stale access controls, candidate/road/closure/coverage/improvement/access layers and actual response-delay race pass. The corrected preset screenshot was saved to artifacts/workflow-real-preset.png and visually inspected.

Automated checks are not a 5–10-person user study or ten human rehearsals. Source release gates still lack professional/user validation, historical as-of availability, live 511 access and HTTPS/deployment testing; no video/submission/public deployment was done.

---

## Previous implementation checkpoint (historical evidence only)


Executed locally on October 24, 2026 (America/Chicago; late runs have October 25 UTC timestamps). Results below describe actual commands, not the source schedule or target timings. Hardware: Apple M5, Mac17,3, 16 GiB RAM, macOS 27.0.1 arm64. Python 3.12.15, Node 26.3.1, npm 11.16.0; frozen package versions in the two lockfiles.

### Final application checks

| Executed command | Actual outcome |
|---|---|
| `python3 -m venv .bootstrap` then `.bootstrap/bin/pip install uv==0.13.5` | Succeeded. |
| `UV_PROJECT_ENVIRONMENT=.venv-clean .bootstrap/bin/uv sync --frozen` | Succeeded, genuinely new environment, 76 pinned packages installed. This is the documented uv setup using an isolated target directory. |
| `.venv-clean/bin/pytest -q --junitxml=artifacts/pytest.xml` | **42 passed**, 0 failed, 9.39 s final fresh-environment run. |
| `npm --prefix frontend ci` | Succeeded from lock, 77 packages installed / 78 audited, 0 vulnerabilities. npm printed package-install-script policy notices; build and Chromium installation succeeded. |
| `npm --prefix frontend run build` | TypeScript strict check and Vite production build passed; final bundle 407.58 kB JS (123.92 kB gzip), 26.82 kB CSS. |
| `./scripts/serve.sh` | Started the built full-stack app on 127.0.0.1:8000 successfully. |
| `./scripts/verify.sh` | Exit 0: deterministic fixture regeneration, **42 backend tests passed** (8.99 s), TypeScript/build passed (Vite 517 ms), **3 Chromium tests passed** (11.6 s). No skipped or flaky browser tests. |
| `git diff --check` | Passed. |

The Python suite emits four dependency deprecation warnings: Starlette's httpx test-client compatibility and OR-Tools SWIG metadata. These are recorded warnings, not failed tests. No unexpected browser console/page errors occurred. The intentionally invalid resource request produces an expected HTTP 422 browser network error.

### Independent mathematical and behavioral evidence

- Routing: manually calculated graph; 60 km/h over 1 km = 60 seconds; parallel edge choice, one-way reversal, isolated destination and closure; every fixture source/scenario compared against NetworkX. Actual OSM direction tags, mph conversion and access restrictions tested. Simplification preserves a known chain's total length. The pinned PBF was reparsed after adding strict unsupported-direction rejection: 53,224 unsimplified nodes / 113,896 directed edges, no unsupported direction found.
- Static optimization: independently enumerate **all 56 configurations** of 8 choose 3 for both coverage and p-median, including unreachable demand. Compare objective values and solver bound, not selected-set identity. Deterministic/random/greedy baselines and exactly-p uniqueness checked. Invalid/infeasible counts rejected; a real 1-ms p-median solve exercises solver-limit/no-solution status handling.
- Resilience: tiny multiscenario exhaustive objective comparison and invariance under independent scaling of each scenario's weights. On a real directed toy bridge graph, static center covers 100% normal / 0% closed; resilient west site covers 60% in both. This is an explicit tradeoff, not a universal performance guarantee. Base graph mutation, fixed resource failure and added event mass tested.
- Simulation/metrics: fixed-seed repeatability, identical incident samples for identical placements, portfolio-order independence, unavailable-resource exclusion, weighted threshold equality, zero demand, unreachable share and reference mean/median/p90/p95. API 10,000-trial sampled coverage agrees with deterministic weighted coverage within the declared test tolerance.
- ML: fixed schemas, zero-incident rows, prior-period features, future-target perturbation, train-only imputer state, time/group holdouts and reproducible fixture reports. Real held-out metrics/model selection and artifact/prediction versions checked. Final historical feature availability cannot be established without as-of archives; see model card.
- API/security: successful entire workflow plus public Iowa blended run; malformed/extra/unknown/nonfinite/oversized inputs, request caps, rate limit, computation gate, actual killable process timeout, restricted CORS, headers and generic exception errors. Results remain isolated. Closure/graph/candidate/demand/model-mode changes alter cache keys; corrupt disk files rebuild; changed scenario definitions reject stored simulation reuse. Compressed public snapshot works with no processed data directory.

Tests are in `tests/test_mathematics.py`, `test_data_and_explanations.py`, `test_ml_external.py`, and `test_api_security.py`.

### Browser execution and visual inspection

The in-app browser skill/runtime was attempted and failed during initialization: `Importing module node:process is not allowed in node_repl`. Local **Playwright Chromium 156.0.8078.4** was installed and used successfully.

`frontend/tests/workflow.spec.ts` executes:

1. Fixture baseline → static → road-closure stress view → resilient → paired simulation; exact formatted normal/minimum/sample coverage compared with intercepted API JSON; site explanation; stale controls; intentionally invalid request; methodology page; unexpected console/page errors rejected.
2. Mobile viewport 390×844, study loads and document width stays ≤390 pixels.
3. Observed Iowa crop with **Blended demand**, all planning/simulation stages, exact response-number comparisons, combined stress view, retrospective risk layer and actual held-out model metrics in methodology. No browser errors.

Screenshots were saved and visually inspected: `artifacts/workflow-desktop.png`, `workflow-mobile.png`, `workflow-iowa.png`. The audit's out-of-crop fitting issue was repaired and the final Iowa screenshot inspected again. The public static and resilience placements can coincide at these controls; the app displays that result without manufacturing an improvement. The fragile fixture provides the independently verified contrasting case.

Machine-readable final browser stats and timing are committed in `docs/browser_validation.json`. Automated browser testing is not the dossier's human usability study or ten human demo rehearsals.

### Reproducible data / ML executions

Executed successfully: `scripts.make_fixture`, `scripts.ingest` (public-data build and cached rebuild), `scripts.dot_snapshot`, `ml.train` (synthetic only), `ml.real_train` (observed Iowa), `scripts.precompute`, `scripts.experiments` and `scripts.benchmark`, all with `.venv/bin/python -m`.

Real graph: 19,205 nodes, 51,911 directed edges, 37 weak and 80 strong components. All 39 selected tract demands remain, population 127,326 from **2020**, max node snap 871.05 m. DOT current traffic snapshot: 6,676 records with explicit missing/sentinel/vintage audit. Real crash snapshot: 17,832 records, 14,693 inside selected tracts, no unmatched county tract geometries. Candidate resources, speeds without OSM tags, disruptions and added event demand remain assumptions.

Real ML: training 2020–2021 / selection 2022 / final future unseen-tract test 2023, with 2019 lag history. Forest validation MAE 2.163 led selection; final MAE 1.775 and RMSE 2.273. Poisson final MAE **1.750**, RMSE **2.239**. The forest does not beat every baseline on final data. Forecast layer is January 2024, not current risk. Fixture metrics remain in a separate report. Exact metric/hash/split evidence is in `ml_real_metrics.json` and `ml_fixture_metrics.json`.

`experiments.json` records 12 assumption-sensitivity cases plus four algorithm comparisons and site stability. The UI and API independently execute real Population/ML Risk/Blended normalization, with the full Blended browser workflow.

### Actual performance

`python -m scripts.benchmark` is a single measured sample under session load, not a hardware-independent guarantee. It includes validation/formulation where applicable; pure algorithm timings exclude HTTP, process startup and frontend rendering.

| Iowa operation (32 candidates / 39 demands) | Measured seconds |
|---|---:|
| Dataset graph load / validation | .254 |
| Normal matrix build from graph | 1.183 |
| Memory matrix hit including full input fingerprint | .160 |
| Six-scenario preparation after normal already cached | 5.709 |
| Static coverage, validation/formulation/solve | .0032 |
| P-median, validation/formulation/solve | .0354 |
| Shared resilience, validation/formulation/solve | .0060 |
| 10,000 trials × six scenarios × two placements | .0064 |
| Offline real ML inference, 39 forecast cells | .0020 |

See `benchmarks.json` for unrounded fixture/public timings and statuses. HTTP timings including worker startup, cache fingerprints, explanations and serialization are recorded separately in `api_benchmarks.json`; they are substantially larger than solver timings. A cold multi-scenario build takes seconds; precomputation makes normal local requests interactive. A 20-second job cap still applies.

Final headless browser navigation load was 72.2 ms; Iowa data-ready was 1,415 ms since navigation during the automated study switch; measured React/Leaflet commit plus two animation frames took 116.4 ms. These are local headless measurements, not a tested production service-level guarantee. Browser timing JSON is retained; no target from the notes is presented as a benchmark.

### Security scan results

| Scan actually run | Outcome |
|---|---|
| `.venv/bin/pip-audit --format=json --output=artifacts/pip-audit.json` | 76 dependencies, **0 known vulnerabilities**. |
| `npm --prefix frontend audit --json` | **0** info/low/moderate/high/critical vulnerabilities. |
| `.venv/bin/bandit -r backend ml scripts -f json -o artifacts/bandit.json` | **0 findings**, no skipped tests. |
| `detect-secrets scan --all-files` with README exclusions for dependencies/generated caches | 29 entropy findings reviewed as public content hashes/versions; **0 credentials**. Detailed review in `secret_scan_review.json`. No claim that the scanner alone proves absence of secrets. |

Raw outputs are in ignored `artifacts/`; committed summaries are in `security_scan_results.json`. No scan was blocked. ZAP, penetration testing, HTTPS/HSTS, deployed CORS/proxy behavior and distributed-worker rate limits were **not executed**.

### Failures encountered and resolved / exact blockers

Early test runs exposed floating arithmetic/reference-test indexing issues; corrected and rerun. The initial Playwright invocation used the wrong working directory/base URL; the package script fixes this, and all three tests now execute. The audit repaired geographical bounds and scenario-change reuse; meaningful regression coverage was added. No known failing functional check remains in the final local suite, which does not prove absence of bugs outside its coverage.

ACS API required a key (HTTP 302 missing-key redirect); official Census 2020 fallback succeeded. Overpass returned 406 and mirrors timed out; pinned Geofabrik succeeded. Actual 511 XML access needs an access request; no request/contact was made. Historical as-of reporting snapshots and current operational forecast validation are unavailable. No deployment or professional/human study was performed. The full source competition release gates are **not met**; see `audit.md` and `requirements.md`.
