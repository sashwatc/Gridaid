import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Layers, FlaskConical, GitCompare, ShieldCheck } from "lucide-react";
import TopNav from "@/components/gridaid/TopNav";
import Footer from "@/components/gridaid/Footer";
import MapView from "@/components/gridaid/MapView";
import { getBaselineIds } from "@/lib/gridaid";

const BASELINE = getBaselineIds();

const CARDS = [
  {
    icon: MapPin,
    title: "Plan",
    desc: "Choose how many resources are available.",
  },
  {
    icon: FlaskConical,
    title: "Test",
    desc: "Simulate disruptions such as road closures or winter conditions.",
  },
  {
    icon: GitCompare,
    title: "Compare",
    desc: "See which placement stays strongest across different situations.",
  },
];

export default function Landing() {
  const [layers, setLayers] = useState({
    roads: true,
    population: true,
    risk: false,
    candidates: false,
    resources: true,
    coverage: true,
    disruptions: false,
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-center gap-10 py-12 lg:grid-cols-2 lg:py-20">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0f766e]" />
                Scott County / Davenport, Iowa — demonstration area
              </div>
              <h1 className="mt-5 text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
                GridAid
              </h1>
              <p className="mt-3 text-xl font-medium text-foreground">
                Plan smarter. Test disruptions. Build stronger coverage.
              </p>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
                GridAid helps communities explore how limited resources could be
                positioned across an area and how those placements perform during
                road closures, winter weather, resource outages, and temporary demand.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to="/workspace"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0f766e] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0c5d56]"
                >
                  Explore Iowa Demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/how-it-works"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent/50"
                >
                  How It Works
                </Link>
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
                No account, no login, no personal information collected.
              </div>
            </div>

            {/* Map preview */}
            <div className="relative h-[360px] overflow-hidden rounded-2xl border border-border shadow-lg lg:h-[440px]">
              <MapView
                layers={layers}
                setLayers={setLayers}
                selectedIds={BASELINE}
                baselineIds={BASELINE}
                recommendedIds={[]}
                thresholdMin={15}
                assignments={{}}
                focus="population"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/80 to-transparent p-4">
                <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Layers className="h-4 w-4" />
                  Starting layout — Scott County / Davenport
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Three cards */}
        <section className="border-t border-border bg-muted/20">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-12 sm:px-6 sm:grid-cols-3">
            {CARDS.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.title} className="rounded-xl border border-border bg-background p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0f766e]/10 text-[#0f766e]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">{c.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{c.desc}</p>
                </div>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}