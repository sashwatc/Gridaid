# Continuation audit: reports checked against code and counterexamples

The previous audit is retained below as history, not accepted as proof of the current code. Both original sources, README, validation and requirement matrix were read; the original 42 tests were rerun successfully before changes. Existing directed-routing/NetworkX, 56-configuration static and tiny multiscenario brute-force evidence remains valid. Final continuation run: **52 backend tests, 4 Chromium tests, strict frontend type/build passed**.

## Confirmed defects and actual repairs

1. **Hidden zero-access relocation:** original Census internal points were lost and assigned zero time to a road node, including a genuine 871 m gap. Preserve coordinates, approach the nearest fixed road segment in a legal direction, include an explicit assumed access leg by default, draw original points/connectors, and publish access sensitivity. This does not validate legal paths or households. Independent terminal-edge/closure/winter/unit and projected-geometry tests pass.
2. **Cancellation bypassed computation capacity:** cancelling an awaiting request released the gate while physical work continued. A blocked-worker/cancel/new-request counterexample failed before the fix. Tracked shielded jobs now hold slots until work finishes.
3. **Partial IPC bypassed the deadline:** poll() could succeed after just a frame header and recv() then block beyond the deadline. A deliberately stalled partial-frame worker failed the former implementation. Receive is now bounded by the same deadline, with termination/join cleanup.
4. **Cache eviction read race:** a file removed between existence check and read caused an error. The independent eviction counterexample failed, then passed after treating it as a cache miss. Loading now uses the exact hash-verified bytes, and concurrent eviction enumeration tolerates disappearance.
5. **Simulation control race:** an actual delayed backend response revived the 10,000-trial result after the control changed to 20,000. The new browser test reproduced the failure with the guard removed (artifacts/browser-race-before.json), then passed with abort/trial-count checks.

The geographic access work also exposes bounded winter and closure-zone controls plus a road/weather-only portfolio. Scenario metadata, exact definitions, cache inputs and run configuration remain attached and isolated. No solver, routing, baseline or simulation endpoint was replaced by a mock. The browser race test delays an actual fetched response only to reproduce the race.

## Geographic findings / honest real demonstration

See geography.md/json for the full audit: 39 whole-tract weights (31 Davenport internal points, 7 Bettendorf, 1 unincorporated), and 32 invented road-node sites (20 Davenport, 5 Bettendorf, 1 Eldridge, 6 unincorporated). Selected tract geography includes Buffalo even though no Buffalo internal point is selected. The selection rectangle, selected tract union and irregular graph buffer differ materially. Original point-to-road access is now included under an explicit default 20 km/h assumption; it is not a verified path.

The predeclared 12-case Population/5-minute grid uses p=2/3/4, winter 1.25/1.6, central/east assumed closure zones. Four cases have identical static/resilient sites. All normal/average/worst metrics for all three layouts are published in real_data_results.md and full JSON, with the six-scenario reference separate. The chosen p=4/1.6/central preset trades 78.220→67.245% normal coverage for 23.616→38.799% minimum coverage; fixed-layout minimum falls to 25.63% under 5 km/h access. These are weighted point metrics, not household coverage or evidence of likely disruption.

## ML claims independently checked

Production artifact hash and all forecasts still match the existing saved files; no final-test retuning occurred. New instrumented tests establish training-only imputer fitting and unchanged selection/artifact bytes when synthetic held-out labels change. Cells cannot switch geography groups between periods. Real 2023 evaluation is rolling monthly retrospective, not a fixed-origin year-ahead forecast. Forest remains selected by validation, while Poisson has lower final MAE (1.750 versus 1.775). January 2024 and historical reporting-latency uncertainty remain explicit in UI/card.

No live 511 access, HTTPS deployment, human study, video or submission was performed. The complete source release gates remain **unmet**. New exact outcomes are recorded first in validation.md; previous timings/results below are historical and do not describe corrected access semantics.

---

## Previous implementation audit (retained history)


Both complete original documents were reread against the implementation and the requirement matrix after the integrated application was running. The masterplan is primary; the dossier supplies context, a statistical baseline requirement, spatial-cell fallback and human release gates. Historical dates establish no acceptance result.

### Findings and repairs

| Review question | Finding / disposition | Regression evidence |
|---|---|---|
| Placeholder algorithms or simulated APIs? | No: routing is heap Dijkstra; SCIP solves coverage/assignment/shared-scenario binaries; NumPy samples incidents; actual sklearn fitting and FastAPI requests run. DummyRegressor is the explicitly labeled historical-mean ML baseline. | Exhaustive/NetworkX tests and live browser/API-number checks. |
| Units and unreachable bias? | Keep directed seconds everywhere, explicit infinity/null/unreachable share. P-median has a separately reported unreachable penalty; reachable-only means are conditional. Fixed floating unit conversion and reference test. | Hand routing, 56-case objectives, zero/threshold/unreachable sample tests. |
| Separate resilience decisions masquerading as one? | One shared x-vector; per-scenario solves exist only for labeled stability explanations. Scenario demand normalizes separately. | Tiny brute-force portfolio and fragile-bridge tradeoff tests. |
| Scenario mutation or accidentally shared state? | Adjacencies/matrices rebuilt from immutable-by-convention inputs, scenario failure rows disabled. Combined sensitivity now updates all affected winter/corridor/failure definitions consistently. | Base graph snapshot test, failure/event tests, experiments.json. |
| Stale matrix / old result reuse? | Content keys include all inputs. Audit found simulation only checked dataset/model identity, so scenario-definition changes could evade that check. **Fixed:** attached exact scenario definitions, compare matrix keys across runs and before simulation. Corrupt disk cache rebuilds. | Scenario-change simulation regression, graph/closure/candidate/demand/model-mode cache tests, disk corruption test. |
| Geography distortion? | Whole OSM ways can extend far beyond crop. Initial candidates/event/map fit included those tails. **Fixed:** in-crop candidates/event, largest strongly connected candidate pool, map fit to declared crop; buffer roads and all disconnected demand retained. | Public provenance/geometry and browser Iowa workflow checks. |
| Fake “current Iowa” data? | Actual OSM 2026-10-23, Census 2020 and Iowa DOT 2019–2023 crash counts; every resource/scenario is assumed. ACS fallback and live-511 blocker are explicit. Current traffic vintages and missing/sentinel values are audited and excluded from historical ML. | Source manifests, 6,676-row traffic audit, model card. |
| ML leakage / fabricated model wins? | Train-only preprocessing, predeclared time/group splits, lag features and test isolated from selection. RF wins validation; Poisson wins final MAE/RMSE; report both. No user model loading. | Feature/lag perturbation, group split, reproducibility tests and actual real/fixture reports. |
| Historical feature availability? | Finalized crash counts lack as-of reporting archives. **Unverified:** revisions/delays at historical origin. Clearly exposed; no live/operational validation claim. Current roadway/AADT features excluded. | Model card limitations; no fabricated as-of evidence. |
| Unfair simulation? | Same scenario/seed samples across every run, ordered portfolio does not change incident hashes, unavailable sites remain excluded. Controls, model, graph and scenario keys must agree. | Seed/pairing/order/disabled-resource and run-isolation tests. |
| Misleading solver labels? | Only solver OPTIMAL becomes optimal. Feasible, timeout/not-solved and heuristic statuses remain distinct; bound/gap included. No-solution runs cannot enter comparison simulation. | Real 1-ms solver-limit test, bounds/objectives and API checks. |
| Frontend disconnected or stale numbers? | All result/map demand access data comes from typed backend responses. Browser checks compare exact formatted values. Controls mark stale, abort/ignore old responses, disable downstream actions. Risk is unavailable for fixture; real risk has a historical label. Added conditional map legends for risk versus coverage/improvement. | Actual Chromium fixture and Iowa/Blended workflows, stale/error/console/mobile checks. |
| Security only documented? | Middleware/body/rate/header/CORS execute; spawn workers are terminated on deadline, limits enforced. No accounts/uploads/URL fetch endpoint/model loading. Fixed hosts and validation execute in offline acquisition and normalized feed adapter. | Security/API/process tests and executed scans. |
| Performance copied from targets? | Measured on Apple M5 / 16 GiB; record graph/matrix/solvers/10k simulation/inference/browser timings. Solver time is not confused with end-to-end request time. | benchmarks.json, browser-performance.json, validation.md. |

### Requirement-family disposition

Masterplan §§1–13 and dossier §§1–15: working planning workflow, public-data/fixture separation, directed routing, all placement models, shared resilience, all six scenarios, ML retrospective and fixture pipelines, statistical comparison, sensitivity and explanations are implemented and independently checked. Optional A*, p-center, relocation penalty, live replay, broad model ablation and ZAP were not implemented; they are not hidden in core algorithms.

Masterplan §§14–19 and dossier §§16–23: corresponding typed routes, identity-preserving exports, executing local security controls, connected React UI, tests and measured benchmarks are implemented. README documents equivalents (POST baseline, stored-snapshot evaluation and full run export), prerequisites, pinned dependencies and exact commands. Native current 511 integration is blocked by access; HTTPS/HSTS and distributed deployment controls remain unverified.

Masterplan §§20–24 and dossier §§24–34: source schedules, video scripts, judging narrative and research notes are context, not proof. No professional consultation, 5–10 user study, participant details, final naming clearance, video, written submission, backup deployment, ten human rehearsals or submission was performed. These are human/deployment tasks outside authorized local implementation. No one was contacted and nothing was published.

### Release gate decision

**Not competition-ready under the complete source release gates.** Local algorithm/data/API/UI/security verification is implemented and tested. Required human evaluation/submission gates and HTTPS deployment are not met. Historical as-of ML availability and live Iowa 511 data integration are not verified. Transportation forecasts are retrospective; no emergency-outcome or current-risk claim is supported. Exact final command results are in validation.md, and the final requirement matrix gives per-family evidence/status.
