import React from "react";
import InfoTooltip from "./InfoTooltip";

export default function AreasNeedAttention({ rows, onClose }) {
  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Average performance can look strong even when some locations have weaker access. GridAid highlights these areas separately.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Area</th>
              <th className="px-3 py-2 text-right font-medium">Demand weight</th>
              <th className="px-3 py-2 text-right font-medium">Closest resource</th>
              <th className="px-3 py-2 text-right font-medium">
                <span className="flex items-center justify-end gap-1">
                  Modeled time
                  <InfoTooltip text="Modeled travel time to the closest selected resource." />
                </span>
              </th>
              <th className="px-3 py-2 text-right font-medium">Hardest scenario</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className={i % 2 ? "bg-muted/20" : ""}>
                <td className="px-3 py-2 text-muted-foreground">Area {i + 1}</td>
                <td className="px-3 py-2 text-right tabular-nums">{Math.round(r.weight).toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {r.closestSiteId ? r.closestSiteId.replace("C", "#") : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.time.toFixed(1)} min</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{r.worstScenario}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}