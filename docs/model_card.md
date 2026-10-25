# Transportation incident-count model card

## Real Iowa retrospective model

**Model:** `iowa-tract-month-v1-04182850f9b352d1` (Random Forest selected on validation MAE). Intended use: compare historical transportation-incident demand assumptions in a planning simulator. Not intended for dispatch, medical prediction, personal risk, all-emergency demand, current alerts or claims of improved outcomes.

**Unit and target:** 2020 Census tract spatial cell × forecast month; reported transportation crash count in that month. Tracts implement the source's spatial-cell fallback because matching crashes to a changing current OSM segment inventory would create uncertain historical segment identities. These are counts, not exposure-adjusted crash rates or probabilities.

**Data:** 17,832 observed Scott County Iowa DOT crashes from January 2019–December 2023. Aggregate the 14,693 records in the 39 study tracts. Reindex the full 39 × 60 month grid, including zero-crash cells/months. Only public IDs, date and geometry are downloaded; no person/medical/vehicle details. Source requests, retrieval timestamps, spatial-join counts, zero-target count, table hash and split cell lists are in `ml_real_metrics.json`.

**Forecast:** January 2024, explicitly historical. Features available in principle before that month: calendar month, previous month count, previous year same-month count and mean of the preceding three months. No geographic IDs, same-month targets, severity/post-crash outcomes, current AADT, weather observations from the forecast month or future counts enter features. Feature generation shifts counts before rolling. Features are fixed to `month`, `lag_count`, `lag12_count`, `rolling3_count` and must be complete/nonnegative/finite for modeled periods.

**Important availability limit:** the source is a finalized retrospective snapshot, not archived as-of snapshots. Counts may include later corrections and reporting delay. The temporal/group tests establish structural separation, but cannot prove exact historical information availability. This is a retrospective held-out evaluation, not a verified live forecasting system. The app exposes that limitation.

**Splits:** 2019 supplies lag history. Train January 2020–December 2021 on 31 development tracts (744 rows); validation January–December 2022 on the same 31 (372 rows); untouched final test January–December 2023 on 8 entirely unseen tracts (96 rows). Every fifth sorted GEOID is held out, fixed before modeling. This is a group holdout, not a claim of independent neighboring geography. No identifiers enter models. Imputation/scaling is fitted only on training data. No refitting on validation/test occurs. Test data is never used to pick the model or its fixed hyperparameters.

**Models compared:** global training mean, previous-month count, previous-year count, Poisson regression (alpha .1), and 100-tree Random Forest (depth 5, minimum leaf 8, seed 42, one job). A small fixed candidate set, no test-set tuning.

| Model | Validation MAE | Final test MAE | Final test RMSE | Test rank correlation |
|---|---:|---:|---:|---:|
| Global mean | 4.065 | 2.619 | 3.044 | undefined (constant) |
| Previous month | 2.661 | 2.146 | 2.723 | .315 |
| Previous year | 3.366 | 2.448 | 3.111 | .170 |
| Poisson | 2.467 | **1.750** | **2.239** | .436 |
| Random Forest, selected | **2.163** | 1.775 | 2.273 | .468 |

The forest won validation MAE; Poisson had slightly better final MAE/RMSE. The test result was not used to change the selection. These are actual executed metrics, not evidence that complex ML universally improves planning. No uncertainty intervals or prospective validation are claimed.

Validation permutation importance (increase in MAE): rolling3_count 1.7263; lag12_count .1017; lag_count .0960; month .0130. This is predictive sensitivity, not causation. Values are calculated on validation, not selected using the final test.

**Artifact/security:** scikit-learn 1.9.1, joblib 1.6.0, and other dependencies locked in `uv.lock`. Offline `data/processed/ml/iowa_model.joblib` has SHA-256 `04182850f9b352d1c948c0bfcd7b257c439962ddd8def29e7b9f710156d9dbf8` (use the machine-readable report as authoritative if rebuilt). Runtime never loads pickle/joblib; it serves schema-validated precomputed nonnegative predictions attached to the public snapshot and fixed model version. There is no upload/deserialization endpoint. Table and model artifact hashes are recorded by training. The forecast is normalized to relative demand; blended demand separately normalizes population and risk. Event risk is a **synthetic assumption** adding half the base forecast mass.

**Limitations:** 39 unequal tracts, a 96-row final test, a single region, possible geocoding/reporting biases, retrospective revisions, changing exposure and pandemic-era behavior, no capacity/service/clinical validation. Population and transportation incident counts are different proxies. The model has not been validated outside this study area or for current emergencies.

## Separate synthetic experiment

`ml.train` trains on invented segment-month features/counts (36 segments, 2020–2023; train/validation development segments and future unseen-segment test). Its model card fields and metrics are in `ml_fixture_metrics.json`. Forest final MAE .417; Poisson .480; global mean .597; previous-period .406. Forest is selected on validation; the naive previous-period baseline has better final MAE. These values are **synthetic fixture metrics**, not Iowa evaluation. This model is not connected to Iowa risk and does not enable ML on the synthetic corridor graph.

## Continuation claim verification

The production model, validation-based selection and final test report were preserved during the geographic/routing changes. Artifact SHA-256 was checked against the offline file, and every public-snapshot forecast equals the saved forecast table. The cached complete table has 2,340 cell-month rows, 39 tracts and 90 zero-target rows. Neither preprocessing nor fitting uses geographic identifiers or contemporaneous/future targets.

A new instrumented test runs the actual real-pipeline fitting code on a separately generated labeled test table: all three imputers fit exactly the training indices. Perturbing only held-out labels changes test metrics but leaves validation metrics, selected model and artifact bytes identical. This does not retune production against the final test. Group validation now rejects cells switching train/held-out geography across periods. The stored real final metrics remain forest MAE 1.774909 versus Poisson 1.749958, with the forest retained because it won validation MAE.

Road-arrival/access changes affect how demand is reached, not the ML target, inputs, split, selection or forecast date. January 2024 is still retrospective. Exact historical reporting availability and prospective performance remain unverified and visible in the UI.

The 2023 test is a **rolling one-month-ahead** retrospective evaluation: earlier test-year incident counts can be lag inputs for later months, but never enter model fitting or selection. It is not a claim that all twelve months were forecast using only information available on January 1, 2023. Reporting delay/revision availability remains unverified at each monthly origin.
