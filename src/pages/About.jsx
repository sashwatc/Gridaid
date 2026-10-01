import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import PageShell from "@/components/gridaid/PageShell";

const SHORT_LIMITATIONS = [
  "Results are modeled, not measured.",
  "Travel time is modeled travel time, not guaranteed response time.",
  "Some resource locations may be synthetic.",
  "Disruptions may be simulated.",
  "Road speeds may be simplified.",
  "Population does not represent every emergency.",
  "Transportation risk does not represent every emergency.",
  "Staffing changes are not fully modeled.",
  "Professional dispatch decisions involve additional information.",
];

const FULL_LIMITATIONS = [
  "GridAid uses simplified transportation conditions and a deterministic network-distance approximation in the demo; production routing uses real OSM/Dijkstra paths.",
  "Population demand is based on ACS block-group representative points, not individual households.",
  "Transportation risk estimates relative incident risk from historical and roadway features; it does not predict specific accidents, medical emergencies, or response needs.",
  "Resource counts are limited to 1–25 and coverage time to 1–60 modeled minutes.",
  "Simulation trials are limited to 100–100,000.",
  "Only approved scenario and demand values are accepted; arbitrary URLs, code, models, or files are not accepted.",
  "GridAid does not request browser geolocation and collects no personal information.",
];

export default function About() {
  const [full, setFull] = useState(false);
  return (
    <PageShell>
      <h1 className="text-3xl font-semibold tracking-tight">About GridAid</h1>
      <p className="mt-3 text-muted-foreground">
        GridAid is a research and planning prototype for geospatial resilience planning. It helps users compare resource-placement strategies — it does not provide live emergency dispatch instructions or replace professional judgment.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card title="Privacy">
          GridAid collects no personal information: no accounts, usernames, emails, passwords, medical data, exact user location, or volunteer addresses. No file uploads. Browser geolocation is never requested.
        </Card>
        <Card title="Security">
          Inputs are validated and bounded. Only approved scenario and demand values are accepted. No arbitrary server URLs, code, uploaded models, unsafe HTML, or unrestricted files. The future API supports rate limiting, solver timeouts, computation caps, and safe error messages.
        </Card>
      </div>

      <div className="mt-8 rounded-xl border border-border p-5">
        <h3 className="text-base font-semibold">Assumptions & Limitations</h3>
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          {SHORT_LIMITATIONS.map((l) => (
            <li key={l} className="flex gap-2">
              <span className="text-[#0f766e]">•</span>
              {l}
            </li>
          ))}
        </ul>
        <button
          onClick={() => setFull((f) => !f)}
          className="mt-4 flex items-center gap-1.5 text-sm font-medium text-[#0f766e] hover:underline"
        >
          {full ? "Hide full limitations" : "Read full limitations"}
          {full ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {full && (
          <ul className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm text-muted-foreground">
            {FULL_LIMITATIONS.map((l) => (
              <li key={l} className="flex gap-2">
                <span className="text-[#0f766e]">•</span>
                {l}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link to="/workspace" className="mt-8 inline-block text-sm font-medium text-[#0f766e] hover:underline">
        Back to workspace →
      </Link>
    </PageShell>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-xl border border-border p-5">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}