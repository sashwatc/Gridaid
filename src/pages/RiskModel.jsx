import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import PageShell from "@/components/gridaid/PageShell";

export default function RiskModel() {
  const [open, setOpen] = useState(false);
  return (
    <PageShell wide>
      <h1 className="text-3xl font-semibold tracking-tight">Risk Model Information</h1>
      <p className="mt-3 text-muted-foreground">
        The model estimates relative transportation incident risk. It does not predict every emergency, medical emergency, or actual response need.
      </p>

      <div className="mt-8 rounded-xl border border-border p-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Purpose" value="Estimate relative transportation incident risk across the study area." />
          <Field label="Data Used" value="Historical crashes, traffic volume, truck traffic, road type, speed limit, road length, intersection density, season, weather/surface, work zones." />
          <Field label="Geographic Area" value="Scott County / Davenport, Iowa (demonstration)." />
          <Field label="Model Version" value="Demo v0.1 (synthetic)" />
          <Field label="Last Updated" value="2026-09" />
          <Field label="Performance" value="Held-out evaluation pending real data; demo uses a deterministic proxy." />
          <Field label="Known Limitations" value="Relative risk only; not a prediction of specific incidents or emergencies." />
        </dl>
      </div>

      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-6 flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        Technical Model Card
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-border bg-muted/30 p-5">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Target" value="Relative incident risk score (0–1)" />
            <Field label="Features" value="Crash history, AADT, truck %, road class, speed limit, length, intersection density, season, surface condition, work zones" />
            <Field label="Split Strategy" value="Time-based train/test, geographic holdout" />
            <Field label="Evaluation Metrics" value="ROC-AUC, precision-recall, calibration" />
            <Field label="Dependency Version" value="scikit-learn (latest stable)" />
            <Field label="Cybersecurity" value="No personal data ingested; model artifacts versioned and signed" />
            <Field label="Training-Data Period" value="Pending real data feed (demo uses synthetic)" />
          </dl>
        </div>
      )}
    </PageShell>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}