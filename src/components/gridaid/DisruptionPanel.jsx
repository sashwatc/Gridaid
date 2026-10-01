import React from "react";
import { Snowflake, Route as Road, Ban, CalendarPlus, X } from "lucide-react";
import InfoTooltip from "./InfoTooltip";

const CHOICES = [
  {
    value: "winter",
    label: "Winter Weather",
    desc: "Slowdown across the road network",
    icon: Snowflake,
  },
  {
    value: "road_closure",
    label: "Road Closure",
    desc: "Close a road on the map",
    icon: Road,
  },
  {
    value: "resource_unavailable",
    label: "Resource Unavailable",
    desc: "Remove a resource",
    icon: Ban,
  },
  {
    value: "temp_event",
    label: "Temporary Event",
    desc: "Add temporary demand",
    icon: CalendarPlus,
  },
];

const WINTER_LEVELS = [
  { value: "mild", label: "Mild", mult: 1.25 },
  { value: "moderate", label: "Moderate", mult: 1.5 },
  { value: "severe", label: "Severe", mult: 2.0 },
];

const TEMP_LEVELS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

function DiffRow({ before, after }) {
  const diff = after - before;
  const sign = diff > 0 ? "+" : "";
  return (
    <div className="grid grid-cols-3 gap-2 text-center text-sm">
      <div className="rounded-md bg-muted/40 p-2">
        <div className="text-xs text-muted-foreground">Before</div>
        <div className="font-semibold tabular-nums">{(before * 100).toFixed(0)}%</div>
      </div>
      <div className="rounded-md bg-muted/40 p-2">
        <div className="text-xs text-muted-foreground">After</div>
        <div className="font-semibold tabular-nums">{(after * 100).toFixed(0)}%</div>
      </div>
      <div className={`rounded-md p-2 ${diff < 0 ? "bg-[#d97706]/10" : "bg-muted/40"}`}>
        <div className="text-xs text-muted-foreground">Difference</div>
        <div className={`font-semibold tabular-nums ${diff < 0 ? "text-[#d97706]" : ""}`}>
          {sign}{(diff * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  );
}

export default function DisruptionPanel({
  disruptionType,
  setDisruptionType,
  winterSeverity,
  setWinterSeverity,
  closedRoadId,
  onRemoveClosure,
  unavailableSiteId,
  tempLevel,
  setTempLevel,
  beforeCoverage,
  afterCoverage,
  affectedAreas,
  onClose,
}) {
  return (
    <div>
      {!disruptionType ? (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Choose a disruption to see how this layout performs when conditions change.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {CHOICES.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.value}
                  onClick={() => setDisruptionType(c.value)}
                  className="flex flex-col items-start gap-2 rounded-xl border border-border p-4 text-left transition-all hover:border-[#d97706] hover:bg-[#d97706]/5"
                >
                  <Icon className="h-6 w-6 text-[#d97706]" />
                  <div>
                    <div className="text-sm font-semibold text-foreground">{c.label}</div>
                    <div className="text-xs text-muted-foreground">{c.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setDisruptionType(null)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to disruption choices
            </button>
            <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {disruptionType === "winter" && (
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">How severe should the slowdown be?</span>
                <InfoTooltip text="Winter conditions increase modeled travel time on affected roads." />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {WINTER_LEVELS.map((w) => (
                  <button
                    key={w.value}
                    onClick={() => setWinterSeverity(w.value)}
                    className={`rounded-lg border p-3 text-center transition-all ${
                      winterSeverity === w.value
                        ? "border-[#d97706] bg-[#d97706]/5"
                        : "border-border hover:bg-accent/50"
                    }`}
                  >
                    <div className="text-sm font-medium">{w.label}</div>
                    <div className="text-xs text-muted-foreground">{w.mult}×</div>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Winter conditions increase modeled travel time on affected roads.
              </p>
            </div>
          )}

          {disruptionType === "road_closure" && (
            <div>
              <p className="text-sm text-muted-foreground">
                Click a road on the map to temporarily close it.
              </p>
              {closedRoadId && (
                <>
                  <div className="mt-3 flex items-center gap-2 rounded-md bg-[#d97706]/10 px-3 py-2 text-sm">
                    <Road className="h-4 w-4 text-[#d97706]" />
                    <span className="font-medium text-foreground">Road closed</span>
                  </div>
                  <button
                    onClick={onRemoveClosure}
                    className="mt-2 text-sm font-medium text-[#d97706] hover:underline"
                  >
                    Remove closure
                  </button>
                </>
              )}
            </div>
          )}

          {disruptionType === "resource_unavailable" && (
            <div>
              <p className="text-sm text-muted-foreground">
                Click a resource marker on the map to test what happens if it becomes unavailable.
              </p>
              {unavailableSiteId && (
                <div className="mt-3 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                  <Ban className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">Resource removed</span>
                </div>
              )}
            </div>
          )}

          {disruptionType === "temp_event" && (
            <div>
              <p className="text-sm text-muted-foreground">
                Click a location on the map, then choose how much temporary demand to add.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {TEMP_LEVELS.map((l) => (
                  <button
                    key={l.value}
                    onClick={() => setTempLevel(l.value)}
                    className={`rounded-lg border p-3 text-center text-sm font-medium transition-all ${
                      tempLevel === l.value
                        ? "border-[#d97706] bg-[#d97706]/5"
                        : "border-border hover:bg-accent/50"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                This adds temporary modeled demand to test how placement performs during a large event. It does not predict actual emergencies.
              </p>
            </div>
          )}

          {beforeCoverage != null && afterCoverage != null && (
            <div className="space-y-3">
              <div className="text-sm font-medium">Coverage impact</div>
              <DiffRow before={beforeCoverage} after={afterCoverage} />
              {affectedAreas && affectedAreas.length > 0 && (
                <div>
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                    Areas most affected
                  </div>
                  <div className="space-y-1">
                    {affectedAreas.slice(0, 4).map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded-md bg-muted/40 px-2.5 py-1.5 text-xs">
                        <span className="text-muted-foreground">
                          Pop. {a.population.toLocaleString()}
                        </span>
                        <span className="tabular-nums text-foreground">
                          +{a.timeIncrease.toFixed(1)} min
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}