// GridAid deterministic optimization + evaluation logic.
// Greedy heuristics with deterministic iteration order so identical inputs
// always return identical outputs. Designed to be swapped for a real
// OR-Tools / FastAPI backend later without UI changes.

import {
  getCandidates,
  getDemand,
  baseTravelTimeMin,
  pointToPolylineKm,
  getRoads,
  getDemandWeight,
} from "./data";
import { resilienceScenarios } from "./scenarios";

const candidates = getCandidates();
const demand = getDemand();
const roads = getRoads();

// Travel time for a demand point to a site under a given scenario.
export function travelTimeMin(d, site, scenario = { type: "normal" }) {
  let t = baseTravelTimeMin(d, site);
  if (scenario.winterMultiplier) {
    t *= scenario.winterMultiplier;
  }
  if (scenario.closedRoadId) {
    const road = roads.find((r) => r.id === scenario.closedRoadId);
    if (road) {
      const distToRoad = pointToPolylineKm(d, road.coords);
      // demand near the closed road suffers a detour penalty
      if (distToRoad < 2.2) {
        const penalty = (2.2 - distToRoad) * 6; // up to ~13 min extra
        t += penalty;
      }
    }
  }
  return t;
}

// Active site list for a scenario (resource_unavailable removes one site).
function activeSites(selectedIds, scenario) {
  if (scenario.unavailableSiteId) {
    return selectedIds.filter((id) => id !== scenario.unavailableSiteId);
  }
  return selectedIds;
}

// Evaluate a single scenario: returns coverage fraction, avg travel time,
// per-demand assignment {demandId -> {siteId, time, covered}}.
export function evaluateScenario(selectedIds, scenario, focus, balance, thresholdMin) {
  const active = activeSites(selectedIds, scenario);
  const activeSitesObjs = active
    .map((id) => candidates.find((c) => c.id === id))
    .filter(Boolean);

  // optional temporary event demand
  let demandList = demand;
  let extraWeightTotal = 0;
  if (scenario.tempEvent) {
    const ev = scenario.tempEvent;
    demandList = [
      ...demand,
      {
        id: "TEMP_EVENT",
        lat: ev.lat,
        lng: ev.lng,
        weightPop: ev.weight,
        weightRisk: ev.weight,
        weightBalanced: ev.weight,
        population: ev.weight,
        risk: 0.5,
        isTemp: true,
      },
    ];
    extraWeightTotal = ev.weight;
  }

  let totalWeight = 0;
  let coveredWeight = 0;
  let weightedTime = 0;
  const assignments = {};
  for (const d of demandList) {
    const w = getDemandWeight(d, focus, balance);
    totalWeight += w;
    let bestTime = Infinity;
    let bestSite = null;
    for (const s of activeSitesObjs) {
      const t = travelTimeMin(d, s, scenario);
      if (t < bestTime) {
        bestTime = t;
        bestSite = s;
      }
    }
    assignments[d.id] = { siteId: bestSite ? bestSite.id : null, time: bestTime, covered: bestTime <= thresholdMin };
    weightedTime += w * (isFinite(bestTime) ? bestTime : thresholdMin * 2);
    if (bestTime <= thresholdMin) coveredWeight += w;
  }
  return {
    coverage: totalWeight > 0 ? coveredWeight / totalWeight : 0,
    avgTime: totalWeight > 0 ? weightedTime / totalWeight : 0,
    assignments,
    totalWeight,
    coveredWeight,
  };
}

// Evaluate a layout across normal + resilience scenarios.
export function evaluateLayout(selectedIds, { focus = "population", balance = 0.5, thresholdMin = 15, closedRoadId = null, unavailableSiteId = null } = {}) {
  const scenarios = resilienceScenarios(closedRoadId, unavailableSiteId);
  const perScenario = scenarios.map((sc) => ({
    scenario: sc,
    ...evaluateScenario(selectedIds, sc, focus, balance, thresholdMin),
  }));
  const normal = perScenario[0];
  const disruptionScenarios = perScenario.slice(1);
  const avgScenario = disruptionScenarios.reduce((s, r) => s + r.coverage, 0) / disruptionScenarios.length;
  const worst = Math.min(...disruptionScenarios.map((r) => r.coverage));
  const resilienceScore = 0.6 * avgScenario + 0.4 * worst;
  return {
    normalCoverage: normal.coverage,
    avgTime: normal.avgTime,
    avgScenarioCoverage: avgScenario,
    worstCoverage: worst,
    resilienceScore,
    perScenario,
    assignments: normal.assignments,
  };
}

// --- Greedy max coverage (Cover More People) -----------------------------
export function greedyMaxCoverage(k, { focus = "population", balance = 0.5, thresholdMin = 15, scenario = { type: "normal" } } = {}) {
  const selected = [];
  const uncovered = new Set(demand.map((d) => d.id));
  while (selected.length < k) {
    let best = null;
    let bestGain = -1;
    let bestAvgTime = Infinity;
    for (const c of candidates) {
      if (selected.includes(c.id)) continue;
      let gain = 0;
      let timeSum = 0;
      let timeCount = 0;
      for (const d of demand) {
        const w = getDemandWeight(d, focus, balance);
        if (!uncovered.has(d.id)) continue;
        const t = travelTimeMin(d, c, scenario);
        timeSum += t;
        timeCount += 1;
        if (t <= thresholdMin) gain += w;
      }
      const avg = timeCount ? timeSum / timeCount : Infinity;
      if (gain > bestGain || (gain === bestGain && avg < bestAvgTime)) {
        bestGain = gain;
        bestAvgTime = avg;
        best = c;
      }
    }
    if (!best) break;
    selected.push(best.id);
    for (const d of demand) {
      if (uncovered.has(d.id) && travelTimeMin(d, best, scenario) <= thresholdMin) {
        uncovered.delete(d.id);
      }
    }
  }
  return selected;
}

// --- Greedy p-median (Reduce Travel Time) --------------------------------
export function greedyPMedian(k, { focus = "population", balance = 0.5, scenario = { type: "normal" } } = {}) {
  const selected = [];
  // total weighted travel time to currently selected set
  const currentBest = new Map();
  for (const d of demand) {
    currentBest.set(d.id, Infinity);
  }
  while (selected.length < k) {
    let best = null;
    let bestReduction = -Infinity;
    for (const c of candidates) {
      if (selected.includes(c.id)) continue;
      let reduction = 0;
      for (const d of demand) {
        const w = getDemandWeight(d, focus, balance);
        const t = travelTimeMin(d, c, scenario);
        if (t < currentBest.get(d.id)) reduction += w * (currentBest.get(d.id) - t);
      }
      if (reduction > bestReduction) {
        bestReduction = reduction;
        best = c;
      }
    }
    if (!best) break;
    selected.push(best.id);
    for (const d of demand) {
      const t = travelTimeMin(d, best, scenario);
      if (t < currentBest.get(d.id)) currentBest.set(d.id, t);
    }
  }
  return selected;
}

// --- Resilient selection -------------------------------------------------
// Start from a static coverage solution, then local-search swaps to maximize
// the resilience score (0.6*avg scenario + 0.4*worst). Deterministic.
export function resilientSelect(k, opts) {
  const { focus = "population", balance = 0.5, thresholdMin = 15, closedRoadId = null, unavailableSiteId = null } = opts;
  let selected = greedyMaxCoverage(k, { focus, balance, thresholdMin });

  const score = (ids) =>
    evaluateLayout(ids, { focus, balance, thresholdMin, closedRoadId, unavailableSiteId }).resilienceScore;

  let bestScore = score(selected);
  let improved = true;
  let passes = 0;
  while (improved && passes < 4) {
    improved = false;
    passes++;
    for (let i = 0; i < selected.length; i++) {
      let localBestSwap = null;
      let localBestScore = bestScore;
      for (const c of candidates) {
        if (selected.includes(c.id)) continue;
        const trial = [...selected];
        trial[i] = c.id;
        const s = score(trial);
        if (s > localBestScore) {
          localBestScore = s;
          localBestSwap = c.id;
        }
      }
      if (localBestSwap) {
        selected[i] = localBestSwap;
        bestScore = localBestScore;
        improved = true;
      }
    }
  }
  return selected;
}

// --- Public API: choose strategy by planning goal ------------------------
export function optimize({ goal, k, focus, balance, thresholdMin, closedRoadId, unavailableSiteId }) {
  const opts = { focus, balance, thresholdMin, closedRoadId, unavailableSiteId };
  if (goal === "travel_time") {
    return greedyPMedian(k, { focus, balance });
  }
  if (goal === "resilient") {
    return resilientSelect(k, opts);
  }
  // default: cover_more_people -> static coverage
  return greedyMaxCoverage(k, { focus, balance, thresholdMin });
}

// --- Areas needing attention --------------------------------------------
// Demand points with the weakest modeled access under the current layout.
export function areasNeedingAttention(selectedIds, { focus = "population", balance = 0.5, thresholdMin = 15, closedRoadId = null, unavailableSiteId = null } = {}) {
  const result = evaluateLayout(selectedIds, { focus, balance, thresholdMin, closedRoadId, unavailableSiteId });
  const rows = demand.map((d) => {
    const w = getDemandWeight(d, focus, balance);
    const normal = result.assignments[d.id];
    // find worst scenario time
    let worstTime = normal ? normal.time : Infinity;
    let worstScenario = "Normal";
    for (const ps of result.perScenario.slice(1)) {
      const a = ps.assignments[d.id];
      if (a && a.time > worstTime) {
        worstTime = a.time;
        worstScenario = scenarioLabel(ps.scenario);
      }
    }
    return {
      id: d.id,
      lat: d.lat,
      lng: d.lng,
      weight: w,
      population: d.population,
      closestSiteId: normal ? normal.siteId : null,
      time: normal ? normal.time : Infinity,
      worstTime,
      worstScenario,
    };
  });
  rows.sort((a, b) => b.time - a.time);
  return rows.slice(0, 8);
}

export function scenarioLabel(scenario) {
  switch (scenario.type) {
    case "winter":
      return "Winter Weather";
    case "road_closure":
      return "Road Closure";
    case "resource_unavailable":
      return "Resource Unavailable";
    case "temporary_event":
      return "Temporary Event";
    default:
      return "Normal";
  }
}

// --- Why this location? --------------------------------------------------
export function explainSite(siteId, selectedIds, opts) {
  const { focus = "population", balance = 0.5, thresholdMin = 15, closedRoadId = null, unavailableSiteId = null } = opts;
  const site = candidates.find((c) => c.id === siteId);
  if (!site) return null;
  const withSite = evaluateLayout(selectedIds, { focus, balance, thresholdMin, closedRoadId, unavailableSiteId });
  const withoutSite = evaluateLayout(selectedIds.filter((id) => id !== siteId), { focus, balance, thresholdMin, closedRoadId, unavailableSiteId });

  // demand reached by this site uniquely
  let peopleReached = 0;
  let uniqueReached = 0;
  for (const d of demand) {
    const w = getDemandWeight(d, focus, balance);
    const t = travelTimeMin(d, site, { type: "normal" });
    if (t <= thresholdMin) {
      peopleReached += w;
      // is it covered by another selected site too?
      let coveredByOther = false;
      for (const id of selectedIds) {
        if (id === siteId) continue;
        const s = candidates.find((c) => c.id === id);
        if (travelTimeMin(d, s, { type: "normal" }) <= thresholdMin) {
          coveredByOther = true;
          break;
        }
      }
      if (!coveredByOther) uniqueReached += w;
    }
  }

  const improvement = withSite.normalCoverage - withoutSite.normalCoverage;
  const backupCoverage = peopleReached - uniqueReached;
  const worstContribution = withoutSite.worstCoverage - withSite.worstCoverage; // positive means site helps worst-case

  return {
    siteId,
    peopleReached,
    uniqueReached,
    improvement,
    backupCoverage,
    worstContribution,
    normalCoverage: withSite.normalCoverage,
    worstCoverage: withSite.worstCoverage,
  };
}

// --- What if we had more resources? --------------------------------------
export function resourceCoverageCurve(maxK, opts) {
  const { goal = "cover_more_people", focus = "population", balance = 0.5, thresholdMin = 15 } = opts;
  const points = [];
  for (let k = 1; k <= maxK; k++) {
    const ids = optimize({ goal, k, focus, balance, thresholdMin });
    const r = evaluateLayout(ids, { focus, balance, thresholdMin });
    points.push({ k, coverage: r.normalCoverage });
  }
  return points;
}

// --- Simulation (Monte Carlo-ish, deterministic) -------------------------
export function runSimulation({ selectedIds, focus = "population", balance = 0.5, thresholdMin = 15, trials = 10000, closedRoadId = null, unavailableSiteId = null }) {
  // Deterministic pseudo-sampling: perturb demand weights and threshold
  // slightly per trial using a fixed seed, then collect coverage + times.
  let seed = 76543 + selectedIds.length * 131;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const times = [];
  let withinGoal = 0;
  const scenarios = resilienceScenarios(closedRoadId, unavailableSiteId);
  const scenarioCov = scenarios.map(() => 0);
  for (let i = 0; i < trials; i++) {
    // pick a scenario weighted
    const si = Math.floor(rng() * scenarios.length);
    const sc = scenarios[si];
    // perturb threshold a bit
    const thr = thresholdMin * (0.9 + rng() * 0.2);
    const r = evaluateScenario(selectedIds, sc, focus, balance, thr);
    scenarioCov[si] += r.coverage;
    times.push(r.avgTime);
    if (r.coverage >= 0.9) withinGoal++;
  }
  times.sort((a, b) => a - b);
  const pct = (p) => times[Math.min(times.length - 1, Math.floor(p * times.length))];
  return {
    trials,
    mean: times.reduce((s, t) => s + t, 0) / times.length,
    median: pct(0.5),
    p90: pct(0.9),
    p95: pct(0.95),
    min: times[0],
    withinGoal: withinGoal / trials,
    scenarioCoverage: scenarios.map((s, i) => ({ scenario: s, coverage: scenarioCov[i] / (trials / scenarios.length) })),
  };
}