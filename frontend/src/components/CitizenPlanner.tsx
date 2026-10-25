import {useEffect,useRef,useState} from 'react';
import {useCitizenPlanner} from '../useCitizenPlanner';
import {pct,pointChange,scenarioName,titles} from '../presentation';
import {SatelliteMap} from './SatelliteMap';
import {PlacementDetails} from './PlacementDetails';
import {PointInspector} from './PointInspector';
import {usePointRoute} from '../usePointRoute';
import {mappedFacilities} from '../region';

export function CitizenPlanner(){
 const p=useCitizenPlanner();
 const [selected,setSelected]=useState<string|null>(null),[stress,setStress]=useState(false);
 const answer=useRef<HTMLElement|null>(null);
 const result=p.result,run=result?.recommended;
 const active=stress&&run?run.summary.worst_scenario:'normal';
 const route=usePointRoute(p.study,run,active,p.focusBounds,p.cityIds,!!p.progress||p.loading);
 const scope=JSON.stringify([p.focusBounds,p.cityIds]);
 useEffect(()=>{route.clear();setSelected(null);setStress(false);},[scope]);
 useEffect(()=>{setSelected(null);setStress(false);if(result){answer.current?.focus({preventScroll:true});answer.current?.scrollIntoView({block:'start'});}},[result]);
 const normalPlan=result?.runs.find(r=>r.kind==='static');
 const same=run&&normalPlan&&run.selected_site_ids.length===normalPlan.selected_site_ids.length&&run.selected_site_ids.every(id=>normalPlan.selected_site_ids.includes(id));
 function selectSite(id:string){setSelected(id);const f=mappedFacilities(p.study).find(f=>f.id===id);if(f)route.setPoint({lat:f.lat,lon:f.lon});document.querySelector('.citizen-map')?.scrollIntoView({block:'center'});}
 function checkGap(){
  if(!run)return;
  const access=new Map(run.demand_access[run.summary.worst_scenario].map(a=>[a.demand_id,a]));
  const gap=[...p.area.demands].filter(d=>!access.get(d.id)?.covered).sort((a,b)=>b.population-a.population)[0];
  if(gap&&gap.origin_lat!==null&&gap.origin_lon!==null){setStress(true);route.setDirection('from_resource');route.setPoint({lat:gap.origin_lat,lon:gap.origin_lon});document.querySelector('.point-inspector')?.scrollIntoView({block:'center'});}
 }
 return <div className="citizen-app">
  <a className="skip-link" href="#citizen-main">Skip to planner</a>
  <header className="citizen-header"><a href="/" className="brand"><span className="brand-mark">G<span>+</span></span><strong>GridAid</strong></a><span className="community-tag">Quad Cities · IA + IL</span><a className="simple-link" href="/?view=advanced">Detailed tools ↗</a></header>
  <main id="citizen-main" className="citizen-main">
   <div className="citizen-intro"><span className="eyebrow">PLAN A BETTER-PREPARED COMMUNITY</span><h1>Where could resources<br className="desktop-break"/> help the most?</h1><p>Choose how many resources you have. We’ll suggest locations and show how they hold up in snow and road closures.</p></div>
   <div className="citizen-layout">
    <div className="plan-column">
     <form className="simple-form" onSubmit={e=>{e.preventDefault();void p.findPlan();}} noValidate>
      <div className="step-kicker"><span>1</span> Tell us what you have</div>
      <h2>Build a community plan</h2><p>{p.areaLabel}. Add cities or draw an area on the map to focus your plan.</p>
      <label htmlFor="resource-count">How many resources?<span className="input-help">For example, 4 response teams or supply stations.</span></label><input id="resource-count" type="number" min="1" max={p.maxCount} step="1" inputMode="numeric" value={p.resources} onChange={e=>p.update('resources',e.target.value)} aria-describedby="input-validation"/>
      <label htmlFor="travel-target">Travel-time target<span className="input-help">How close should a resource be?</span></label><div className="minutes-field"><input id="travel-target" type="number" min="1" max="60" step="1" inputMode="decimal" value={p.minutes} onChange={e=>p.update('minutes',e.target.value)} aria-describedby="input-validation"/><span>minutes by road</span></div>
      <p id="input-validation" className="input-validation" role={p.validation?'alert':undefined}>{p.validation}</p>
      <button className="find-plan" type="submit" disabled={p.loading||!!p.progress||!p.study||!!p.validation}>{p.loading?'Loading planning data…':p.progress?'Finding your plan…':p.error&&p.study?'Try again':'Find a plan'}<span aria-hidden="true">→</span></button>
      {p.progress?<div className="calculation-progress" role="status"><span className="spinner"/>{p.progress}<button type="button" onClick={p.cancel}>Cancel</button></div>:<p className="form-reassurance">We compare three plans for you. No setup or account needed.</p>}
      {p.error&&<div className="citizen-error" role="alert"><strong>{p.study?'Your plan could not be completed.':'Planning data could not load.'}</strong><p>{p.error}</p>{!p.study&&<button type="button" onClick={p.retryLoad}>Retry loading</button>}</div>}
     </form>
     <section className={`plan-answer ${run?'is-ready':''}`} ref={answer} tabIndex={-1} aria-label="Your recommendation" aria-live="polite">
      <div className="step-kicker"><span>2</span> See your answer</div>
      {run&&result?<><span className="ready-label">✓ PLAN READY</span><h2>{run.selected_site_ids.length} suggested locations.</h2><p className="answer-lead">{run.kind==='static'?'The normal-day plan gives the strongest balance in these tests.':run.kind==='baseline'?'The starting plan gives the strongest balance in these tests.':'A plan designed for normal days and disruption.'}</p>
       <div className="answer-metrics"><div><strong data-testid="recommended-normal">{pct(run.metrics.normal.coverage)}</strong><span>coverage on a normal day</span></div><div><strong data-testid="recommended-worst">{pct(run.summary.minimum_coverage)}</strong><span>coverage in the toughest test</span></div></div>
       <p className="coverage-explainer">Coverage is the share of population represented within your {result.config.threshold_minutes}-minute target. It is an estimate from census points and assumed access paths.</p>
       <div className="plain-tradeoff" data-testid="plain-tradeoff">{same?'The normal-day and disruption plans suggest the same locations for these settings.':<>Compared with the normal-day plan: <strong>{pointChange(run.summary.minimum_coverage,normalPlan!.summary.minimum_coverage)}</strong> in the toughest test and <strong>{pointChange(run.metrics.normal.coverage,normalPlan!.metrics.normal.coverage)}</strong> on a normal day. A percentage point is the difference between two percentages.</>}</div>
       <h3>Explore the suggested locations</h3><ol className="suggested-locations">{run.selected_site_ids.map((id,i)=>{
        const c=p.study!.dataset.candidates.find(c=>c.id===id)!;
        return <li key={id}><button aria-pressed={selected===id} onClick={()=>selectSite(id)}><span className="location-number">{i+1}</span><span><strong>{c.label}</strong><small>{c.community?.replace(' city','')??'Quad Cities'}</small></span><span aria-hidden="true">↗</span></button></li>;
       })}</ol><p className="site-caveat">These are mapped facilities suggested for planning, not confirmed available resources. Select a location to see it on the map.</p>
       <a className="download-plan" href={`/api/runs/${run.run_id}`} target="_blank" rel="noreferrer">Open this plan’s data ↗</a>
      </>:<div className="answer-empty"><div className="empty-map-symbol" aria-hidden="true">◎</div><h2>Your plan will appear here.</h2><p>Choose your resource count and travel target, then select <strong>Find a plan</strong>. We’ll handle the comparisons.</p></div>}
     </section>
    </div>
    <div className="citizen-map-column">{run&&<div className="condition-toggle" role="group" aria-label="View conditions"><button aria-pressed={!stress} onClick={()=>setStress(false)}>Normal day</button><button aria-pressed={stress} onClick={()=>setStress(true)}>Toughest tested day</button><span>{scenarioName(p.study,active)}</span></div>}{p.study?<SatelliteMap study={p.study} run={run} active={active} selected={selected} onSelect={setSelected} focusBounds={p.focusBounds} cityIds={p.cityIds} onAreaChange={p.updateArea} onPoint={route.setPoint} checkedPoint={route.point} pointRoute={route.result?.conditions.at(-1)?.routes[0]} pointStatus={route.busy?'Checking roads…':route.error?'Point check unavailable':route.result?'No reachable route':''}/>:<div className="map-loading">{p.loading?<><span className="spinner"/> Loading your community map…</>:<>The map will appear when planning data is available.</>}</div>}
     {run&&<button className="coverage-gap" onClick={checkGap} disabled={!p.area.demands.some(d=>!run.demand_access[run.summary.worst_scenario]?.find(a=>a.demand_id===d.id)?.covered)}>Check the largest population coverage gap →</button>}
     <PointInspector route={route}/>
     <details className="simple-explanation"><summary>What does this planner do?</summary><p>It compares three possible placements of the same resources: a starting plan, a plan for normal roads, and a plan tested against snow and a road closure. The recommendation has the highest combined score: 60% average coverage and 40% worst-case coverage.</p><p>Real OpenStreetMap roads, mapped facilities, official city boundaries and 2020 Census population cover the Quad Cities study region. Drawn areas select whole tract points and eligible facilities; roads outside the selected area remain available for routing. Resource assignments, snow effects, closures, and access paths are assumptions. This tool does not report live emergency services or road conditions.</p></details>
    </div>
   </div>
   {run&&result&&<details className="citizen-details"><summary>See the comparison and calculation details</summary><p>Best of the three calculated plans for the selected assumptions. Solver result: {run.solver.status}. {run.solver.status!=='optimal'?'The solver did not prove a global optimum.':''}</p><div className="table-scroll"><table><caption>Coverage for the three tested plans</caption><thead><tr><th scope="col">Plan</th><th scope="col">Normal day</th><th scope="col">Toughest test</th></tr></thead><tbody>{result.runs.map(r=><tr key={r.run_id}><th scope="row">{titles[r.kind]}{r.run_id===run.run_id?' · recommended':''}</th><td>{pct(r.metrics.normal.coverage)}</td><td>{pct(r.summary.minimum_coverage)}</td></tr>)}</tbody></table></div><PlacementDetails run={run} study={p.study} active={active} site={selected} onSite={setSelected}/></details>}
   <footer className="citizen-footer"><strong>GridAid</strong><span>Quad Cities planning estimates · OSM roads/facilities dated Oct 23, 2026 · Census 2020 · Not live emergency guidance.</span><a href="/?view=advanced">Research tools & methodology ↗</a></footer>
  </main>
 </div>;
}
