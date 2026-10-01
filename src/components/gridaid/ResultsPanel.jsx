import React, { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, FlaskConical } from "lucide-react";
import InfoTooltip from "./InfoTooltip";

function MetricCard({ label, value, sub, tooltip, accent }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${accent || "text-foreground"}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export default function ResultsPanel({
  result,
  layoutMode,
  thresholdMin,
  isRunning,
  hasRun,
  onTestDisruption,
  onCompare,
  onRunSimulation,
  onShowAttention,
  onMoreInsights,
}) {
  const [details, setDetails] = useState(false);

  if (isRunning) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-muted border-t-[#0f766e]" />
        <p className="text-sm text-muted-foreground">Comparing possible resource layouts…</p>
      </div>
    );
  }

  if (!hasRun || !result) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="rounded-full bg-muted p-3">
          <FlaskConical className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Choose your planning settings and click “Find Best Locations.”
        </p>
      </div>
    );
  }

  const cov = (result.normalCoverage * 100).toFixed(0);
  const worst = (result.worstCoverage * 100).toFixed(0);
  const avg = result.avgTime.toFixed(1);
  const avgScenario = (result.avgScenarioCoverage * 100).toFixed(0);

  const message = layoutMessage(layoutMode, result, thresholdMin);

  // advanced metrics
  const times = Object.values(result.assignments)
    .map((a) => a.time)
    .filter((t) => isFinite(t))
    .sort((a, b) => a - b);
  const pct = (p) => times[Math.min(times.length - 1, Math.floor(p * times.length))];
  const median = pct(0.5);
  const p90 = pct(0.9);
  const p95 = pct(0.95);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">Results</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {layoutModeLabel(layoutMode)}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard
          label="Coverage"
          value={`${cov}%`}
          sub="Demand within modeled coverage range"
          tooltip="Percent of modeled demand within the selected modeled travel-time range."
          accent="text-[#0f766e]"
        />
        <MetricCard
          label="Lowest Scenario Coverage"
          value={`${worst}%`}
          sub="Worst tested disruption"
          tooltip="The lowest coverage across the tested disruption scenarios. Technical name: worst-case coverage."
        />
        <MetricCard
          label="Average Modeled Travel Time"
          value={`${avg} min`}
          sub="Demand-weighted"
          tooltip="Average modeled travel time from demand to its closest selected resource. Not actual response time."
        />
        <MetricCard
          label="Average Scenario Coverage"
          value={`${avgScenario}%`}
          sub="Across disruptions"
          tooltip="Average coverage across the tested disruption scenarios."
        />
      </div>

      <button
        onClick={() => setDetails((d) => !d)}
        className="flex items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        {details ? "Hide details" : "View more details"}
        {details ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {details && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <div className="grid grid-cols-2 gap-y-1.5">
            <span className="text-muted-foreground">Median travel time</span>
            <span className="text-right tabular-nums">{median.toFixed(1)} min</span>
            <span className="text-muted-foreground">P90 travel time</span>
            <span className="text-right tabular-nums">{p90.toFixed(1)} min</span>
            <span className="text-muted-foreground">P95 travel time</span>
            <span className="text-right tabular-nums">{p95.toFixed(1)} min</span>
            <span className="text-muted-foreground">Resilience score</span>
            <span className="text-right tabular-nums">{(result.resilienceScore * 100).toFixed(0)}</span>
          </div>
          <div className="mt-3 border-t border-border pt-2">
            <div className="mb-1 text-xs font-medium text-muted-foreground">Scenario-by-scenario</div>
            <div className="space-y-1">
              {result.perScenario.map((ps, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{scenarioName(ps.scenario)}</span>
                  <span className="tabular-nums">{(ps.coverage * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-auto space-y-2 border-t border-border pt-3">
        <button
          onClick={onTestDisruption}
          className="w-full rounded-lg bg-[#d97706] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#b3690b]"
        >
          Test a Disruption
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onCompare}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent/50"
          >
            Compare Plans
          </button>
          <button
            onClick={onRunSimulation}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent/50"
          >
            Run Simulation
          </button>
        </div>
        <button
          onClick={onShowAttention}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Areas Needing Attention
        </button>
        <button
          onClick={onMoreInsights}
          className="w-full text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          More Insights →
        </button>
      </div>
    </div>
  );
}

function layoutModeLabel(mode) {
  if (mode === "baseline") return "Starting Layout";
  if (mode === "static") return "Optimized";
  if (mode === "resilient") return "Resilient";
  return "Layout";
}

function scenarioName(scenario) {
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

function layoutMessage(mode, result, thresholdMin) {
  const cov = (result.normalCoverage * 100).toFixed(0);
  const worst = (result.worstCoverage * 100).toFixed(0);
  if (mode === "baseline") {
    return `This starting layout covers ${cov}% of modeled demand under normal conditions and maintains at least ${worst}% across the tested disruption scenarios.`;
  }
  if (mode === "resilient") {
    return `This resilient layout covers ${cov}% under normal conditions and maintains at least ${worst}% across disruptions. It may trade some normal-condition coverage for steadier performance when conditions change.`;
  }
  return `This layout covers ${cov}% of modeled demand under normal conditions and maintains at least ${worst}% across the tested disruption scenarios.`;
}