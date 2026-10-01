import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MousePointerClick, Sliders, Map, AlertTriangle, GitCompare } from "lucide-react";
import PageShell from "@/components/gridaid/PageShell";

const STEPS = [
  { icon: Sliders, title: "Choose how many resources to place", desc: "Set how many resources are available, from 1 to 25." },
  { icon: MousePointerClick, title: "Choose what matters most", desc: "Cover more people, reduce travel time, or stay strong during disruptions." },
  { icon: Map, title: "Run the model", desc: "GridAid compares possible layouts and shows a recommended placement on the map." },
  { icon: AlertTriangle, title: "Test a disruption", desc: "Try a road closure, winter weather, a resource outage, or a temporary event." },
  { icon: GitCompare, title: "Compare the results", desc: "See how the starting, optimized, and resilient layouts differ." },
];

export default function HowItWorks() {
  return (
    <PageShell>
      <h1 className="text-3xl font-semibold tracking-tight">How It Works</h1>
      <p className="mt-3 text-muted-foreground">
        A first-time user can complete the main workflow in a few minutes. GridAid is a planning and simulation tool — not live dispatch software.
      </p>

      <div className="mt-8 space-y-4">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="flex gap-4 rounded-xl border border-border p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0f766e]/10 text-[#0f766e]">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Step {i + 1}</span>
                  <h3 className="text-base font-semibold">{s.title}</h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-xl border border-border bg-muted/30 p-5">
        <h3 className="text-base font-semibold">The central idea</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The best layout under normal conditions is not always the layout that
          performs best when conditions change. GridAid helps you compare those
          tradeoffs instead of assuming one layout is always best.
        </p>
      </div>

      <Link
        to="/workspace"
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#0f766e] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0c5d56]"
      >
        Try the workspace <ArrowRight className="h-4 w-4" />
      </Link>
    </PageShell>
  );
}