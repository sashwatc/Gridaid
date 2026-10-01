import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import PageShell from "@/components/gridaid/PageShell";

const TESTS = [
  {
    title: "Route Testing",
    summary: "Check that GridAid finds the same shortest route as a trusted reference method.",
    tech: "Compare NetworkX Dijkstra results against a reference implementation on shared OSM extracts; assert equal path cost on sampled OD pairs.",
  },
  {
    title: "Optimization Testing",
    summary: "Use small problems where every possible configuration can be checked.",
    tech: "Brute-force enumeration on k≤4, n≤12 candidate sets; assert greedy/local-search results match or improve the brute-force optimum within tolerance.",
  },
  {
    title: "Disruption Testing",
    summary: "Verify that closing roads or removing resources actually changes results.",
    tech: "Assert coverage decreases when a load-bearing road closes or a high-contribution resource is removed; assert no change when unaffected.",
  },
  {
    title: "Resilience Testing",
    summary: "Verify that resilience optimization can choose a different layout when disruption risk matters.",
    tech: "Construct cases where the max-coverage layout is fragile under disruption; assert resilient selection differs and improves worst-case coverage.",
  },
  {
    title: "Risk Model Testing",
    summary: "Evaluate ML performance using held-out data.",
    tech: "Time-based train/test split; report ROC-AUC and precision-recall on held-out segments; no leakage across time or geography.",
  },
];

export default function Validation() {
  return (
    <PageShell wide>
      <h1 className="text-3xl font-semibold tracking-tight">How We Test GridAid</h1>
      <p className="mt-3 text-muted-foreground">
        GridAid is checked at several levels so its modeled results stay meaningful.
      </p>
      <div className="mt-8 space-y-4">
        {TESTS.map((t) => (
          <TestSection key={t.title} {...t} />
        ))}
      </div>
    </PageShell>
  );
}

function TestSection({ title, summary, tech }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border p-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{summary}</p>
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