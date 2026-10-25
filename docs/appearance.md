# Imperial display, themes and calculation activity

The app at **http://127.0.0.1:8000/** now displays travel distance in miles, short distances/access gaps in feet, access speed in mph, and imperial-only map scales. The detailed workspace uses the same units. Geographic coordinates and time units are unchanged.

Backend/API/export units remain meters, seconds and km/h so datasets, routing, optimization, ML weights and published results preserve their established meaning. The UI boundary uses exact definitions: 1 mile = 1,609.344 meters and 1 foot = 0.3048 meters. The default 20 km/h access speed displays as 12.43 mph without changing its unrounded value. A user-entered 5 mph becomes 8.04672 km/h in the actual request. Point cards, backup distances, road-access explanations, tooltips, map scales and methodology share these display conversions.

## Dark mode

The header toggle works in both interfaces. The device preference sets the initial theme; an explicit choice persists in local browser storage across reloads and navigation. Storage failures do not disable the toggle. Small screens use the same labeled button with an icon to preserve header space. Dark colors cover forms, results, charts, tables, map controls, road-map background and explanations. Satellite imagery keeps its original colors. Desktop and mobile layouts were visually inspected.

## Model activity

A calculation-input panel stays visible and shows the current request stage while calculating. Population calculations are labeled as population, including when a study happens to contain an unused forecast. The synthetic fixture is identified as invented data.

The Quad Cities dataset has no evaluated incident model and is explicitly marked **No ML**. Its panel links to `/?view=advanced&dataset=iowa&demand=blended`, which opens the original Iowa study with Blended demand selected. In that view, when the report/model versions match, the panel identifies the actual selected estimator (currently random forest), model version, population/forecast weights and January 2024 forecast period. It describes saved predictions being applied, not live training. A 100% population blend correctly reports zero ML contribution. The existing held-out evaluation and model-selection limitations remain; no model was retrained or extended to Illinois.

## Road animation

During planning or point-query requests, animated cyan traces follow connected segments of the saved road graph. The bounded walks are decorative activity, not solver iteration telemetry, candidate decisions or a calculated route. Actual point routes remain the separate API-derived blue route. The activity badge makes that distinction available, and the traces stop on completion, failure or cancellation.

Reduced-motion preferences show static traces and indicators. SVG renderers are explicitly removed when their activity layer unmounts, using public Leaflet APIs. Tests exercise leaving and returning to the map while a response is pending, changing controls to cancel, and releasing the late response without stale activity or map errors.

## Executed verification

- `npm --prefix frontend run build`: strict TypeScript and Vite passed. Final connected-trace build: JS 465.99 kB / 141.93 kB gzip; CSS 52.80 kB / 15.20 kB gzip.
- `npm --prefix frontend run test:browser`: **21 passed**, 172.05 s, no failures/skips/flaky tests; 19 browser workflows plus two formatting/conversion checks.
- Final `tests/appearance.spec.ts` rerun: **4 passed**, 29.82 s, after the connected-street visual refinement. It covers dark persistence, actual imperial/API values, active Iowa ML inputs, zero ML weight, reduced motion and map teardown.
- `.venv/bin/pytest -q tests/test_region_and_routes.py`: **6 passed**, 14.70 s, one existing dependency deprecation. Routing mathematics and area behavior are retained; only an out-of-range access-distance error was changed to miles.
- The original algorithms, numerical units, backend schemas, model/data artifacts, dependencies and root Base44 code were checked unchanged against `4d4c769`. No public deployment occurred.

Initial appearance checks caught an SVG path class supplied after initialization and an unfinished intercepted request in a test. The class now reaches Leaflet at path creation, renderers are cleaned up, and tests await completion of deliberately held responses. The final full run passed after those corrections.

Raw evidence remains ignored under `artifacts/`: `browser-appearance-full.json`, `browser-appearance-final.json`, `appearance-dark-calculating.png`, `appearance-dark-{320,390,768,1440}.png` and `appearance-ml-status.png`.
