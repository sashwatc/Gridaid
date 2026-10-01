import React, { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import InfoTooltip from "./InfoTooltip";

function PlanCard({ title, result, accent }) {
  if (!result) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-center">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <p className="mt-2 text-xs text-muted-foreground">Not yet calculated.</p>
      </div>
    );
  }
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-[#0f766e] bg-[#0f766e]/5" : "border-border"}`}>
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <div className="mt-3 space-y-2.5">
        <Row label="Normal Coverage" value={`${(result.normalCoverage * 100).toFixed(0)}%`} />
        <Row
          label="Worst-Case Coverage"
          value={`${(result.worstCoverage * 100).toFixed(0)}%`}
          tooltip="Lowest coverage across tested disruption scenarios."
        />
        <Row label="Average Travel Time" value={`${result.avgTime.toFixed(1)} min`} />
      </div>
    </div>
  );
}

function Row({ label, value, tooltip }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">{label}</span>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

export default function ComparePlans({ baseline, optimized, resilient, onViewDetailed, detailed, detailedData, onClose }) {
  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        The best layout under normal conditions is not always the layout that performs best when conditions change.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <PlanCard title="Starting Layout" result={baseline} />
        <PlanCard title="Optimized" result={optimized} accent />
        <PlanCard title="Resilient" result={resilient} accent />
      </div>

      <button
        onClick={onViewDetailed}
        className="mt-4 text-sm font-medium text-[#0f766e] hover:underline"
      >
        {detailed ? "Hide detailed comparison" : "View Detailed Comparison"}
      </button>

      {detailed && detailedData && (
        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
          <div className="mb-3 text-sm font-medium">Coverage by scenario</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={detailedData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <XAxis dataKey="scenario" tick={{ fontSize: 11 }} interval={0} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v) => `${v}%`} contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="baseline" name="Starting" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                <Bar dataKey="optimized" name="Optimized" fill="#0f766e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="resilient" name="Resilient" fill="#0d9488" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#94a3b8]" /> Starting</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#0f766e]" /> Optimized</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#0d9488]" /> Resilient</span>
          </div>
        </div>
      )}
    </div>
  );
}