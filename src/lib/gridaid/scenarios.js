// Scenario modifiers for GridAid. A scenario describes how modeled travel
// times and demand change relative to normal conditions. All scenario
// objects carry a provenance label.

export const WINTER_MULTIPLIERS = {
  mild: 1.25,
  moderate: 1.5,
  severe: 2.0,
};

export const TEMP_DEMAND_LEVELS = {
  low: 800,
  medium: 2000,
  high: 4000,
};

// Build a scenario object from user choices.
// type: 'normal' | 'winter' | 'road_closure' | 'resource_unavailable' | 'temporary_event'
export function buildScenario({ type, winterSeverity = "moderate", closedRoadId = null, unavailableSiteId = null, tempEvent = null } = {}) {
  const base = { type, provenance: "SYNTHETIC DEMO" };
  if (type === "winter") {
    return { ...base, winterMultiplier: WINTER_MULTIPLIERS[winterSeverity] || 1.5 };
  }
  if (type === "road_closure") {
    return { ...base, closedRoadId };
  }
  if (type === "resource_unavailable") {
    return { ...base, unavailableSiteId };
  }
  if (type === "temporary_event") {
    return { ...base, tempEvent };
  }
  return { ...base, type: "normal" };
}

// The set of scenarios used to score resilience (average + worst case).
export function resilienceScenarios(closedRoadId, unavailableSiteId) {
  return [
    buildScenario({ type: "normal" }),
    buildScenario({ type: "winter", winterSeverity: "moderate" }),
    buildScenario({ type: "road_closure", closedRoadId }),
    buildScenario({ type: "resource_unavailable", unavailableSiteId }),
  ];
}