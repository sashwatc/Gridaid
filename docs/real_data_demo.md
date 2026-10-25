# Reproducible real-data demonstration and five-minute walkthrough

Browser: **http://127.0.0.1:8000/**. Start or reuse `./scripts/serve.sh`. Click **Load real-data demo preset →**; it loads controls, not fabricated results. Each action still calls the actual solver/API. Preset dataset identity is checked server-side; stale presets return an error. Rebuild with `python -m scripts.real_demo` after a data change.

## Predeclared experiment

Before solving, fixed the grid to resources **2, 3, 4**, winter factors **1.25, 1.6**, closure zones **central, east**: **12 cases**, all Population demand, five-minute threshold, exactly p sites, default 0.6 mean / 0.4 worst coverage, 20 km/h access connectors. Every configuration is evaluated in the same **Normal, Winter, Closure, Winter + closure** portfolio. No resource failure or added event is present in this comparison. Default six-scenario/p=3 results are separately retained in `real_demo_results.json`.

All conditions and candidate resources are assumptions applied to observed OSM roads and 2020 Census weights. Central closure removes arterial edges whose endpoint midpoint is within longitude -90.578 to -90.570, latitude 41.52–41.56; east uses longitude -90.534 to -90.526, latitude 41.535–41.575. Reverse/parallel edges with matching endpoint pairs are also removed. These **zones**, respectively **277 / 84 directed edges**, can close multiple roads. They model a hypothetical major corridor disruption; they are not verified roadworks, floods or current alerts. Exact closed IDs and geometry-based definitions are in the result JSON. Winter slows all roads/access legs uniformly; no observed winter calibration is claimed.

Preset selection rule: choose the largest worst-case gain over one percentage point among cases with positive normal loss, breaking ties by smaller normal loss/resource count. Publish all other cases, including coincidences. This is a transparent demonstration selection, not independent evidence that the preset assumptions are likely or the plan is operationally best.

## Chosen case: p4-winter1.6-central

| Configuration | Normal coverage | Scenario average | Worst coverage | Worst scenario |
|---|---:|---:|---:|---|
| Assumed deterministic baseline | 37.898% | 22.188% | 8.486% | Winter + closure |
| Static, proven optimal | 78.220% | 50.736% | 23.616% | Winter + closure |
| Shared resilient, proven optimal | 67.245% | 53.475% | 38.799% | Winter + closure |

Normal tradeoff: **-10.975 pp**; worst-case gain: **+15.183 pp**. These are weighted **representative-point** percentages, not exact percentages of households reached.

Baseline sites C1/C2/C3/C4 are the first four assumed candidate nodes, not observed current resources. Static selects C1/C11/C18/C25; resilient selects C1/C9/C27/C30 under the pinned solver/data. If tied optima yield different sites on another platform, compare objectives and metrics, not a mandatory set identity.

## All evaluated cases

The [full normal/average/worst table](real_data_results.md) shows all three layouts in every case, not only the differences below.

`real_demo_results.json` contains every baseline/static/resilient normal/average/minimum metric, selected IDs, per-scenario metrics, objective, bound/status, runtime and access sensitivity. The four 1.25× cases at p=2/3 select identical static/resilient sites. No such case is omitted. The following differences compare resilient against static in each case; positive worst gain and positive normal loss describe a tradeoff:

| Resources | Winter factor | Closure | Normal coverage lost (pp) | Worst coverage gained (pp) | Same selected sites? |
|---:|---:|---|---:|---:|---|
| 2 | 1.25 | central | 0.00 | 0.00 | yes |
| 2 | 1.25 | east | 0.00 | 0.00 | yes |
| 2 | 1.60 | central | 6.33 | 10.58 | no |
| 2 | 1.60 | east | 6.33 | 6.19 | no |
| 3 | 1.25 | central | 0.00 | 0.00 | yes |
| 3 | 1.25 | east | 0.00 | 0.00 | yes |
| 3 | 1.60 | central | 6.33 | 10.58 | no |
| 3 | 1.60 | east | 6.33 | 6.19 | no |
| 4 | 1.25 | central | 2.62 | 11.59 | no |
| 4 | 1.25 | east | 4.01 | 4.80 | no |
| 4 | 1.60 | central | 10.97 | 15.18 | no |
| 4 | 1.60 | east | 4.01 | 10.61 | no |

## Five-minute walkthrough

**0:00–0:45 — Set scope.** Open the URL and click **Load real-data demo preset →**. Confirm Study area **Davenport / Scott County · public crop**, Resources **4**, Threshold **5**, Static objective **Maximum weighted coverage**, Demand **Population**. Advanced controls: Baseline **Deterministic**, Static solver **OR-Tools / SCIP**, Average weight **60%**, Winter **1.6**, Closure **Central corridor**, Point access **Road + assumed access connector**, Access speed **20**, Seed **42**, Trials **10000**. Check only **Normal / Winter slowdown / Major corridor closure / Winter + closure**. Explain that 39 tract weights are not all Scott County or household locations.

**0:45–1:30 — Establish baseline/static.** Click **1 Load baseline**, wait for completion, then **2 Static optimize**. The baseline normal/worst cards show about **37.9 / 8.5%**; static **78.2 / 23.6%**. Expand **Solver evidence & export**: static status must be optimal (or transparently feasible under a different limit), bound/gap and real run identity are attached.

**1:30–2:15 — Disrupt the same static sites.** Set **Stress-test view → Winter + closure**. Keep **Roads / Disruptions / Coverage** on; optionally turn Candidates off for clarity. Roads in red are the assumed zone. Turn **Access** on to show original Census points and dashed assumed connectors. No fresh static placement is calculated for this disruption.

**2:15–3:00 — Shared resilient placement.** Click **3 Resilience optimize**. Read normal coverage **67.2%**, scenario average **53.5%**, worst **38.8%**. Compare static **78.2 / 50.7 / 23.6%**. State the normal-condition sacrifice and worst-case gain together. Choose a **Selected site** to inspect calculated unique/marginal/overlap and scenario contribution. Turn **Improvement** on to view gains/losses against baseline; it is not a household service-area map.

**3:00–4:00 — Paired simulation.** Click **4 Simulate & compare** (10,000 trials, seed 42). Read sampled coverage separately from weighted coverage. The same incidents are used for all three layouts within each scenario. Show distribution/p95, unreachable share and the clearly conditional reachable-only mean. Do not replace infinite unconditional mean with a finite conditional one.

**4:00–5:00 — Limits and reproducibility.** Change Access speed to **5**: results become stale and downstream actions disable. Explain the fixed-layout sensitivity (resilient worst **38.8% → 25.6%**). The JSON reports reoptimized sensitivity too. Switch to **Methodology & trust** and show the **January 2024 retrospective** model date and reporting-latency limitation. Forest won validation; **Poisson had lower final-test MAE** (1.750 versus 1.775). This does not retune the selected forest. Finish with the all-case table, including four coincidences, rather than suggesting resilience always changes the answer.

The synthetic two-corridor fixture and the hand-calculated fragile bridge test remain separate teaching examples; neither is presented as observed Iowa evidence. No video/submission/public deployment has been created.
