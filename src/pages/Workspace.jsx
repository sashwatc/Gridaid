import React, { useState, useMemo, useCallback } from "react";
import {
  getBaselineIds,
  evaluateLayout,
  evaluateScenario,
  optimize,
  areasNeedingAttention,
  explainSite,
  runSimulation,
  resourceCoverageCurve,
  buildScenario,
  TEMP_DEMAND_LEVELS,
  scenarioLabel,
  getDemand,
} from "@/lib/gridaid";

const DEMAND_BY_ID = Object.fromEntries(getDemand().map((d) => [d.id, d]));
import TopNav from "@/components/gridaid/TopNav";
import MapView from "@/components/gridaid/MapView";
import ControlPanel from "@/components/gridaid/ControlPanel";
import ResultsPanel from "@/components/gridaid/ResultsPanel";
import Modal from "@/components/gridaid/Modal";
import ComparePlans from "@/components/gridaid/ComparePlans";
import DisruptionPanel from "@/components/gridaid/DisruptionPanel";
import AreasNeedAttention from "@/components/gridaid/AreasNeedAttention";
import WhyThisLocation from "@/components/gridaid/WhyThisLocation";
import { LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Download, History } from "lucide-react";

const BASELINE_IDS = getBaselineIds();

const DEFAULT_LAYERS = {
  roads: true,
  population: true,
  risk: false,
  candidates: false,
  resources: true,
  coverage: true,
  disruptions: true,
};

export default function Workspace() {
  // --- planning settings ---
  const [resourceCount, setResourceCount] = useState(5);
  const [goal, setGoal] = useState("cover_more_people");
  const [focus, setFocus] = useState("population");
  const [balance, setBalance] = useState(0.5);
  const [thresholdMin, setThresholdMin] = useState(15);
  const [objectiveOverride, setObjectiveOverride] = useState("auto");
  const [winterMultiplier, setWinterMultiplier] = useState(1.5);
  const [resilienceWeight, setResilienceWeight] = useState(0.6);
  const [trials, setTrials] = useState(10000);

  // --- layout state ---
  const [selectedIds, setSelectedIds] = useState(BASELINE_IDS);
  const [layoutMode, setLayoutMode] = useState("baseline");
  const [result, setResult] = useState(null);
  const [hasRun, setHasRun] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // --- layers ---
  const [layers, setLayers] = useState(DEFAULT_LAYERS);

  // --- right panel view ---
  const [rightView, setRightView] = useState("results"); // 'results' | 'disruption'

  // --- disruption ---
  const [disruptionType, setDisruptionType] = useState(null);
  const [winterSeverity, setWinterSeverity] = useState("moderate");
  const [closedRoadId, setClosedRoadId] = useState(null);
  const [unavailableSiteId, setUnavailableSiteId] = useState(null);
  const [tempEvent, setTempEvent] = useState(null);
  const [tempLevel, setTempLevel] = useState("medium");

  // --- modals ---
  const [modal, setModal] = useState(null); // 'compare' | 'attention' | 'simulation' | 'insights' | 'why' | 'history' | 'export'
  const [whySite, setWhySite] = useState(null);
  const [detailedCompare, setDetailedCompare] = useState(false);

  // --- run history ---
  const [history, setHistory] = useState([]);

  // --- guided demo ---
  const [guidedStep, setGuidedStep] = useState(-1);

  const opts = { focus, balance, thresholdMin, closedRoadId, unavailableSiteId };

  // interaction mode for map
  const interactionMode = useMemo(() => {
    if (rightView !== "disruption") return "none";
    if (disruptionType === "road_closure") return "roadClosure";
    if (disruptionType === "temp_event") return "tempEvent";
    if (disruptionType === "resource_unavailable") return "resourceUnavailable";
    return "none";
  }, [rightView, disruptionType]);

  // recommended vs baseline marker sets
  const recommendedIds = useMemo(
    () => (layoutMode === "baseline" ? [] : selectedIds),
    [layoutMode, selectedIds]
  );
  const baselineIdsForMap = useMemo(
    () => (layoutMode === "baseline" ? selectedIds : BASELINE_IDS),
    [layoutMode, selectedIds]
  );

  // --- Find Best Locations ---
  const findBest = useCallback(async () => {
    setIsRunning(true);
    // allow spinner to paint
    await new Promise((r) => setTimeout(r, 350));
    let obj = objectiveOverride;
    if (obj === "auto") {
      obj = goal === "resilient" ? "resilient" : "static";
    }
    let ids;
    let mode;
    if (obj === "baseline") {
      ids = BASELINE_IDS.slice(0, resourceCount);
      if (ids.length < resourceCount) ids = BASELINE_IDS;
      mode = "baseline";
    } else if (obj === "resilient") {
      ids = optimize({ goal: "resilient", k: resourceCount, focus, balance, thresholdMin });
      mode = "resilient";
    } else {
      // static: max coverage or p-median based on goal
      const goalForOpt = goal === "travel_time" ? "travel_time" : "cover_more_people";
      ids = optimize({ goal: goalForOpt, k: resourceCount, focus, balance, thresholdMin });
      mode = "static";
    }
    const res = evaluateLayout(ids, opts);
    setSelectedIds(ids);
    setLayoutMode(mode);
    setResult(res);
    setHasRun(true);
    setIsRunning(false);
    setRightView("results");
    // reset disruption
    setDisruptionType(null);
    setClosedRoadId(null);
    setUnavailableSiteId(null);
    setTempEvent(null);
    // history
    setHistory((h) => [
      {
        id: Date.now(),
        goal,
        k: resourceCount,
        layoutMode: mode,
        coverage: res.normalCoverage,
        worst: res.worstCoverage,
        avgTime: res.avgTime,
        ids,
      },
      ...h,
    ].slice(0, 12));
  }, [objectiveOverride, goal, resourceCount, focus, balance, thresholdMin, closedRoadId, unavailableSiteId]);

  // --- disruption before/after ---
  const disruptionBefore = result ? result.normalCoverage : null;
  const disruptionAfter = useMemo(() => {
    if (!result || !disruptionType) return null;
    let scenario;
    if (disruptionType === "winter") {
      scenario = buildScenario({ type: "winter", winterSeverity });
    } else if (disruptionType === "road_closure" && closedRoadId) {
      scenario = buildScenario({ type: "road_closure", closedRoadId });
    } else if (disruptionType === "resource_unavailable" && unavailableSiteId) {
      scenario = buildScenario({ type: "resource_unavailable", unavailableSiteId });
    } else if (disruptionType === "temp_event" && tempEvent) {
      scenario = buildScenario({ type: "temporary_event", tempEvent });
    } else {
      return null;
    }
    const r = evaluateScenario(selectedIds, scenario, focus, balance, thresholdMin);
    return r.coverage;
  }, [result, disruptionType, winterSeverity, closedRoadId, unavailableSiteId, tempEvent, selectedIds, focus, balance, thresholdMin]);

  const affectedAreas = useMemo(() => {
    if (!result || disruptionAfter == null) return [];
    let scenario;
    if (disruptionType === "winter") scenario = buildScenario({ type: "winter", winterSeverity });
    else if (disruptionType === "road_closure") scenario = buildScenario({ type: "road_closure", closedRoadId });
    else if (disruptionType === "resource_unavailable") scenario = buildScenario({ type: "resource_unavailable", unavailableSiteId });
    else if (disruptionType === "temp_event") scenario = buildScenario({ type: "temporary_event", tempEvent });
    else return [];
    const after = evaluateScenario(selectedIds, scenario, focus, balance, thresholdMin);
    const rows = [];
    for (const d of result.assignments ? Object.keys(result.assignments) : []) {
      const beforeA = result.assignments[d];
      const afterA = after.assignments[d];
      if (!beforeA || !afterA) continue;
      const inc = afterA.time - beforeA.time;
      if (inc > 0.5) {
        rows.push({ id: d, timeIncrease: inc, population: (DEMAND_BY_ID[d] && DEMAND_BY_ID[d].population) || 0 });
      }
    }
    return rows.sort((a, b) => b.timeIncrease - a.timeIncrease);
  }, [result, disruptionAfter, disruptionType, winterSeverity, closedRoadId, unavailableSiteId, tempEvent, selectedIds, focus, balance, thresholdMin]);

  // --- map click handlers ---
  const handleRoadClick = useCallback((roadId) => {
    setClosedRoadId(roadId);
  }, []);
  const handleSiteClick = useCallback(
    (siteId) => {
      if (rightView === "disruption" && disruptionType === "resource_unavailable") {
        setUnavailableSiteId(siteId);
        return;
      }
      // explain
      const exp = explainSite(siteId, selectedIds, { focus, balance, thresholdMin, closedRoadId, unavailableSiteId });
      setWhySite(exp);
      setModal("why");
    },
    [rightView, disruptionType, selectedIds, focus, balance, thresholdMin, closedRoadId, unavailableSiteId]
  );
  const handleMapClick = useCallback(
    ({ lat, lng }) => {
      const weight = TEMP_DEMAND_LEVELS[tempLevel] || 2000;
      setTempEvent({ lat, lng, weight });
    },
    [tempLevel]
  );

  // --- compare data ---
  const compareData = useMemo(() => {
    const baselineRes = evaluateLayout(BASELINE_IDS, opts);
    const optimizedIds = optimize({ goal: "cover_more_people", k: resourceCount, focus, balance, thresholdMin });
    const resilientIds = optimize({ goal: "resilient", k: resourceCount, focus, balance, thresholdMin });
    const optimizedRes = evaluateLayout(optimizedIds, opts);
    const resilientRes = evaluateLayout(resilientIds, opts);
    return { baseline: baselineRes, optimized: optimizedRes, resilient: resilientRes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceCount, focus, balance, thresholdMin]);

  const detailedCompareData = useMemo(() => {
    if (!compareData) return null;
    const scenarios = compareData.baseline.perScenario.map((ps) => ps.scenario);
    return scenarios.map((sc, i) => ({
      scenario: scenarioLabel(sc),
      baseline: (compareData.baseline.perScenario[i].coverage * 100).toFixed(0),
      optimized: (compareData.optimized.perScenario[i].coverage * 100).toFixed(0),
      resilient: (compareData.resilient.perScenario[i].coverage * 100).toFixed(0),
    }));
  }, [compareData]);

  // --- attention rows ---
  const attentionRows = useMemo(() => {
    if (!result) return [];
    return areasNeedingAttention(selectedIds, { focus, balance, thresholdMin, closedRoadId, unavailableSiteId });
  }, [result, selectedIds, focus, balance, thresholdMin, closedRoadId, unavailableSiteId]);

  // --- guided demo ---
  const startGuided = () => {
    setGuidedStep(0);
    setSelectedIds(BASELINE_IDS);
    setLayoutMode("baseline");
    setResult(evaluateLayout(BASELINE_IDS, opts));
    setHasRun(true);
    setRightView("results");
    setDisruptionType(null);
    setClosedRoadId(null);
    setUnavailableSiteId(null);
    setTempEvent(null);
  };
  const guidedStepInfo = (step) => {
    const steps = [
      { msg: "This is the starting resource layout. It works, but it may not be the strongest option.", btn: "Continue" },
      { msg: "GridAid can find a layout that performs better under normal conditions.", btn: "Find Better Locations" },
      { msg: "Now let's test what happens when an important road closes.", btn: "Close a major road" },
      { msg: "The normal optimized layout loses some coverage when the road closes.", btn: "Continue" },
      { msg: "A resilient layout considers disruptions before choosing resource locations.", btn: "Find Resilient Locations" },
      { msg: "GridAid helps users compare tradeoffs instead of assuming one layout is always best.", btn: "Finish" },
    ];
    return steps[step];
  };
  const advanceGuided = async () => {
    const step = guidedStep;
    if (step === 1) {
      // find better (static)
      const ids = optimize({ goal: "cover_more_people", k: resourceCount, focus, balance, thresholdMin });
      setSelectedIds(ids);
      setLayoutMode("static");
      setResult(evaluateLayout(ids, opts));
      setGuidedStep(2);
    } else if (step === 2) {
      // close a major road (US-61)
      setRightView("disruption");
      setDisruptionType("road_closure");
      setClosedRoadId("US-61");
      setGuidedStep(3);
    } else if (step === 4) {
      const ids = optimize({ goal: "resilient", k: resourceCount, focus, balance, thresholdMin });
      setSelectedIds(ids);
      setLayoutMode("resilient");
      setResult(evaluateLayout(ids, opts));
      setRightView("results");
      setDisruptionType(null);
      setClosedRoadId(null);
      setGuidedStep(5);
    } else if (step === 5) {
      setGuidedStep(-1);
      setModal("compare");
    } else if (step === 0) {
      setGuidedStep(1);
    } else if (step === 3) {
      setGuidedStep(4);
    }
  };

  // --- export ---
  const exportSummary = () => {
    const r = result || {};
    const lines = [
      "GridAid — Summary Report",
      `Study Area: Scott County / Davenport, Iowa`,
      `Planning Goal: ${goalLabel(goal)}`,
      `Resource Count: ${resourceCount}`,
      `Demand Type: ${focusLabel(focus)}`,
      `Coverage Time: ${thresholdMin} modeled minutes`,
      `Layout: ${layoutModeLabel(layoutMode)}`,
      "",
      "Recommended Locations:",
      ...selectedIds.map((id, i) => `  ${i + 1}. ${id}`),
      "",
      `Coverage: ${((r.normalCoverage || 0) * 100).toFixed(0)}%`,
      `Average Scenario Coverage: ${((r.avgScenarioCoverage || 0) * 100).toFixed(0)}%`,
      `Worst-Case Coverage: ${((r.worstCoverage || 0) * 100).toFixed(0)}%`,
      `Average Modeled Travel Time: ${(r.avgTime || 0).toFixed(1)} min`,
      "",
      "Key Assumptions:",
      "  - Results are modeled, not measured.",
      "  - Travel time is modeled travel time, not guaranteed response time.",
      "  - Some resource locations may be synthetic demonstration data.",
      "  - Disruptions may be simulated.",
      "",
      "Disclaimer: GridAid is a research and planning prototype. It does not provide live emergency dispatch instructions, guarantee response times, or replace professional emergency-management judgment.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gridaid-summary.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        {/* Left controls */}
        <aside className="w-[260px] shrink-0 border-r border-border bg-background">
          <ControlPanel
            resourceCount={resourceCount}
            setResourceCount={setResourceCount}
            goal={goal}
            setGoal={setGoal}
            focus={focus}
            setFocus={setFocus}
            balance={balance}
            setBalance={setBalance}
            thresholdMin={thresholdMin}
            setThresholdMin={setThresholdMin}
            objectiveOverride={objectiveOverride}
            setObjectiveOverride={setObjectiveOverride}
            winterMultiplier={winterMultiplier}
            setWinterMultiplier={setWinterMultiplier}
            resilienceWeight={resilienceWeight}
            setResilienceWeight={setResilienceWeight}
            trials={trials}
            setTrials={setTrials}
            onFindBest={findBest}
            onGuidedDemo={startGuided}
            isRunning={isRunning}
          />
        </aside>

        {/* Center map */}
        <main className="relative flex-1">
          <MapView
            layers={layers}
            setLayers={setLayers}
            selectedIds={selectedIds}
            baselineIds={baselineIdsForMap}
            recommendedIds={recommendedIds}
            closedRoadId={closedRoadId}
            unavailableSiteId={unavailableSiteId}
            tempEvent={tempEvent}
            interactionMode={interactionMode}
            onRoadClick={handleRoadClick}
            onSiteClick={handleSiteClick}
            onMapClick={handleMapClick}
            thresholdMin={thresholdMin}
            assignments={result ? result.assignments : {}}
            focus={focus}
          />
          {/* guided demo overlay */}
          {guidedStep >= 0 && (
            <div className="absolute bottom-4 left-1/2 z-[600] w-[min(92%,560px)] -translate-x-1/2 rounded-xl border border-border bg-background p-4 shadow-2xl">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className={`h-1.5 w-6 rounded-full ${i <= guidedStep ? "bg-[#0f766e]" : "bg-muted"}`} />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">Step {guidedStep + 1} of 6</span>
              </div>
              <p className="mt-2 text-sm text-foreground">{guidedStepInfo(guidedStep).msg}</p>
              <div className="mt-3 flex items-center justify-between">
                <button onClick={() => setGuidedStep(-1)} className="text-sm text-muted-foreground hover:text-foreground">
                  Skip
                </button>
                <button
                  onClick={advanceGuided}
                  className="rounded-lg bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0c5d56]"
                >
                  {guidedStepInfo(guidedStep).btn}
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Right results */}
        <aside className="w-[320px] shrink-0 border-l border-border bg-background">
          {rightView === "results" ? (
            <ResultsPanel
              result={result}
              layoutMode={layoutMode}
              thresholdMin={thresholdMin}
              isRunning={isRunning}
              hasRun={hasRun}
              onTestDisruption={() => {
                setRightView("disruption");
                setDisruptionType(null);
                setClosedRoadId(null);
                setUnavailableSiteId(null);
                setTempEvent(null);
              }}
              onCompare={() => setModal("compare")}
              onRunSimulation={() => setModal("simulation")}
              onShowAttention={() => setModal("attention")}
              onMoreInsights={() => setModal("insights")}
            />
          ) : (
            <div className="flex h-full flex-col">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-base font-semibold">Test a Disruption</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <DisruptionPanel
                  disruptionType={disruptionType}
                  setDisruptionType={setDisruptionType}
                  winterSeverity={winterSeverity}
                  setWinterSeverity={setWinterSeverity}
                  closedRoadId={closedRoadId}
                  onRemoveClosure={() => setClosedRoadId(null)}
                  unavailableSiteId={unavailableSiteId}
                  tempLevel={tempLevel}
                  setTempLevel={setTempLevel}
                  beforeCoverage={disruptionBefore}
                  afterCoverage={disruptionAfter}
                  affectedAreas={affectedAreas}
                  onClose={() => {
                    setRightView("results");
                    setDisruptionType(null);
                    setClosedRoadId(null);
                    setUnavailableSiteId(null);
                    setTempEvent(null);
                  }}
                />
              </div>
            </div>
          )}
          {/* secondary actions row */}
          <div className="flex items-center justify-around border-t border-border py-2 text-xs text-muted-foreground">
            <button onClick={() => setModal("history")} className="flex items-center gap-1 hover:text-foreground">
              <History className="h-3.5 w-3.5" /> Runs
            </button>
            <button onClick={exportSummary} className="flex items-center gap-1 hover:text-foreground">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
        </aside>
      </div>

      {/* Modals */}
      {modal === "compare" && (
        <Modal title="Compare Plans" subtitle="Starting Layout vs Optimized vs Resilient" onClose={() => setModal(null)}>
          <ComparePlans
            baseline={compareData.baseline}
            optimized={compareData.optimized}
            resilient={compareData.resilient}
            onViewDetailed={() => setDetailedCompare((d) => !d)}
            detailed={detailedCompare}
            detailedData={detailedCompareData}
          />
        </Modal>
      )}
      {modal === "attention" && (
        <Modal title="Areas Needing Attention" subtitle="Locations with the weakest modeled access" onClose={() => setModal(null)} maxWidth="max-w-2xl">
          <AreasNeedAttention rows={attentionRows} />
        </Modal>
      )}
      {modal === "why" && whySite && (
        <Modal title="Why This Location?" subtitle={whySite.siteId} onClose={() => { setModal(null); setWhySite(null); }} maxWidth="max-w-lg">
          <WhyThisLocation explanation={whySite} siteId={whySite.siteId} />
        </Modal>
      )}
      {modal === "simulation" && (
        <SimulationModal
          selectedIds={selectedIds}
          focus={focus}
          balance={balance}
          thresholdMin={thresholdMin}
          trials={trials}
          closedRoadId={closedRoadId}
          unavailableSiteId={unavailableSiteId}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "insights" && (
        <InsightsModal
          resourceCount={resourceCount}
          focus={focus}
          balance={balance}
          thresholdMin={thresholdMin}
          goal={goal}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "history" && (
        <Modal title="Recent Runs" subtitle="This session only — no account or personal data stored" onClose={() => setModal(null)} maxWidth="max-w-2xl">
          <RunHistory history={history} onCompare={() => setModal("compare")} />
        </Modal>
      )}
    </div>
  );
}

function SimulationModal({ selectedIds, focus, balance, thresholdMin, trials, closedRoadId, unavailableSiteId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setTimeout(() => {
      const r = runSimulation({ selectedIds, focus, balance, thresholdMin, trials, closedRoadId, unavailableSiteId });
      if (active) {
        setData(r);
        setLoading(false);
      }
    }, 300);
    return () => { active = false; };
  }, [selectedIds, focus, balance, thresholdMin, trials, closedRoadId, unavailableSiteId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-muted border-t-[#0f766e]" />
      </div>
    );
  }
  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Stat label="Average Modeled Time" value={`${data.mean.toFixed(1)} min`} />
        <Stat label="Typical Modeled Time" value={`${data.median.toFixed(1)} min`} />
        <Stat label="P95 Modeled Time" value={`${data.p95.toFixed(1)} min`} />
        <Stat label="Percent Within Goal" value={`${(data.withinGoal * 100).toFixed(0)}%`} />
        <Stat label="Lowest Scenario Coverage" value={`${(Math.min(...data.scenarioCoverage.map((s) => s.coverage)) * 100).toFixed(0)}%`} />
        <Stat label="Trials" value={data.trials.toLocaleString()} />
      </div>
      <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-sm">
        <div className="grid grid-cols-2 gap-y-1.5">
          <span className="text-muted-foreground">Mean</span><span className="text-right tabular-nums">{data.mean.toFixed(2)} min</span>
          <span className="text-muted-foreground">Median</span><span className="text-right tabular-nums">{data.median.toFixed(2)} min</span>
          <span className="text-muted-foreground">P90</span><span className="text-right tabular-nums">{data.p90.toFixed(2)} min</span>
          <span className="text-muted-foreground">P95</span><span className="text-right tabular-nums">{data.p95.toFixed(2)} min</span>
          <span className="text-muted-foreground">Minimum</span><span className="text-right tabular-nums">{data.min.toFixed(2)} min</span>
        </div>
      </div>
    </div>
  );
}

function InsightsModal({ resourceCount, focus, balance, thresholdMin, goal, onClose }) {
  const maxK = Math.min(25, resourceCount + 6);
  const data = useMemo(
    () => resourceCoverageCurve(maxK, { goal: "cover_more_people", focus, balance, thresholdMin }),
    [maxK, focus, balance, thresholdMin]
  );
  return (
    <div>
      <h3 className="text-sm font-semibold">What If We Had More Resources?</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Coverage generally improves as resources are added, but with diminishing returns.
      </p>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.map((d) => ({ k: d.k, coverage: +(d.coverage * 100).toFixed(0) }))} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="k" tick={{ fontSize: 11 }} label={{ value: "Resources", position: "insideBottom", offset: -2, fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
            <RTooltip formatter={(v) => `${v}%`} contentStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="coverage" stroke="#0f766e" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function RunHistory({ history, onCompare }) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">No runs yet this session. Click “Find Best Locations” to begin.</p>;
  }
  return (
    <div className="space-y-2">
      {history.map((h) => (
        <div key={h.id} className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <div className="text-sm font-medium">{layoutModeLabel(h.layoutMode)} · {h.k} resources</div>
            <div className="text-xs text-muted-foreground">{goalLabel(h.goal)}</div>
          </div>
          <div className="text-right text-sm tabular-nums">
            <div className="font-medium">{(h.coverage * 100).toFixed(0)}% coverage</div>
            <div className="text-xs text-muted-foreground">worst {(h.worst * 100).toFixed(0)}% · {h.avgTime.toFixed(1)} min</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function goalLabel(g) {
  return g === "cover_more_people" ? "Cover More People" : g === "travel_time" ? "Reduce Travel Time" : "Stay Strong During Disruptions";
}
function focusLabel(f) {
  return f === "population" ? "Population" : f === "risk" ? "Transportation Risk" : "Balanced";
}
function layoutModeLabel(m) {
  return m === "baseline" ? "Starting Layout" : m === "static" ? "Optimized" : m === "resilient" ? "Resilient" : "Layout";
}