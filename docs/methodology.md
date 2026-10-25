# Modeling methodology

## Scope and units

The application compares geographic access, not actual response time, clinical benefit or dispatch performance. Roads are directed multigraph edges. Length is meters, speed km/h, and edge time is `length_m * 3.6 / speed_kph` seconds. All optimizer thresholds convert minutes to seconds once. OSM maxspeed mph converts with 1.609344; missing or nonnumeric speeds use class defaults in `scripts/ingest.py`. These speeds are assumptions, not emergency-vehicle observations. Turn restrictions, capacity, dispatch delays and queues are absent.

The Iowa graph uses a dated Geofabrik OSM extract. Original OSM node identity preserves grade-separated intersections; crossing geometry is not automatically connected. OSMnx contracts degree-two paths only when speed, source and road class agree, sums lengths, preserves direction/parallel edges, and retains isolated rings. All disconnected demand remains in the denominator. Candidate sites are synthetic, spatially spread nodes on the largest strongly connected component inside the study crop. Full intersecting ways provide a routing buffer. The map focuses on the declared crop, not the full extent of those ways.

## Demand

The exact boundary/community/snap audit is in [geography.md](geography.md). There are 31 original internal points in Davenport, 7 in Bettendorf and 1 unincorporated point; these are not municipal population totals. Selected tract geometry also overlaps Buffalo, and one candidate lies in Eldridge without an Eldridge demand point.

2020 Census `POP100` is assigned to each tract's official internal point and projected to a fixed road segment/endpoint in EPSG:26915 (NAD83 UTM zone 15N). Include whole tracts whose internal points lie in the Davenport crop; this is a representative-point approximation, not exact population inside a bounding rectangle. Population totals are retained. Snap distances above 2 km reject a build. Tract sizes and within-tract access are not resolved.

Population uses raw counts. ML risk uses nonnegative predicted transportation incident counts divided by their sum. Blended uses `lambda * normalized_population + (1-lambda) * normalized_risk`. Coverage is always the fraction of **that scenario's** total weight covered. Scenario averages weight scenarios equally, regardless of their total population. A zero-total scenario has zero coverage and explicit `no_demand=true`; no artificial incidents are sampled. These are policy conventions, not evidence of service failure.

## Routing and caches

Student-built heap Dijkstra uses a directed adjacency list, stale-entry checks and predecessor edges. Every parallel edge participates independently. Closures remove named edges and winter multiplies edge seconds. Unreachable entries remain positive infinity internally. A road-interior target uses only legal upstream approaches and the traversed edge fraction; closures remove those approaches. Default travel additionally includes a straight access connector at an explicit assumed 20 km/h, scaled by winter too. The original internal point and road projection are both retained. This unverified straight leg may cross barriers/private land; it does not establish navigable household access. Road-only mode is a labeled optimistic diagnostic. Access mode/speed are attached to runs and cache keys.

At the JSON boundary travel is `null`, accompanied by unreachable shares and a no-demand indicator. Never replace these with straight-line distances.

The cache key hashes full dataset contents (including graph geometry/units, ordered candidates/demand, model version and weights), full scenario definition, demand mode/blend and algorithm version. Memory arrays are read-only. Disk matrices have shape/value checks and a SHA-256 manifest; corruption triggers rebuilding. At most 32 memory and 64 disk entries are retained. Run simulation also checks all current matrix keys against its stored run keys. Different definitions cannot silently change an old result's evaluation.

## Placement objectives

All methods choose exactly `p` distinct sites. Deterministic baseline picks the first `p`; random chooses without replacement from a seeded generator. Greedy repeatedly adds the site with greatest marginal weighted coverage; candidate order breaks ties. It is labeled heuristic.

Maximum coverage uses binary site variables and binary demand coverage variables constrained by reachability within the inclusive threshold. Its objective is raw weighted covered demand. P-median assigns every demand point to a selected site and minimizes weighted seconds. Unreachable assignment costs a penalty `max(86400, largest finite matrix trip + 3600)` seconds. This preserves unreachable demand and makes the penalty exceed all finite modeled trips. The penalized solver objective is separate from actual unconditional travel metrics; it is not a measured trip time.

OR-Tools/SCIP runs with one solver thread and a request-bounded time limit. Results report optimal, feasible, not solved, infeasible or another solver status, runtime, best bound and relative gap when meaningful. Optimal is used only for SCIP's proof status. A no-solution result does not become a valid placement or a simulated comparison.

## Shared resilience decision and scenarios

One shared set of site variables is used for the entire scenario portfolio. Each scenario has separate coverage variables and its own matrix/demand. The default objective is `0.6 * mean(coverage_s) + 0.4 * min(coverage_s)`. The two nonnegative weights sum to one and are exposed in the UI. No independent scenario placements are substituted for this decision.

All prepared disruptions have `synthetic_demo_assumption` provenance, including when applied to observed roads. Normal is unchanged. Winter assumes 1.6× travel seconds. The fixture closure removes the short bridge in both directions. The public closure removes arterial edges in the prepared central corridor; exact IDs are attached to runs. A fixed location outage disables C1 across every placement, whether selected or not; no replacement is added. Event demand adds 50% of base demand at a northern **in-crop** node; for ML it adds assumed forecast-count mass equal to 50% of base predicted counts. Combined stress applies all four changes. Disruptions copy input definitions; they never mutate the base graph.

A resilient configuration may sacrifice normal coverage, average coverage or another travel statistic. Only its stated objective is optimized. No universal improvement is promised. `scripts/experiments.py` records resource counts, thresholds, winter factors, alternate corridors/outages and objective weights. Population/risk blend is tested numerically and exercised on the Iowa API/browser workflow.

## Metrics and simulation

Deterministic coverage sums weights within threshold divided by all demand weight. Weighted quantiles use the inverse empirical weighted CDF. Any positive unreachable weight makes the unconditional mean infinite (`null` in JSON). Quantiles can remain finite when enough weight is reachable. `reachable_mean_s` is conditional and never substituted for the unconditional mean.

Simulation defaults to 10,000 incidents. A scenario-specific SHA-256-derived seed sequence and the requested seed determine one sample, shared across all configurations. Portfolio ordering cannot change a scenario's incident sample. Scenario failures are already applied to the matrix, so disabled resources cannot serve incidents. All configurations use the same controls, dataset/model versions and scenario definitions.

Sample statistics use NumPy-style linear empirical quantiles, with explicit infinite handling. They differ slightly from deterministic weighted quantiles. Coverage is sampled separately from deterministic coverage. The histogram includes reachable incidents only; unreachable share and unconditional null statistics remain visible. Portfolio average/minimum/worst scenario are reported separately for weighted and sampled coverage. These are modeled incidents, not observed emergency outcomes.

## Explanations

Unique coverage is demand covered by a site alone in the final normal placement; it equals normal leave-one-out coverage loss without replacement. Marginal contribution is incremental insertion-order coverage and is order dependent. Redundancy counts demand shared with another selected site and can overlap across site explanations. Weak areas are served locations taking more than half the threshold from that site.

Scenario contributions are normalized coverage lost when removing a site without replacement. Worst-case contribution recomputes the portfolio minimum after removal, so the identity of the worst scenario can change. Selection stability is the fraction of independent single-scenario coverage solves selecting the site, with reference statuses attached. It depends on ties and solver limits; it is not physical availability or a calibrated probability.

ML features and validation are described separately in the model card. Feature importance describes predictive sensitivity and does not establish causation.

## Real-data comparison supplement

The four-state Normal/Winter/Closure/Winter+closure experiment is an additional road/weather portfolio, distinct from all six original required scenarios. The standard scenarios remain available. Winter factor and central/east arterial closure zone are typed bounded controls; exact definitions accompany runs. The 12 predeclared real cases and access sensitivity are in real_demo_results.json and real_data_results.md. Four cases have identical static/resilient selected sites. The chosen p=4, 1.6× central-closure preset trades 10.975 percentage points of normal coverage for 15.183 points of worst coverage. No outage/event is included in that portfolio. No universal improvement or scenario likelihood is claimed.
