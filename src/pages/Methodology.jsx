import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import PageShell from "@/components/gridaid/PageShell";

const SECTIONS = [
  {
    title: "Routing",
    body: "GridAid follows the road network to estimate travel between resource locations and demand areas. The production backend uses OpenStreetMap, OSMnx, NetworkX, and Dijkstra shortest paths. The demonstration version uses a deterministic network-distance approximation so results are stable.",
    tech: "OSMnx · NetworkX · Dijkstra · Shapely · GeoPandas",
  },
  {
    title: "Optimization",
    body: "GridAid compares possible resource configurations and selects locations based on the chosen goal: maximum coverage, weighted travel time, or resilience. The production backend may use OR-Tools. The demo uses deterministic greedy heuristics with local search.",
    tech: "OR-Tools · greedy max-coverage · p-median · local search",
  },
  {
    title: "Resilience",
    body: "GridAid tests the same resource layout under several disruptions (winter, road closure, resource unavailable). The resilience score combines average and worst-case scenario coverage.",
    tech: "Resilience Score = 0.6 × average scenario coverage + 0.4 × worst-case coverage",
  },
  {
    title: "Simulation",
    body: "GridAid repeatedly samples modeled demand to compare performance, reporting average, typical, P95, and percent within the coverage goal.",
    tech: "Monte Carlo-style sampling, deterministic seed",
  },
  {
    title: "Transportation Risk",
    body: "GridAid may use machine learning to estimate relative transportation incident risk from historical and roadway information. It does not predict every emergency or actual response need.",
    tech: "scikit-learn · held-out evaluation · relative risk only",
  },
];

export default function Methodology() {
  return (
    <PageShell wide>
      <h1 className="text-3xl font-semibold tracking-tight">Methodology</h1>
      <p className="mt-3 text-muted-foreground">
        How GridAid works underneath, explained simply — with technical details available for advanced users.
      </p>

      <div className="mt-8 space-y-4">
        {SECTIONS.map((s, i) => (
          <TechSection key={i} {...s} />
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-border bg-muted/30 p-5">
        <h3 className="text-base font-semibold">Backend architecture (planned)</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          The UI is designed so a real backend can replace the demonstration calculations: Python, FastAPI, Pydantic, NumPy, pandas, GeoPandas, Shapely, NetworkX, OSMnx, OR-Tools, scikit-learn, and pytest.
        </p>
      </div>
    </PageShell>
  );
}

function TechSection({ title, body, tech }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border p-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-3 flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        Technical Details
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <p className="mt-2 rounded-md bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">{tech}</p>
      )}
    </div>
  );
}