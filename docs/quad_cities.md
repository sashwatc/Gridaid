# Quad Cities areas and point travel

Open **http://127.0.0.1:8000/**. The simple planner now supports a separate Iowa/Illinois study region around the five core Quad Cities. The original Iowa dataset, its published experiments, ML model and the Base44 prototype are preserved.

## Area selection

Use **Add a city** to combine Davenport, Bettendorf, Rock Island, Moline and East Moline. Selected city boundaries come from official Census 2020 incorporated-place geometry. **Whole Quad Cities** resets to the complete supported rectangle, including nearby communities represented in the data.

**Draw an area** supports dragging a box or tapping two opposite corners. Drag its center to move it and corners to resize it. The area stays inside 41.42–41.65°N / 90.73–90.34°W. City selection and custom boxes filter the original Census representative points and eligible facility locations used in the actual backend optimization. The full saved road network remains available, so a legal route may leave the chosen area and return. Changing the area cancels pending work and removes the previous recommendation.

The preview reports Census-point count, represented 2020 population and eligible locations. These are whole-tract weights at original internal points, not precise city or within-box population totals. City geometry can extend beyond the supported rectangle; the city option covers the portion represented by the saved study dataset. Empty areas and resource counts above the available distinct locations have explicit messages.

## Click a point

Click the background map, a population dot or a resource. Before calculation, the check uses mapped fire stations, hospitals and police stations in the selected area. After calculation, it uses only selected plan resources. It reports:

- Fastest reachable location, estimated driving time and modeled road/access distance.
- The second reachable location as a backup and its extra travel time.
- A blue road route and separate dashed assumed access legs.
- Normal-condition versus selected-test times when viewing the toughest test.
- The source OpenStreetMap object for a mapped facility.

Choose **Go from this point to a location** or **Send a resource to this point**. Direction matters on one-way roads. Coverage metrics use resource-to-demand travel; the point checker defaults to point-to-resource travel and labels the chosen direction.

The new `/api/route/point` operation uses the bounded compute gate, fixed road-segment attachment, legal partial directed edges, closures and scenario multipliers. A single seeded Dijkstra on forward or reversed adjacency finds all candidate times. It never substitutes straight-line distance for road routing. At road endpoints, other legal approaches remain usable; closing an interior attachment does not resnap it to another road. Access from the clicked point and facility to their road attachment remains an explicit assumed straight connector at the configured speed. It can cross barriers or property and is not a verified driveway/path.

The **largest population coverage gap** shortcut selects the highest-population representative point outside the target in the toughest test, switches to that condition and checks resource-to-point travel. This is a way to inspect weaknesses, not a claim about individual households or emergency need.

## Real data and provenance

The committed `data/public/quad_cities.json.gz` is approximately 6.5 MB and contains **42,732 nodes, 112,347 directed edges, 82 Census tract points, 287,608 people represented by whole-tract weights, and 30 mapped facility locations**. It includes all five core cities. Facility counts in the placement pool are Davenport 11, Bettendorf 6, Rock Island 6, Moline 5 and East Moline 2.

Roads and facilities come from dated [Iowa](https://download.geofabrik.de/north-america/us/iowa-261023.osm.pbf) and [Illinois](https://download.geofabrik.de/north-america/us/illinois-261023.osm.pbf) OpenStreetMap/Geofabrik extracts, both October 23, 2026. Border roads are deduplicated by original OSM identity before simplification. Original direction tags and speed tags are retained; missing speeds use disclosed class defaults. Facility tags are fire_station, hospital or police, with original source-object links. Nodes shared by duplicate facility records are deduplicated. This is not an exhaustive or professionally verified facility directory.

Tract populations/internal points and municipal geometry come from the official [Census 2020 TIGERweb service](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer). Scott County, Iowa and Rock Island County, Illinois supply the selected tract points. Exact queries, retrieval dates, raw SHA-256 hashes and source sizes are in [quad_cities_manifest.json](quad_cities_manifest.json) and the snapshot. Roads/facilities are ODbL; Census inputs are public domain. See `data/public/LICENSE.md`.

Mapped facilities are real source records; available resources, hours/services, snow/closures and access connectors are unverified assumptions. Times are modeled driving estimates with no live traffic, turn restrictions, dispatch delay or operational validation. The sparse representative points do not establish exact household coverage. No Iowa incident-risk model is applied to the new region.

Rebuild offline with `.venv/bin/python -m scripts.quad_cities`. Missing raw state extracts are downloaded only from fixed allowlisted URLs, bounded at 160 MB and 400 MB, and then hash checked. Combined raw inputs are about 496 MB and remain ignored; clean demo use needs only the committed snapshot. No user-controlled download endpoint was added. Large app responses now use gzip; the original request, rate, solver and job bounds remain.

## Executed checks

- **58 backend tests passed**, 30.69 s, with four existing dependency deprecations. Six new tests cover independently calculated directed partial-edge times, winter/access units, closures/endpoints, projection in a metric CRS, area filtering, both states/facility sources, and agreement between point travel and stored plan metrics.
- Strict TypeScript/production build passed: JS 458.88 kB / 139.64 kB gzip; CSS 43.98 kB / 13.32 kB gzip.
- The full **17-check Playwright run passed 16 checks**; the timeout test initially left its artificial 150 ms timeout enabled for its subsequent incomplete-solver assertion. Restoring the normal timeout between these negative cases fixed the test; its targeted rerun **passed**, 4.9 s. Every check therefore has a passing latest result. The app's normal 30-second timeout was unchanged.
- New actual-browser workflows verify combined city scope, drawing, corner resizing, center dragging, real scope/population inputs, stale-area invalidation, coverage-gap inspection, Illinois point results, alternate direction, backups/distances, actual satellite imagery and populated 320–1440 px layouts. Desktop/mobile screenshots were visually inspected. Existing Iowa/Blended, simulation races, map teardown, errors and stale-result checks passed.
- A cold direct Quad Cities static workflow measured 13.98 s; one direct point query measured 1.88 s. These are local samples, not availability or performance guarantees.
- `git diff --check` passed; local health returned `status: ok`. No public deployment was performed.

Raw ignored evidence is in `artifacts/pytest-quad-cities.xml`, `browser-quad-full.json`, `browser-quad-targeted.json`, `browser-quad-timeout.json`, `quad-area-route-desktop.png` and `quad-point-{320,390,768,1440}.png`. [Committed verification summary](quad_cities_validation.json) records the exact run outcomes. Initial browser work also corrected a click-suppression guard that briefly ignored clicks immediately after adding a city and changed large study-response capture to avoid Chromium inspector-cache eviction.
