import React from "react";
import PageShell from "@/components/gridaid/PageShell";

const SOURCES = [
  {
    name: "Roads",
    source: "OpenStreetMap",
    purpose: "Road-network routing and travel-time estimation.",
    updated: "Cached snapshot",
    type: "PUBLIC DATA",
    limitations: "Road speeds are simplified and may not reflect real-time conditions.",
    tag: "PUBLIC DATA",
  },
  {
    name: "Population",
    source: "U.S. Census / ACS 5-year",
    purpose: "Model where people live to estimate demand.",
    updated: "Latest ACS release",
    type: "PUBLIC DATA",
    limitations: "Population does not represent every emergency or service need.",
    tag: "PUBLIC DATA",
  },
  {
    name: "Transportation Data",
    source: "Public Iowa transportation data",
    purpose: "Inputs for the relative transportation incident risk model.",
    updated: "Cached snapshot",
    type: "PUBLIC DATA",
    limitations: "Historical patterns, not predictions of specific incidents.",
    tag: "CACHED DATA",
  },
  {
    name: "Disruptions",
    source: "Public, cached, expert-informed, or synthetic",
    purpose: "Test how layouts perform under changed conditions.",
    updated: "Varies by scenario",
    type: "MIXED",
    limitations: "Disruptions may be simulated and do not represent live conditions.",
    tag: "SYNTHETIC DEMO",
  },
];

const TAG_STYLES = {
  "PUBLIC DATA": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "LIVE DATA": "bg-blue-50 text-blue-700 border-blue-200",
  "CACHED DATA": "bg-amber-50 text-amber-700 border-amber-200",
  "SYNTHETIC DEMO": "bg-slate-100 text-slate-600 border-slate-200",
  "EXPERT-INFORMED": "bg-purple-50 text-purple-700 border-purple-200",
};

export default function Data() {
  return (
    <PageShell wide>
      <h1 className="text-3xl font-semibold tracking-tight">Data</h1>
      <p className="mt-3 text-muted-foreground">
        GridAid uses public data where possible and clearly labels synthetic demonstration data. Synthetic information is never presented as real.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {SOURCES.map((s) => (
          <div key={s.name} className="rounded-xl border border-border p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{s.name}</h3>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${TAG_STYLES[s.tag] || "bg-muted text-muted-foreground border-border"}`}>
                {s.tag}
              </span>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <Field label="Source" value={s.source} />
              <Field label="Purpose" value={s.purpose} />
              <Field label="Last Updated" value={s.updated} />
              <Field label="Data Type" value={s.type} />
              <Field label="Limitations" value={s.limitations} />
            </dl>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

function Field({ label, value }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}