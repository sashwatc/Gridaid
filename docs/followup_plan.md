# Follow-up verification plan

Continue existing implementation; preserve prior valid evidence. Sources and prior audit/validation/matrix read. Baseline rerun: 42 tests pass.

1. Inspect mathematics, cache/scenario identity, ML separation and API/process controls; add independent counterexamples where prior tests are weak.
2. Audit official 2020 tract/place geography and all original point/road anchors. Confirmed defect: zero time assigned to up to 871 m of access; original point coordinates lost and demand mapped at road nodes. Preserve coordinates; use directed partial-edge arrivals and explicit assumed access connectors. Independently verify one-way/closure behavior and sensitivity.
3. Evaluate a predeclared small real-data grid of winter/closure assumptions and resource counts. Publish every case, including coincident placements; choose a useful preset only from the disclosed grid. Do not tune ML using final test.
4. Browser-test corrected real workflow and layers/explanations/stale/loading/errors, update reports and matrix, run verify.sh, leave local serve.sh app running. No public deployment/video/submission.

## Acceptance outcomes

All four continuation milestones executed. Initial 42 valid tests reused; final 52 Python tests and 4 Chromium tests/type/build pass. Physical-access, cancellation, partial IPC, cache and UI races corrected with counterexamples. All 12 real cases and access sensitivity published; four coincidences retained. Production ML unchanged. Requirement matrix/audit/current validation updated. Local app remains running; remaining physical/ML/deployment/human limits are explicit.
