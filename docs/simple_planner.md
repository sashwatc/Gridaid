# Simple community planner

The default React/FastAPI app at **http://127.0.0.1:8000/** now starts with the real Iowa study area. Its primary flow is two inputs and one action: resource count, travel-time target, **Find a plan**. The previous research workspace remains available through **Detailed tools** (`/?view=advanced`). The separate Base44 prototype remains separate.

## Answer and map

The action calls the existing baseline, static and resilient endpoints sequentially with identical settings from the version-checked demo preset. A result is shown only after all three return complete, usable placements. The recommendation is the returned run with the highest existing resilience score (60% average coverage, 40% minimum coverage); the resilience placement wins an exact tie. This is the best of the three tested plans for these assumptions, not an unqualified operational or universal optimum.

The answer gives the resource locations, normal-day and toughest-test coverage, and the signed tradeoff against the normal-day placement. Equal site sets are reported directly. Coverage stays tied to weighted tract representative points and assumed access connectors, not individual homes. Suggested sites are possible planning locations, not verified emergency facilities.

Selecting a numbered location focuses the same point on the map. Users can view normal or toughest tested conditions, hide coverage, fit the study area, and switch between satellite and road backgrounds. Satellite tiles use [Esri World Imagery](https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer), with the service's source attribution shown on the map. The imagery was actually fetched in Chromium; it is not a screenshot or live emergency feed. Community labels, demands, closures, selected sites and offline roads come from the saved study dataset.

## Failure handling

- Initial data failures show **Retry loading**. Failed calculations show a readable error and **Try again**.
- Requests have a 30-second timeout. Busy services, rate limits, non-JSON or malformed responses, and disconnections have specific messages.
- Invalid or empty inputs cannot submit. A new click cannot overlap an active calculation. Cancel or editing either input aborts the request chain, clears the prior answer, and prevents a late response from reviving it.
- An incomplete solver result is never labeled a complete plan. No substitute placement or metric is generated in the browser.
- Three imagery errors or a 12-second initial imagery timeout switch to the saved road network. **Retry satellite** starts a new tile request. Losing imagery does not prevent API calculations. Losing the backend still requires recovery; the app does not invent an offline answer.

The only backend change is an exact `img-src` permission for `https://services.arcgisonline.com`. Optimizer, routing, simulation, datasets, ML selection, published results and compute/rate limits are preserved. Security headers continue to restrict scripts and API connections to the app's origin.

## Checks

Browser checks exercise the single-action real API workflow, selection and map conditions, actual satellite loading and attribution policy, populated 320–1440 px layouts, failed-calculation retry, failed-initial-load retry, offline imagery, invalid controls, late responses after edits, rate limits, disconnections, timeouts and incomplete solver output. The previous detailed-workspace regressions still run against `/?view=advanced`.

Executed final checks:

| Command | Result |
|---|---|
| `.venv/bin/pytest -q --junitxml=artifacts/pytest-simple-planner.xml` | **52 passed**, 16.48 s; four existing dependency deprecations |
| `npm --prefix frontend run build` | Strict TypeScript and Vite passed; JS 443.96 kB / 134.91 kB gzip, CSS 40.67 kB / 12.55 kB gzip |
| `npm --prefix frontend run test:browser` | **15 passed**, no failures/skips/flaky tests; 14 browser workflows and one travel-formatting check |
| `git diff --check` | Passed |
| Local `/api/health` | `status: ok` |

The first targeted run exposed a React-Leaflet container class that did not update when switching backgrounds. Moving the background class to a React-owned wrapper fixed both background switching and offline styling. The first full run then found an 18 px overflow from the detailed workspace's new return link at 320 px. The compact header was corrected; all 15 checks passed in the final full run without weakening the width assertion.

Ignored raw evidence: `artifacts/browser-simple-planner.json`, `pytest-simple-planner.xml`, `simple-planner-desktop.png` and `simple-planner-result-{320,390,768,1440}.png`. Desktop and mobile screenshots were visually inspected. Snapshot/report bytes and tracked algorithm/API/schema/ML/Base44 paths were checked against `74c174b`; unchanged except for the documented security-header permission.

Automated checks and screenshot inspection do not establish universal availability or a human usability study. Existing study-area, access-path, scenario and retrospective-model limitations remain. No public deployment is part of this change.
