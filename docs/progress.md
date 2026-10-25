# Resumable continuation checkpoint

The existing application was continued, not rebuilt. Original sources/reports read and claims independently checked. **http://127.0.0.1:8000/** is running from `./scripts/serve.sh`; no public deployment, contacts, video or submission.

Current verification: **52 backend tests, strict TypeScript/build and 5 actual Chromium tests passed through ./scripts/verify.sh in a clean local clone**. Follow-up pip/npm audits and Bandit found zero vulnerabilities/findings; secret scanner's 392 public edge/content hash flags were reviewed, zero credentials. Raw evidence is in artifacts; current committed summaries have `_followup` suffix. Prior reports are retained as historical evidence.

Handoff for Arjun: docs/handoff.md contains exact setup, tracked/ignored artifact inventory, evidence and pending frontend integration/polish. Existing shared main history and separate root Base44 prototype were preserved; the tested app remains backend/ + frontend/. Clean-clone verification found/fixed Leaflet zoom callbacks after map teardown, with a failing-before/passing-after navigation regression. See docs/handoff_validation.json. No ignored data/model file is needed to run or test.

Confirmed defects fixed: zero-access relocation/original point loss and junction-only targets; cancelled-request computation-cap bypass; partial-IPC timeout gap; cache-eviction read race; pending simulation reviving obsolete trial-count results. New failures were reproduced and meaningful regressions pass. Directed routing, both static objectives, shared normalized resilience, unreachable metrics and paired simulation retain prior independent evidence.

Public snapshot now preserves original points, fixed directed partial-road approaches and explicit assumed access connectors (20 km/h default). Geometry/place/point audit: docs/geography.md/json. Exact community counts and selection/whole-tract/buffer boundaries documented. No household or verified driveway/path coverage claim. All 39 demand weights / 32 assumed sites remain.

Real demonstration: click **Load real-data demo preset →**. Four resources, Population, 5 minutes, normal/winter/closure/winter+closure, winter1.6 central zone, 20 km/h access, 0.6/0.4, seed42. Static normal/worst 78.220/23.616%; shared resilient 67.245/38.799%. Full 12-case table (4 coincidences), default six-scenario reference and access sensitivity are in real_demo_results.json / real_data_results.md. Exact five-minute walkthrough: docs/real_data_demo.md.

ML production artifact, forecasts, validation-based selection and final test metrics unchanged; train-only/group/lag claims verified. Forest selected by validation; Poisson better final MAE. January2024 is retrospective; reporting latency/as-of revisions remain unverified.

If resuming development: README setup, `./scripts/serve.sh`, `./scripts/verify.sh`. Data changes require coordinated rebuild/reload and `python -m scripts.real_demo` to refresh version-checked preset; ML does not need retraining for access-only changes (`scripts.geography_audit`). Stop/restart the app and refresh the browser around deliberate dataset rebuilds.

Remaining limitations ordered: coarse tract representation/unverified physical access; truncated static roads, omitted turns/capacity/dispatch and assumed resources/disruptions; historical ML availability and external validity; no human/expert validation; live511 access and HTTPS/distributed deployment controls. Complete source competition release gates remain unmet.
