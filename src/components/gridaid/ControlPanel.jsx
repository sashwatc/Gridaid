import React, { useState } from "react";
import { ChevronDown, ChevronUp, Sparkles, Play } from "lucide-react";
import InfoTooltip from "./InfoTooltip";

const GOALS = [
  {
    value: "cover_more_people",
    label: "Cover More People",
    desc: "Maximize modeled demand reached within the coverage time.",
  },
  {
    value: "travel_time",
    label: "Reduce Travel Time",
    desc: "Lower modeled travel time across the area.",
  },
  {
    value: "resilient",
    label: "Stay Strong During Disruptions",
    desc: "Pick locations that hold up across several situations.",
  },
];

const FOCUSES = [
  { value: "population", label: "Population", desc: "Focus on where people live." },
  { value: "risk", label: "Transportation Risk", desc: "Focus on higher relative incident risk." },
  { value: "balanced", label: "Balanced", desc: "Use both population and risk." },
];

function SectionLabel({ children, tooltip }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm font-medium text-foreground">{children}</span>
      {tooltip && <InfoTooltip text={tooltip} />}
    </div>
  );
}

export default function ControlPanel({
  resourceCount,
  setResourceCount,
  goal,
  setGoal,
  focus,
  setFocus,
  balance,
  setBalance,
  thresholdMin,
  setThresholdMin,
  objectiveOverride,
  setObjectiveOverride,
  winterMultiplier,
  setWinterMultiplier,
  resilienceWeight,
  setResilienceWeight,
  trials,
  setTrials,
  onFindBest,
  onGuidedDemo,
  isRunning,
}) {
  const [advanced, setAdvanced] = useState(false);

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4">
      {/* Resources */}
      <div>
        <SectionLabel>How many resources are available?</SectionLabel>
        <div className="mt-3 flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={25}
            value={resourceCount}
            onChange={(e) => setResourceCount(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-[#0f766e]"
          />
          <span className="w-9 text-center text-lg font-semibold tabular-nums text-foreground">
            {resourceCount}
          </span>
        </div>
      </div>

      {/* Planning Goal */}
      <div>
        <SectionLabel tooltip="GridAid compares possible resource layouts and selects locations based on the chosen goal.">
          What should GridAid prioritize?
        </SectionLabel>
        <div className="mt-3 space-y-2">
          {GOALS.map((g) => {
            const active = goal === g.value;
            return (
              <button
                key={g.value}
                onClick={() => setGoal(g.value)}
                className={`w-full rounded-lg border p-3 text-left transition-all ${
                  active
                    ? "border-[#0f766e] bg-[#0f766e]/5 ring-1 ring-[#0f766e]/30"
                    : "border-border hover:border-muted-foreground/40 hover:bg-accent/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                      active ? "border-[#0f766e]" : "border-muted-foreground/40"
                    }`}
                  >
                    {active && <span className="h-2 w-2 rounded-full bg-[#0f766e]" />}
                  </span>
                  <span className="text-sm font-medium text-foreground">{g.label}</span>
                </div>
                <p className="mt-1.5 pl-6 text-xs leading-relaxed text-muted-foreground">
                  {g.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Focus */}
      <div>
        <SectionLabel tooltip="Demand is modeled from population, relative transportation incident risk, or a blend of both.">
          What should the model focus on?
        </SectionLabel>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {FOCUSES.map((f) => {
            const active = focus === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setFocus(f.value)}
                className={`rounded-md border px-2 py-2 text-center text-xs font-medium transition-all ${
                  active
                    ? "border-[#0f766e] bg-[#0f766e]/5 text-[#0f766e]"
                    : "border-border text-muted-foreground hover:bg-accent/50"
                }`}
                title={f.desc}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        {focus === "balanced" && (
          <div className="mt-3 rounded-md border border-border bg-muted/30 p-2.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Population</span>
              <span>Transportation Risk</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(balance * 100)}
              onChange={(e) => setBalance(Number(e.target.value) / 100)}
              className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[#0f766e]"
            />
          </div>
        )}
      </div>

      {/* Main action */}
      <button
        onClick={onFindBest}
        disabled={isRunning}
        className="flex items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0c5d56] disabled:opacity-60"
      >
        <Sparkles className="h-4 w-4" />
        {isRunning ? "Comparing layouts…" : "Find Best Locations"}
      </button>

      <button
        onClick={onGuidedDemo}
        className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50"
      >
        <Play className="h-3.5 w-3.5" />
        Show me how it works
      </button>

      {/* Advanced Options */}
      <div className="border-t border-border pt-3">
        <button
          onClick={() => setAdvanced((a) => !a)}
          className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Advanced Options
          {advanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {advanced && (
          <div className="mt-3 space-y-4">
            <div>
              <SectionLabel tooltip="Areas are considered covered if a selected resource can reach them within this modeled travel time.">
                Coverage Time
              </SectionLabel>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={60}
                  value={thresholdMin}
                  onChange={(e) => setThresholdMin(Number(e.target.value))}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-[#0f766e]"
                />
                <span className="w-16 text-right text-sm tabular-nums text-foreground">
                  {thresholdMin} min
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Modeled travel time, not actual response time.</p>
            </div>

            <div>
              <SectionLabel tooltip="Override the automatic objective chosen by your planning goal.">
                Objective
              </SectionLabel>
              <select
                value={objectiveOverride}
                onChange={(e) => setObjectiveOverride(e.target.value)}
                className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value="auto">Auto (from planning goal)</option>
                <option value="baseline">Starting Layout</option>
                <option value="static">Static (cover more people)</option>
                <option value="resilient">Resilient</option>
              </select>
            </div>

            <div>
              <SectionLabel tooltip="Multiplier applied to modeled travel time during winter scenarios.">
                Winter Multiplier
              </SectionLabel>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={2.5}
                  step={0.05}
                  value={winterMultiplier}
                  onChange={(e) => setWinterMultiplier(Number(e.target.value))}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-[#0f766e]"
                />
                <span className="w-12 text-right text-sm tabular-nums">{winterMultiplier.toFixed(2)}×</span>
              </div>
            </div>

            <div>
              <SectionLabel tooltip="Weighting between average and worst-case scenario coverage in the resilience score.">
                Resilience Weighting
              </SectionLabel>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(resilienceWeight * 100)}
                  onChange={(e) => setResilienceWeight(Number(e.target.value) / 100)}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-[#0f766e]"
                />
                <span className="w-12 text-right text-sm tabular-nums">
                  {Math.round(resilienceWeight * 100)}%
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Resilience Score = {(resilienceWeight).toFixed(1)} × avg + {(1 - resilienceWeight).toFixed(1)} × worst
              </p>
            </div>

            <div>
              <SectionLabel tooltip="Number of trials used by the simulation tool.">
                Simulation Trials
              </SectionLabel>
              <input
                type="number"
                min={100}
                max={100000}
                step={100}
                value={trials}
                onChange={(e) => setTrials(Math.max(100, Math.min(100000, Number(e.target.value))))}
                className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}