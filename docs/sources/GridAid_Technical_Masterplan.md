# GridAid Technical Masterplan
## Resilience-Aware Emergency Resource Planning for the 2026 Congressional App Challenge

> Working name: **GridAid**. Perform a final name-collision search before public submission.

## 1. Project thesis

GridAid is a browser-based resilience planning platform that combines geospatial data engineering, road-network graph algorithms, facility-location optimization, machine learning, Monte Carlo simulation, scenario analysis, explainability, and cybersecurity controls to test where limited emergency resources should be placed so modeled geographic coverage remains effective when roads, demand, or resource availability change.

The project is not a live dispatch system, medical application, or promise of real emergency outcomes. The Congressional App Challenge build is a planning and simulation tool using public, synthetic, and documented data.

The central research question is:

> **Where should limited emergency resources be placed so that the resulting network performs well under normal conditions and remains effective under plausible disruptions?**

The core comparison is:

1. synthetic/current baseline configuration;
2. static optimum under normal conditions;
3. resilience-aware optimum across multiple scenarios.

The signature technical contribution is not simply facility placement. Professional GIS systems already solve static location-allocation. GridAid focuses on making a transparent, student-built, open-data resilience workflow accessible in a web application.

---

## 2. Core systems

GridAid should demonstrate six integrated systems.

### 2.1 Geospatial data engineering

The app must ingest, clean, normalize, and combine road, Census, transportation, crash, and scenario data. The pipeline should be reproducible and should document source, retrieval date, processing steps, coordinate reference systems, and assumptions.

### 2.2 Graph routing

The road network is represented as a weighted directed graph. Intersections and road endpoints become nodes. Road segments become weighted edges. Edge weights represent modeled travel time.

For each edge:

```text
base_travel_time = edge_length / modeled_speed
```

Scenario conditions modify the weight:

```text
scenario_travel_time = base_travel_time × scenario_multiplier
```

A closed road is removed or made non-traversable.

GridAid should implement Dijkstra's algorithm directly for learning and validation, then compare its results with NetworkX. A* may be added for targeted point-to-point routing if useful.

### 2.3 Facility-location optimization

GridAid must support at least two static objectives:

- maximum weighted demand coverage within a modeled time threshold;
- minimum weighted travel time / p-median style objective.

A small problem must be brute-forced to prove the solver formulation is correct.

### 2.4 Resilience-aware optimization

The same selected resource configuration is evaluated across multiple conditions:

```text
Normal
Winter slowdown
Major road closure
Resource unavailable
Temporary event demand
Combined stress
```

A simple resilience objective can combine average and worst-case scenario performance:

```text
resilience_score(C)
 = 0.6 × average_scenario_coverage(C)
 + 0.4 × worst_case_coverage(C)
```

The final OR-Tools formulation should share site-selection variables across scenarios so the optimizer finds one configuration that performs across all modeled conditions.

### 2.5 Machine-learning incident-risk layer

The ML subsystem should estimate **relative transportation incident risk** using public Iowa transportation/crash data. It must not be described as predicting every emergency.

Candidate inputs include:

- AADT / traffic volume;
- truck AADT;
- road class;
- speed limit;
- segment length;
- intersection density;
- urban/rural status;
- historical lagged crash frequency;
- season/month;
- work-zone information;
- surface/weather fields when properly aligned.

The ML output becomes an alternative demand weight for optimization.

Demand modes:

```text
Population
ML Incident Risk
Blended
```

Blended demand can use:

```text
w_i = lambda × normalized_population_i
    + (1-lambda) × normalized_incident_risk_i
```

### 2.6 Monte Carlo simulation

GridAid should generate thousands of modeled incidents from a chosen demand distribution and compare configurations statistically.

Default competition simulation:

```text
10,000 trials
fixed random seed for reproducibility
```

Report:

- mean modeled travel time;
- median;
- p90;
- p95;
- percent within selected threshold;
- average scenario coverage;
- minimum scenario coverage;
- worst scenario.

---

## 3. Iowa motivation

Iowa is a strong launch environment because the resilience problem is naturally connected to rural distance, large road networks, winter weather, road closures, events, and active experimentation with technology-supported first response.

The project should not be framed as an agriculture app. Iowa matters because it provides a realistic technical environment and relevant public data.

Useful public sources include:

- OpenStreetMap road networks;
- U.S. Census ACS population estimates;
- Iowa DOT road and traffic data;
- Iowa DOT historical crash data;
- Iowa 511 incidents, construction, special events, and winter road conditions.

The initial study area should be Scott County / Davenport or a carefully selected nearby Iowa region that is small enough for reliable computation but large enough to show urban, suburban, and rural road patterns.

---

## 4. Proposed technical architecture

```text
React / TypeScript / MapLibre or Leaflet
                 |
                 | HTTPS JSON API
                 v
              FastAPI
                 |
     +-----------+------------+-------------+
     |           |            |             |
     v           v            v             v
 Routing     Optimization    ML Service    Security
 Service       Service        Service      Middleware
     |           |            |             |
     +-----------+------+-----+-------------+
                        |
                        v
                 Scenario Engine
                        |
                        v
                Matrix / Data Cache
                        |
                        v
              Simulation + Analytics
```

Recommended backend tools:

```text
Python
FastAPI
Pydantic
NumPy
pandas
GeoPandas
Shapely
pyproj
NetworkX
OSMnx
OR-Tools
scikit-learn
joblib
pytest
```

Recommended frontend tools:

```text
React
TypeScript
Vite or Next.js
MapLibre GL JS or Leaflet
```

Do not add infrastructure only because it sounds professional. Reliability and clarity matter more than architectural complexity.

---

## 5. Data pipeline

### 5.1 Raw inputs

```text
OpenStreetMap roads
Census population
Iowa DOT traffic / crash data
Iowa 511 scenario data
Synthetic baseline resources
Candidate sites
```

### 5.2 Validation

Check:

- missing values;
- invalid geometry;
- duplicate records;
- disconnected roads;
- coordinate reference systems;
- impossible speeds;
- point-to-road snapping distances;
- target leakage in ML data;
- stale external-feed timestamps.

### 5.3 Processed outputs

```text
road_graph
population_demand.parquet
ml_training_table.parquet
ml_incident_risk.parquet
candidate_sites.parquet
matrix_normal.npy
matrix_winter.npy
matrix_closure.npy
model.joblib
model_card.json/md
```

Every processed dataset should have provenance metadata.

---

## 6. Road graph and routing

Represent the road network as `G = (V, E)`.

Edge schema should include:

```json
{
  "u": 123,
  "v": 124,
  "length_m": 482.1,
  "road_class": "secondary",
  "speed_kph": 72.0,
  "base_time_s": 24.1,
  "condition_multiplier": 1.0,
  "closed": false
}
```

### Dijkstra implementation

The student-built implementation should use:

- adjacency list;
- `heapq` priority queue;
- distance map;
- edge relaxation;
- predecessor map when geometry/path reconstruction is needed.

Validation must compare with NetworkX on known graphs.

### Travel-time matrix

The routing layer should precompute:

```text
T[candidate_site][demand_point] = modeled network travel time
```

This matrix is critical because the optimizer should not rerun graph searches inside every solver decision.

For 150 candidates and 2,000 demand points:

```text
150 × 2,000 = 300,000 travel-time values
```

That is manageable as a numeric matrix.

---

## 7. Static optimization

### 7.1 Maximum coverage formulation

Let:

- `x_j = 1` when candidate site `j` is selected;
- `z_i = 1` when demand point `i` is covered within threshold;
- `w_i` = demand weight;
- `a_ij = 1` when site `j` can reach demand `i` within threshold.

Objective:

```text
maximize SUM_i w_i × z_i
```

Constraints:

```text
SUM_j x_j = p
z_i <= SUM_j a_ij × x_j
x_j, z_i ∈ {0,1}
```

### 7.2 p-median style formulation

Conceptually:

```text
minimize SUM_i SUM_j w_i × travel_time_ij × assignment_ij
```

with exactly `p` selected facilities and each demand point assigned to one selected location.

### 7.3 Greedy baseline

Implement a student-built greedy method before OR-Tools:

1. start with no sites;
2. measure marginal gain from every remaining candidate;
3. select the highest-gain candidate;
4. repeat.

The greedy algorithm gives an interpretable baseline and useful runtime comparison.

### 7.4 Correctness test

Example:

```text
8 candidate sites choose 3 = 56 configurations
```

Enumerate all 56 and compare the best result with OR-Tools.

---

## 8. Resilience optimization

Static optimization answers only one state of the world. GridAid's main analytical feature must evaluate one placement across many scenario matrices.

For configuration `C`:

```text
coverage_normal(C)
coverage_winter(C)
coverage_closure(C)
coverage_resource_failure(C)
coverage_event(C)
```

### Competition-ready resilience score

```python
mean_coverage = np.mean(scenario_coverages)
worst_coverage = np.min(scenario_coverages)
score = 0.6 * mean_coverage + 0.4 * worst_coverage
```

The final model should document and sensitivity-test these weights.

### Stronger OR-Tools model

Use one shared `x_j` site-selection variable across all scenarios. Each scenario gets its own coverage variables and demand/travel matrix.

Possible objective:

```text
maximize weighted average scenario coverage
+ bonus for minimum scenario coverage
```

or use constraints requiring a minimum coverage floor in each required scenario.

### Validation toy case

Create a network where the static optimum depends heavily on one bridge or corridor. Close it. The resilience-aware optimizer should prefer a less fragile configuration.

This should become an automated test.

---

## 9. Scenario engine

Create a typed scenario structure:

```json
{
  "scenario_id": "winter_closure_demo",
  "name": "Winter + Corridor Closure",
  "closed_edge_ids": [12011, 12012],
  "edge_multipliers": {"covered": 1.5},
  "disabled_resource_ids": ["R4"],
  "temporary_demand": [],
  "provenance": "synthetic_demo_assumption"
}
```

Scenario provenance values:

```text
live_public_feed
cached_public_snapshot
expert_informed_assumption
synthetic_demo_assumption
```

Required scenarios:

- normal;
- winter slowdown;
- major road closure;
- resource failure;
- temporary event demand.

Optional after the core is stable:

- combined disruption;
- historical cached Iowa event replay.

---

## 10. Machine-learning subsystem

### 10.1 Purpose

The ML subsystem estimates relative transportation incident risk from historical Iowa transportation/crash patterns. It should never be described as a universal emergency predictor.

### 10.2 Prediction unit

Preferred:

```text
road segment × time period
```

Fallback if segment matching becomes too time-consuming:

```text
spatial grid cell × time period
```

### 10.3 Target

Choose one:

- future crash count;
- severity-weighted future crash count;
- high-risk classification.

Freeze the target once the pipeline works.

### 10.4 Avoid leakage

Do not include:

- future information;
- post-crash outcome fields as predictors of whether a crash occurs;
- same-period crash count as both predictor and target;
- geographic identifiers that memorize the answer without generalizing unless explicitly justified.

### 10.5 Baseline models

Always build a simple baseline first:

- global historical mean;
- historical mean by road class;
- previous-period count/risk.

### 10.6 Candidate models

Test a small meaningful set:

- simple linear/Poisson-like baseline if appropriate;
- Random Forest;
- HistGradientBoosting or Gradient Boosting.

Avoid giant hyperparameter sweeps.

### 10.7 Train/test methodology

Prefer:

- earlier years for training;
- later year for validation/test;

and/or geography-aware grouped splits.

### 10.8 Metrics

Regression:

- MAE;
- RMSE;
- rank correlation if risk ordering matters.

Classification:

- precision;
- recall;
- PR-AUC;
- ROC-AUC;
- calibration if probabilities are displayed.

Do not lead with raw accuracy on highly imbalanced data.

### 10.9 Model card

Create `docs/model_card.md` containing:

- model name/version;
- intended use;
- out-of-scope use;
- training data dates;
- target;
- feature list;
- preprocessing;
- split strategy;
- metrics;
- known limitations;
- geographic limitations;
- security notes;
- artifact hash/version.

### 10.10 ML artifact security

Train offline. Deploy only a known model artifact. Never accept arbitrary user-supplied `.pkl`/`.joblib` files. Validate inference features against a fixed schema and pin the relevant scikit-learn version.

---

## 11. Demand models

GridAid should support three modes.

### Population

```text
w_i = population_i
```

### ML incident risk

```text
w_i = normalized_predicted_risk_i
```

### Blended

```text
w_i = lambda × normalized_population_i
    + (1-lambda) × normalized_risk_i
```

The optimizer should use exactly the same mathematical machinery regardless of which demand vector is selected.

This clean separation makes it possible to study how assumptions about demand change recommended resource sites.

---

## 12. Monte Carlo simulation

Convert demand weights into probabilities:

```python
probabilities = demand_weights / demand_weights.sum()
```

Use:

```python
rng = np.random.default_rng(42)
```

Default official demo:

```text
10,000 incidents
```

For each simulated incident:

1. sample demand location;
2. identify nearest available selected resource using the relevant matrix;
3. record modeled travel time;
4. accumulate distribution statistics.

Report:

- mean;
- median;
- p90;
- p95;
- threshold coverage;
- worst scenario;
- average scenario coverage;
- minimum scenario coverage.

---

## 13. Explainability

### Placement explanation

For each selected site display:

- unique weighted demand covered;
- marginal improvement;
- overlap/redundancy with other sites;
- nearby weak areas served.

### Resilience explanation

Display:

- scenario selection stability;
- normal-condition contribution;
- worst-case contribution;
- scenario where the site adds most value.

### ML explanation

Display:

- model version;
- test-set metric;
- predicted relative risk;
- historical period;
- global feature importance or permutation importance;
- limitation statement.

Do not describe feature importance as proof of causation.

---

## 14. API design

Recommended endpoints:

```text
GET  /api/health
GET  /api/study-area
GET  /api/baseline
GET  /api/demand-layers
POST /api/optimize/static
POST /api/optimize/resilient
POST /api/scenarios/evaluate
POST /api/simulate
GET  /api/ml/model-card
GET  /api/ml/risk-layer
GET  /api/runs/{id}/explanation
```

Example resilient optimization request:

```json
{
  "resource_count": 10,
  "threshold_minutes": 10,
  "demand_model": "blended",
  "scenario_ids": ["normal", "winter", "closure_demo", "resource_failure"],
  "average_weight": 0.6,
  "worst_case_weight": 0.4
}
```

Every POST endpoint should use strict Pydantic models.

Example bounds:

```text
resource_count: 1..25
threshold_minutes: 1..60
simulation_trials: 100..100000
scenario IDs: allowlist
demand model: enum
objective: enum
```

---

## 15. Cybersecurity and Take9

Cybersecurity is part of the architecture, not a final checkbox.

The public competition build should intentionally avoid collecting personal data whenever the app does not need it.

### 15.1 Data minimization

Do not collect:

- names;
- email addresses;
- passwords;
- medical data;
- patient information;
- exact user location;
- private volunteer home addresses;
- live 911 records;
- arbitrary uploaded files.

### 15.2 Threat model

Assets:

- integrity of optimization results;
- integrity of model/data artifacts;
- API availability;
- deployment secrets;
- public-data provenance/freshness;
- user trust.

Threats:

1. denial of service through expensive optimization requests;
2. malformed inputs causing crashes/excessive computation;
3. dependency vulnerabilities;
4. leaked secrets;
5. malformed or compromised external feeds;
6. cross-site scripting / insecure headers;
7. overbroad CORS;
8. unsafe model deserialization;
9. stale data presented as current;
10. future feature creep introducing unnecessary personal data.

### 15.3 API security

Use:

- Pydantic validation;
- enums/allowlists;
- min/max numeric bounds;
- max list sizes;
- request-size limits;
- solver timeouts;
- rate limits on optimize/simulate;
- generic errors without stack traces.

### 15.4 Browser/API hardening

Use:

- HTTPS;
- HSTS where hosting supports it;
- Content-Security-Policy;
- `X-Content-Type-Options: nosniff`;
- restrictive CORS;
- safe React rendering;
- no `dangerouslySetInnerHTML` for untrusted content;
- debug mode disabled in production.

### 15.5 Secrets

- environment variables only;
- `.env` ignored by Git;
- no secrets in frontend bundles;
- rotate any accidentally exposed credentials;
- run a secret scan before release.

### 15.6 Dependency security

Run:

```text
pip-audit
npm audit
Bandit
Gitleaks or equivalent
```

Optional if time permits:

```text
OWASP ZAP baseline scan
```

### 15.7 External feeds

Treat public feeds as untrusted input:

- fixed official host allowlist;
- timeouts;
- schema validation;
- size limits where practical;
- cached fallback;
- display source timestamp.

### 15.8 Take9 statement

The app's methodology/security page can state:

> GridAid follows the Take9 principle by treating security as a design requirement: the public demo minimizes collected data, validates and bounds planning inputs, rate-limits expensive operations, protects deployment secrets and dependencies, and clearly labels the source and freshness of external data.

---

## 16. Frontend UX

The main screen should tell one story:

```text
BASELINE
   ↓
STATIC OPTIMIZE
   ↓
STRESS TEST
   ↓
RESILIENCE OPTIMIZE
   ↓
COMPARE + VALIDATE
```

### Main controls

- resource count;
- optimization objective;
- coverage threshold;
- demand model;
- scenario set;
- Static Optimize;
- Resilience Optimize.

### Map layers

- roads;
- population;
- ML incident risk;
- candidate sites;
- selected resources;
- disruptions;
- coverage heatmap;
- improvement heatmap.

### Result panel

Compare:

```text
Baseline
Static optimum
Resilient optimum
```

Metrics:

- normal coverage;
- average scenario coverage;
- minimum/worst-case coverage;
- weighted mean travel time;
- p95;
- runtime.

### Progressive disclosure

Advanced controls should be hidden by default:

- population/risk blend;
- resilience average/worst-case weights;
- exact/greedy solver;
- simulation count.

---

## 17. Validation plan

### Routing

- hand-calculated toy graph;
- custom Dijkstra vs NetworkX;
- disconnected route test;
- road-closure test;
- one-way road test where supported.

### Static optimizer

- brute-force exact small case;
- greedy comparison;
- OR-Tools result and runtime.

### Resilience optimizer

- deliberately fragile toy graph;
- static vs resilient comparison;
- worst-case scenario improvement test.

### Machine learning

- reproducible preprocessing;
- leakage review;
- baseline model;
- held-out time/geography-aware test;
- saved model version;
- feature schema test;
- sanity-check risk layer.

### Simulation

- fixed seed reproducibility;
- correct probability normalization;
- p90/p95 reference values;
- disabled resource truly excluded.

### Security

- malformed request rejection;
- oversized request rejection;
- rate limit behavior;
- restricted CORS;
- security headers;
- no secrets in repository;
- dependency scans;
- optional ZAP baseline.

---

## 18. Performance plan

Interactive performance is necessary for the competition demo.

Precompute:

- study-area road graph;
- candidate sites;
- population demand;
- ML risk layer;
- normal matrix;
- prepared winter matrix;
- prepared closure matrix.

Cache based on:

```text
study area
+ graph version
+ scenario
+ candidate set
+ demand mode
+ ML model version
```

Record final real benchmarks:

- graph load time;
- matrix load/build time;
- static solve time;
- resilience solve time;
- 10,000-trial simulation time;
- ML layer/inference time;
- frontend render time.

Do not claim target timings as measured performance.

---

## 19. Repository structure

```text
gridaid/
├── README.md
├── SECURITY.md
├── .env.example
├── docs/
│   ├── methodology.md
│   ├── threat_model.md
│   ├── model_card.md
│   ├── data_sources.md
│   ├── validation.md
│   └── expert_feedback.md
├── frontend/
├── backend/
│   ├── api/
│   ├── schemas/
│   ├── middleware/
│   └── services/
│       ├── routing.py
│       ├── optimization.py
│       ├── resilience.py
│       ├── scenarios.py
│       ├── simulation.py
│       ├── ml_inference.py
│       └── explanations.py
├── ml/
│   ├── features.py
│   ├── train.py
│   ├── evaluate.py
│   └── models/
├── data/
│   ├── raw/
│   ├── interim/
│   ├── processed/
│   └── demo/
├── notebooks/
├── scripts/
└── tests/
```

---

## 20. Four-week implementation schedule

### September 25–29

- repository;
- security/threat-model baseline;
- synthetic graph;
- Dijkstra;
- tests;
- matrix;
- greedy optimizer;
- OR-Tools static optimizer;
- brute-force validation;
- expert outreach.

**Exit:** mathematically verified static engine.

### September 30–October 4

- scenario engine;
- resilience score;
- robust/multi-scenario optimizer;
- resilience toy test;
- real Iowa graph;
- Census demand;
- candidate sites;
- normal matrix.

**Exit:** resilience logic works on real Iowa geography.

### October 5–10

- Iowa DOT ML dataset;
- feature engineering;
- baseline model;
- tree model;
- test evaluation;
- model card;
- ML risk layer;
- prepared disruption matrices.

**Exit:** evaluated ML layer is connected to optimization.

### October 8–14

- FastAPI;
- request schemas;
- rate limits;
- React map;
- baseline/static/resilient workflow;
- scenario UI;
- ML demand toggle;
- result charts.

**Exit:** another person can use the product without explanation.

### October 13–18

- Monte Carlo simulation;
- robustness analysis;
- validation experiments;
- security scans/hardening;
- expert prototype review;
- user testing;
- performance benchmarks.

**Exit:** every competition claim has evidence.

### October 18–20

- UX polish;
- methodology;
- model card;
- security/privacy page;
- source attribution;
- final project-name search.

**Feature freeze: October 20.**

### October 21–24

- video;
- submission answers;
- final testing;
- ten demo rehearsals;
- backup deployment;
- repository cleanup.

### October 25

Submit.

---

## 21. Three-minute video plan

Target: **2:45–2:55**.

### 0:00–0:13 — Hook

Explain that a resource layout that works under normal conditions may fail under disruption.

### 0:13–0:28 — Purpose and audience

State that the app is a planning simulator for emergency/community planners.

### 0:28–0:58 — Static optimization

Show baseline and press Static Optimize.

Mention weighted road graph and network travel time.

### 0:58–1:28 — Main wow moment

Activate road closure/winter scenario.

Show static configuration degrade.

Press Resilience Optimize.

Show multi-scenario comparison.

### 1:28–1:50 — Technical pipeline

Show one clean architecture diagram and mention:

- Python/FastAPI;
- GeoPandas;
- graph routing;
- OR-Tools;
- scikit-learn;
- NumPy simulation;
- React/TypeScript.

### 1:50–2:12 — ML

Toggle ML risk layer.

Show one held-out metric and describe the model accurately.

### 2:12–2:31 — Validation

Show:

- routes vs NetworkX;
- optimizer vs brute force;
- 10,000 simulations;
- held-out ML metric.

### 2:31–2:41 — Take9 cybersecurity

State that the public demo collects no personal/medical data, validates and rate-limits inputs, protects secrets, scans dependencies, and treats external data as untrusted.

### 2:41–2:54 — Close

Return to the main value proposition: measuring not just where resources work now, but whether they still work when conditions change.

Do not teach equations or security headers in the video.

---

## 22. Professional-grade release checklist

### Algorithms

- [ ] Custom/reference routing tests pass.
- [ ] Static optimizer matches brute force on small cases.
- [ ] Resilience toy test behaves correctly.
- [ ] Monte Carlo reproducible.

### Data

- [ ] Iowa graph reproducible.
- [ ] Census source/date recorded.
- [ ] Iowa DOT sources/dates recorded.
- [ ] synthetic resources clearly labeled.
- [ ] scenario provenance visible.

### ML

- [ ] target frozen.
- [ ] leakage review complete.
- [ ] baseline model recorded.
- [ ] held-out final metric recorded.
- [ ] model card complete.
- [ ] artifact/version pinned.
- [ ] inference schema validated.

### Cybersecurity / Take9

- [ ] no unnecessary personal data.
- [ ] no arbitrary upload.
- [ ] Pydantic bounds and allowlists.
- [ ] solver/simulation rate limits.
- [ ] timeouts/computation caps.
- [ ] CORS restricted.
- [ ] HTTPS.
- [ ] security headers.
- [ ] debug off.
- [ ] secrets outside repository.
- [ ] `pip-audit` reviewed.
- [ ] `npm audit` reviewed.
- [ ] Bandit reviewed.
- [ ] secret scan reviewed.
- [ ] external data schema validation.
- [ ] Security/Privacy page.
- [ ] SECURITY.md.

### Product

- [ ] Baseline loads.
- [ ] Static optimize works.
- [ ] Prepared disruption works.
- [ ] Resilience optimize works.
- [ ] ML layer works.
- [ ] Scenario chart works.
- [ ] Explainability works.
- [ ] No fake metrics.
- [ ] No broken controls.

### Submission

- [ ] Final name checked for collisions.
- [ ] Video under 3 minutes.
- [ ] Participant names included.
- [ ] App purpose stated.
- [ ] Target audience stated.
- [ ] Tools/languages stated.
- [ ] ML/AI use described accurately.
- [ ] Take9/security design documented.
- [ ] Technical challenge answer based on a real problem.
- [ ] Demo succeeds ten consecutive times.
- [ ] Submit October 25.

---

## 23. What not to build

Before the deadline, do not add:

- live 911 integration;
- medical diagnosis;
- medical instructions;
- private responder tracking;
- user accounts;
- social/community feeds;
- generic chatbot;
- push notifications;
- arbitrary file uploads;
- nationwide optimization before Iowa is stable;
- unrelated computer vision;
- mobile-native rewrite;
- large deep-learning models solely for prestige;
- unsupported “lives saved” estimates;
- security buzzwords without actual controls.

Professional quality comes from validated algorithms, useful ML, reproducible data, secure APIs, strong testing, fast UX, explainability, and honest limitations.

---

## 24. Final standard

Before adding any feature, ask:

1. Does it strengthen the resilience model?
2. Does it create measurable evidence?
3. Does it demonstrate meaningful programming/data-science skill?
4. Does it improve trust, cybersecurity, or usability?
5. Can it be finished, tested, and explained before feature freeze?

If the answer is mostly no, do not build it.

> **Build a sophisticated engine, validate it like a research project, secure it like a public web application, and demonstrate it like a simple product.**
