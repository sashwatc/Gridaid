# Exact study geography and access audit

This audit uses the existing observed road/Census snapshot. It does not redefine the dataset as all Scott County or as exact emergency service coverage. Machine-readable records for **all 39 demands and 32 candidates** are in `geography_audit.json`; rebuild with `python -m scripts.geography_audit` using hash-checked source caches. Census 2020 incorporated-place geometry was retrieved from the official TIGERweb Census2020 layer 26; its URL, parameters, timestamp and raw hash are recorded in that report. Classifications refer to **2020 boundaries**.

## Three different boundaries

1. **Selection rectangle:** WGS84 latitude 41.50 through 41.63°N, longitude -90.70 through -90.48° (90.70–90.48°W), inclusive. Approximate projected area **265.008 km²**. This is the candidate selection/map frame and the test for including a tract's official internal point.
2. **Demand footprint:** the union of the **39 whole 2020 Scott County tracts** whose internal points fall inside that rectangle. Whole populations are retained, totaling **127,326 in 2020**. The union is **232.193 km²**, with **61.750 km² outside** the rectangle. Its bounds are longitude -90.742971 to -90.473937, latitude 41.452261 to 41.604075. Thus neither a rectangle population estimate nor all county population is modeled.
3. **Routing graph:** complete retained OSM ways with at least one vertex inside the rectangle, with private/no-motor-vehicle ways excluded, then degree-two simplification. Its exact retained-geometry bounds are longitude **-90.8533837 to -90.4350060**, latitude **41.4626349 to 41.7424420**. This is an irregular buffer, not the tract union, rectangle clip, whole county or a complete regional road network. Paths near its boundary can be truncated.

There are no demand points in much of the rectangle's northern strip, despite northern candidate sites. Candidate generation is independent of demand and constrained to the largest strongly connected road component inside the rectangle. Other components and all selected demand remain in the evaluation.

## Which communities are represented?

| Community at original point / candidate node, 2020 place boundaries | Demand internal points | Assumed candidate sites |
|---|---:|---:|
| Davenport | 31 | 20 |
| Bettendorf | 7 | 5 |
| Unincorporated Scott County | 1 | 6 |
| Eldridge | 0 | 1 |

Selected whole-tract geography overlaps **Davenport (148.141 km²), Bettendorf (18.421 km²), Buffalo (10.463 km²)** and unincorporated land. Buffalo has **no selected internal point**; its represented land is part of a whole tract weighted at an internal point elsewhere. Eldridge has one candidate and no selected demand-tract overlap. Queried Blue Grass and Riverdale place geometries have zero selected-tract overlap. The graph buffer may contain roads in other communities; that does not add their population or make this county-wide analysis.

These are geometric classifications and area intersections, **not municipal population counts or percentages served**. Tracts can span a city boundary. An internal point is neither a household location, necessarily the polygon centroid, nor an exhaustive representation of the tract's travel-time distribution. Household access and inequity within tracts cannot be inferred.

## What was wrong with snapping?

Previously, every tract was relocated to its nearest **retained road node**, and routing assigned **zero travel time** between the original internal point and that node. The map also plotted demand at that relocated node. Only `snap_m` was retained; no original coordinates or access-time model accompanied results. This materially changed interpretation of a five-minute threshold.

The current snapshot preserves original coordinates, road projection coordinates, legacy node/gap, community classification and directed partial-edge attachments. Demand symbols show original internal points. The **Access** map layer shows dashed straight connectors explicitly labeled as unverified paths.

- Old median point-to-node gap: **59.095 m**; new median point-to-road gap: **36.440 m**.
- **31** points now use road-interior terminal approaches; the other **8** project onto existing endpoints. No through-road or reverse one-way connection is created.
- Maximum remains **871.046 m**, tract **19163012601**, population weight **5,484**, original internal point **41.5904964, -90.6380320**. The nearest retained eligible road is a service-road endpoint near **41.5839618, -90.6438068**. This is not merely a simplification/junction artifact. Private/excluded roads and barriers may explain gaps, but no legal driveway/path was validated.
- Examples of avoidable junction displacement: tract 19163012501 goes from **287.48 m** to **44.30 m**; 19163012602 from **216.92 m** to **56.67 m**; 19163012701 from **203.17 m** to **67.03 m**.
- Candidate snap distances are exactly **zero by construction**: candidates are invented road-node locations. There are no original observed facility coordinates being snapped, so zero does not validate real facility access or suitability.

Original/road distances are measured in **EPSG:26915 meters**. Along-road fractions use geodesic lengths along the preserved geometry. A point on a one-way segment is reached only from a legal upstream endpoint plus the segment fraction; reverse access exists only when an actual reverse edge exists. Closures exclude those edges; endpoint targets can still be reached via other open roads. Interior access stays fixed before scenarios; a closure can make that particular access segment unreachable. No automatic relocation to a more convenient open road occurs.

## Included access time and uncertainty

Default total modeled time is source-node road travel + legal partial-road arrival + **straight connector distance / assumed 20 km/h access speed**. A hypothetical candidate snap gap would be added too; actual candidates have none. Winter multiplies road and connector seconds equally. These connectors are **illustrative lower-bound distances**, not verified navigable lines across property, water, fences or terrain. Twenty km/h is a declared low-speed access assumption, not an observed or professionally calibrated emergency speed.

At the largest gap, connector time alone is **2.61 minutes at 20 km/h**, **10.45 minutes at 5 km/h**, or **1.31 minutes at 40 km/h** in normal conditions; at winter 1.6× these become 4.18, 16.72 and 2.09 minutes. It is unjustified to hide this uncertainty inside an exact coverage claim. The UI exposes access mode/speed, and changes invalidate old results. Road-only explicitly omits connector time as an optimistic diagnostic.

## Quantified sensitivity

The full `real_demo_results.json` retains **both fixed-placement and reoptimized** comparisons for road-only, connectors at 5/20/40 km/h, and the legacy junction/zero-access method. No households or demand weights are dropped. The following uses the **same four-resource placements chosen under 20 km/h**, threshold 5 minutes and the chosen four-state winter/central-closure portfolio:

| Access assumption | Static normal / average / worst coverage | Resilient normal / average / worst coverage |
|---|---|---|
| Legacy junction, zero access | 78.22 / 51.37 / 23.62% | 70.45 / 55.08 / 38.80% |
| Correct directed road arrival, zero connector | 78.22 / 51.00 / 23.62% | 70.45 / 55.08 / 38.80% |
| Connector 5 km/h | 65.25 / 41.29 / 17.72% | 57.55 / 42.04 / 25.63% |
| Connector **20 km/h default** | 78.22 / 50.74 / 23.62% | 67.24 / 53.47 / 38.80% |
| Connector 40 km/h | 78.22 / 51.00 / 23.62% | 67.24 / 53.47 / 38.80% |

The fixed resilient placement loses **13.17 percentage points** of worst-case weighted-point coverage at 5 versus 20 km/h. Reoptimization results, all selected IDs, scenario-specific unreachable shares and solver proofs are available in the JSON; do not substitute those reoptimized results for this fixed-layout sensitivity.

The largest remaining geographic limitation is spatial resolution: even perfect point-to-road access cannot establish how all residents or incidents within a tract would fare. Finer public demand units, verified access/turn restrictions and a wider graph buffer would be needed for stronger geographic claims.
