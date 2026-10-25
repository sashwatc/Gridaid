# Connected frontend polish

Continued from `2d77938` on `frontend-polish`. The runtime remains the React/TypeScript app in `frontend/`, served by FastAPI. The separate root Base44 prototype still awaits backend integration and was left intact. Backend algorithms, requests, assumptions, datasets, ML selection, forecasts and result values were preserved.

## Changes

- Increased text sizes and contrast, placed coverage values outside solid bars, added a shared percentage scale, and replaced tiny histogram labels with readable bins and exact API incident counts. Narrow screens use three axis ticks to avoid overlapping labels.
- Moved the four workflow actions to a persistent bar with the next step and prerequisite explanations. Mobile assumptions collapse independently, keeping the preset and actions available. Keyboard focus, a skip link, expanded-state labels, table captions and scrollable simulation results improve navigation.
- Added Latest / Baseline / Static / Resilient placement controls. Switching uses stored runs and updates selected sites, coverage, travel statistics and explanations together, without sending another calculation request. Comparison cards can return to a specific placement on the map. Unavailable placements are disabled; invalidated selections return to Latest.
- Added offline geographic context using the snapshot's audited community assignments, road classes, selection rectangle, coordinates, metric scale, north indicator and fit control. Community labels anchor point clusters rather than claiming city-center coordinates or municipal boundaries. Optional online OSM tiles remain off by default. The synthetic fixture is clearly labeled invented geography.
- Resolved scenario IDs to API-provided names in cards, charts, explanations and simulation summaries. Run exports retain original IDs and solver evidence.
- Replaced ambiguous infinity/no-demand labels with separate No demand, No reachable demand and Unbounded (unreachable demand) messages. Explain the actual unreachable share and keep the conditional reachable-only mean separate. No travel statistic is recomputed in the frontend.
- Added calculated baseline-to-static and static-to-resilient summaries using differences of unrounded API normal, average and minimum coverage. Display signed percentage points and explicitly report equal site sets. The real preset shows **−11.0 pp normal / +2.7 pp average / +15.2 pp minimum** for resilient versus static.
- Split the original large component into a request/state hook, API and presentation helpers, controls, workflow, map, comparison, placement details, simulation and methodology. Kept signature/abort/trial-count guards and synchronous Leaflet zoom fitting; added controller identity checks to avoid older requests clearing newer state.

## Executed verification

The local built app was started with `./scripts/serve.sh` at **http://127.0.0.1:8000/**. Health returned `{"status":"ok","version":"0.1.0"}`. No public deployment was performed.

| Check | Actual result |
|---|---|
| `.venv/bin/pytest -q --junitxml=artifacts/pytest-frontend-polish.xml` | **52 passed**, 28.07 s; five warnings (four existing FastAPI/OR-Tools deprecations plus a joblib physical-core detection fallback in this sandbox) |
| `npm --prefix frontend run build` | Strict TypeScript and Vite passed; final JS 425.15 kB / 128.92 kB gzip, CSS 31.66 kB / 10.52 kB gzip |
| Final `npm --prefix frontend run test:browser` | **9 passed**, 48.8 s after resuming the session: eight actual Chromium workflows plus one travel-label formatting check, no skips/failures |
| Earlier `npm --prefix frontend run test:browser -- --grep 'populated mobile'` | **1 passed**, 3.9 s, after final narrow-axis spacing adjustment; verifies nonoverlapping ticks and refreshes responsive screenshots |
| `git diff --check` | Passed |

The original five browser workflows remain unchanged and pass, including fixture errors/stale results, Iowa Blended/ML metrics, repeated layer/zoom/navigation teardown, and an actual delayed simulation response while trial count changes. Three new browser workflows verify real-preset tradeoffs, every chart coverage value, readable scenario names, placement switching without POST requests, per-placement travel statistics/explanations, exact simulation statistics/histogram counts, equal greedy site sets, keyboard assumptions controls and populated layouts at **320, 390, 768, 1024 and 1440 px**. A separate formatting check covers no-demand and unreachable-only states not produced by the shipped demo workflow. No successful solver response was mocked.

Screenshots were visually inspected for the Iowa map, coverage chart, populated desktop/tablet/mobile layouts and 320 px chart-axis spacing. Initial new tests had two selector errors (case-sensitive placement names and wrapped-select label matching), both corrected; all five original tests passed that run. The first browser attempts needed the lockfile's Chromium install and macOS launch permission. These environment/selector failures are not hidden as passing app runs.

Raw screenshots/API evidence/reports are ignored under `artifacts/`: `polish-preset-viewport.png`, `polish-preset-chart.png`, `polish-viewport-*.png`, `polish-chart-viewport-*.png`, `polish-api-evidence.json`, `pytest-frontend-polish.xml`, `browser-polish-full.json` and `browser-results.json` (final full suite). `browser-polish-responsive.json` preserves the earlier targeted layout check. The strict TypeScript/production build passed again after resuming, with the same output sizes. Input hashes and the diff against `2d77938` confirm that backend, ML, datasets, published results and the root Base44 files remain unchanged.

## Remaining issues

- Base44 integration remains pending; this change does not connect or replace the separate prototype.
- Online street/river tiles require connectivity. Offline place labels and road/boundary context work without tiles; labels are not municipal boundaries.
- Broad accessibility certification, human/expert studies, operational calibration and public HTTPS/deployment validation remain unperformed. Existing representative-point/access-path, scenario-assumption and retrospective January 2024 ML limitations still apply; see the audit and model card.
