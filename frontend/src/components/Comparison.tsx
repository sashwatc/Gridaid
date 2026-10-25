import type {Run,Study} from '../types';
import {colors,kinds,pct,pointChange,scenarioName,titles} from '../presentation';

function Tradeoff({before,after}:{before:Run;after:Run}){
 const same=before.selected_site_ids.length===after.selected_site_ids.length&&before.selected_site_ids.every(id=>after.selected_site_ids.includes(id));
 const normal=pointChange(after.metrics.normal.coverage,before.metrics.normal.coverage);
 const average=pointChange(after.summary.average_coverage,before.summary.average_coverage);
 const minimum=pointChange(after.summary.minimum_coverage,before.summary.minimum_coverage);
 return <article className="tradeoff" data-testid={`${after.kind}-tradeoff`}><h3>{titles[after.kind]} compared with {titles[before.kind].toLowerCase()}</h3><p>Normal coverage <strong>{normal}</strong> · scenario average <strong>{average}</strong> · minimum coverage <strong>{minimum}</strong>.</p><p className="hint">{same?'Both runs selected the same set of sites. ':'Different site sets were selected. '}Differences use the API’s unrounded weighted coverage; pp means percentage points. These results apply to this portfolio and its assumptions.</p></article>;
}

export function Comparison({runs,study,stale,onView}:{runs:Run[];study:Study|null;stale:boolean;onView:(kind:Run['kind'])=>void}){
 const baseline=runs.find(r=>r.kind==='baseline'),staticRun=runs.find(r=>r.kind==='static'),resilient=runs.find(r=>r.kind==='resilient');
 const ids=runs[0]?.configuration.scenario_ids??[];
 return <section className="comparison" aria-label="Placement comparison"><div className="section-heading"><div><span className="eyebrow">MEASURE THE TRADEOFF</span><h2>One portfolio. Three configurations.</h2></div><span className="hint">Weighted representative-point coverage · not household coverage</span></div>
  {!runs.length?<div className="empty"><span>01</span><h3>Start with a baseline.</h3><p>Use step 1 above, then optimize and compare how the same sites perform during disruption.</p></div>:<>
   <div className="metric-cards">{kinds.map(kind=>{
    const r=runs.find(r=>r.kind===kind);
    return <article key={kind} style={{borderTopColor:colors[kind]}}><div className="card-label"><span style={{color:colors[kind]}}>{titles[kind]}</span><span className="solver-state">{r?.solver.status??'Not run'}</span></div><strong className="big-number" data-testid={`${kind}-minimum`}>{r?pct(r.summary.minimum_coverage):'—'}</strong><p>Minimum scenario coverage</p><dl>
     <div><dt>Normal</dt><dd data-testid={`${kind}-normal`}>{r?pct(r.metrics.normal.coverage):'—'}</dd></div><div><dt>Scenario average</dt><dd data-testid={`${kind}-average`}>{r?pct(r.summary.average_coverage):'—'}</dd></div><div><dt>Worst scenario</dt><dd data-testid={`${kind}-worst`}>{r?scenarioName(study,r.summary.worst_scenario):'—'}</dd></div><div><dt>Resilience score</dt><dd>{r?r.summary.resilience_score.toFixed(4):'—'}</dd></div><div><dt>Solver runtime</dt><dd>{r?`${r.solver.runtime_s.toFixed(3)} s`:'—'}</dd></div>
    </dl>{r&&<><button className="view-map" disabled={!r.selected_site_ids.length} onClick={()=>onView(kind)}>View {titles[kind].toLowerCase()} on map ↑</button><details><summary>Solver evidence & export</summary><p>Objective: {r.solver.objective?.toFixed(4)??'Unavailable'} {r.solver.objective_unit}. Bound: {r.solver.bound?.toFixed(4)??'n/a'}. Gap: {r.solver.gap===null?'n/a':pct(r.solver.gap)}.</p><p>Sites: {r.selected_site_ids.join(', ')||'No feasible sites'}. {r.solver.unreachable_penalty_s&&`Unreachable penalty: ${r.solver.unreachable_penalty_s} s.`}</p><a href={`/api/runs/${r.run_id}`} target="_blank" rel="noreferrer">Export full run JSON ↗</a><p className="mono">Run {r.run_id}<br/>Dataset {r.dataset_version}<br/>Seed {r.configuration.seed} · Model {r.model_version??'none'}</p></details></>}</article>;
   })}</div>
   <div className="tradeoffs" aria-label="Calculated tradeoffs">{stale&&<p className="hint">Tradeoffs below describe the previous assumptions. Recalculate to compare your current controls.</p>}{baseline?.selected_site_ids.length&&staticRun?.selected_site_ids.length?<Tradeoff before={baseline} after={staticRun}/>:null}{staticRun?.selected_site_ids.length&&resilient?.selected_site_ids.length?<Tradeoff before={staticRun} after={resilient}/>:null}</div>
   <div className="chart" aria-labelledby="coverage-chart-title" aria-describedby="coverage-chart-description"><h3 id="coverage-chart-title">Coverage across the scenario portfolio</h3><p className="hint" id="coverage-chart-description">Weighted demand within the travel threshold. Each bar uses the same 0–100% scale; values and placement labels are shown beside every bar.</p><div className="chart-scale" aria-hidden="true"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>{ids.map(sid=><section className="chart-row" key={sid}><h4>{scenarioName(study,sid)}</h4><div>{kinds.map(kind=>{
    const r=runs.find(r=>r.kind===kind);if(!r)return null;
    const m=r.metrics[sid];
    return <div className="coverage-bar" key={kind}><span>{titles[kind]}</span><div className="bar-track" role="img" aria-label={`${titles[kind]}, ${scenarioName(study,sid)}: ${!m?'Unavailable':m.no_demand?'No demand':pct(m.coverage)}`}><div style={{width:pct(m?.coverage??0),background:colors[kind]}}/></div><strong data-testid={`chart-${kind}-${sid}`}>{!m?'—':m.no_demand?'No demand':pct(m.coverage)}</strong></div>;
   })}</div></section>)}</div>
  </>}
 </section>;
}
