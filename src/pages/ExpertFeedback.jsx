import React from "react";
import PageShell from "@/components/gridaid/PageShell";

const REVIEWERS = [
  "Emergency-management professionals",
  "Volunteer organizations",
  "Transportation / GIS staff",
  "Fire / EMS personnel",
  "Planners",
  "Other local experts",
];

const QUESTIONS = [
  "Does the comparison make sense?",
  "Which metric matters most?",
  "Are the disruption scenarios realistic?",
  "What assumption is unrealistic?",
  "Is better public data available?",
  "What important factor is missing?",
];

export default function ExpertFeedback() {
  return (
    <PageShell>
      <h1 className="text-3xl font-semibold tracking-tight">Expert Feedback</h1>
      <p className="mt-3 text-muted-foreground">
        The GridAid prototype can be reviewed by professionals who work with these systems. No fake endorsements are shown here — feedback appears only after it has actually been collected.
      </p>

      <div className="mt-8 rounded-xl border border-border p-5">
        <h3 className="text-base font-semibold">Who can review</h3>
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          {REVIEWERS.map((r) => (
            <li key={r} className="flex gap-2">
              <span className="text-[#0f766e]">•</span>
              {r}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 rounded-xl border border-border p-5">
        <h3 className="text-base font-semibold">Review questions</h3>
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          {QUESTIONS.map((q) => (
            <li key={q} className="flex gap-2">
              <span className="text-[#0f766e]">•</span>
              {q}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
        No feedback has been collected yet for this demonstration.
      </div>
    </PageShell>
  );
}