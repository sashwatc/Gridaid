import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function WhyThisLocation({ explanation, siteId, onClose }) {
  const [tech, setTech] = useState(false);
  if (!explanation) return null;

  const items = [
    {
      label: "People or Demand Reached",
      value: Math.round(explanation.peopleReached).toLocaleString(),
      desc: "Modeled demand within coverage range of this location.",
    },
    {
      label: "Improvement to Coverage",
      value: `${(explanation.improvement * 100).toFixed(1)}%`,
      desc: "How much normal coverage drops if this location is removed.",
    },
    {
      label: "Backup Coverage",
      value: Math.round(explanation.backupCoverage).toLocaleString(),
      desc: "Demand here also covered by another selected resource.",
    },
    {
      label: "Performance During Disruptions",
      value: explanation.worstContribution >= 0 ? "Helps" : "Limited",
      desc: "Whether this location supports worst-case scenario coverage.",
    },
  ];

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        This location helps cover areas that were farther from other selected resources and remains useful during several tested disruption scenarios.
      </p>
      <div className="space-y-2.5">
        {items.map((it) => (
          <div key={it.label} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{it.label}</span>
              <span className="text-sm font-semibold tabular-nums text-[#0f766e]">{it.value}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{it.desc}</p>
          </div>
        ))}
      </div>

      <button
        onClick={() => setTech((t) => !t)}
        className="mt-4 flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        Technical Details
        {tech ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {tech && (
        <div className="mt-2 grid grid-cols-2 gap-y-1.5 rounded-lg border border-border bg-muted/30 p-3 text-xs">
          <span className="text-muted-foreground">Unique weighted demand</span>
          <span className="text-right tabular-nums">{Math.round(explanation.uniqueReached).toLocaleString()}</span>
          <span className="text-muted-foreground">Marginal improvement</span>
          <span className="text-right tabular-nums">{(explanation.improvement * 100).toFixed(2)}%</span>
          <span className="text-muted-foreground">Redundancy (backup)</span>
          <span className="text-right tabular-nums">{Math.round(explanation.backupCoverage).toLocaleString()}</span>
          <span className="text-muted-foreground">Normal contribution</span>
          <span className="text-right tabular-nums">{(explanation.normalCoverage * 100).toFixed(0)}%</span>
          <span className="text-muted-foreground">Worst-case contribution</span>
          <span className="text-right tabular-nums">{(explanation.worstContribution * 100).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}