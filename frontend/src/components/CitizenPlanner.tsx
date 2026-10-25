import {useEffect,useRef,useState} from 'react';
import {useCitizenPlanner} from '../useCitizenPlanner';
import {pct,pointChange,scenarioName,titles} from '../presentation';
import {SatelliteMap} from './SatelliteMap';
import {PlacementDetails} from './PlacementDetails';
import {PointInspector} from './PointInspector';
import {usePointRoute} from '../usePointRoute';
import {mappedFacilities} from '../region';
import {ThemeToggle} from '../theme';
import {ModelActivity} from './ModelActivity';
import type {Bounds,MapPoint} from '../types';

type Panel='plan'|'results'|'point'|'info';

export function CitizenPlanner(){
 const p=useCitizenPlanner();
 const [selected,setSelected]=useState<string|null>(null),[stress,setStress]=useState(false);
 const [panel,setPanel]=useState<Panel>('plan'),[panelOpen,setPanelOpen]=useState(true);
 const [fullscreen,setFullscreen]=useState(false),[screenError,setScreenError]=useState('');
 const root=useRef<HTMLDivElement|null>(null),answer=useRef<HTMLElement|null>(null),content=useRef<HTMLDivElement|null>(null);
 const result=p.result,run=result?.recommended;
 const active=stress&&run?run.summary.worst_scenario:'normal';
 const route=usePointRoute(p.study,run,active,p.focusBounds,p.cityIds,!!p.progress||p.loading);
 const scope=JSON.stringify([p.focusBounds,p.cityIds]);
 useEffect(()=>{route.clear();setSelected(null);setStress(false);setPanel('plan');},[scope]);
 useEffect(()=>{setSelected(null);setStress(false);if(result){setPanel('results');setPanelOpen(true);}},[result]);
 useEffect(()=>{if(route.point){setPanel('point');setPanelOpen(true);}else if(panel==='point')setPanel(result?'results':'plan');},[route.point]);
 useEffect(()=>{if(content.current)content.current.scrollTop=0;if(panel==='results')answer.current?.focus({preventScroll:true});},[panel,result]);
 useEffect(()=>{const update=()=>setFullscreen(document.fullscreenElement===root.current);document.addEventListener('fullscreenchange',update);return()=>document.removeEventListener('fullscreenchange',update);},[]);
 const normalPlan=result?.runs.find(r=>r.kind==='static');
 const same=run&&normalPlan&&run.selected_site_ids.length===normalPlan.selected_site_ids.length&&run.selected_site_ids.every(id=>normalPlan.selected_site_ids.includes(id));
 function show(value:Panel){setPanel(value);setPanelOpen(true);}
 function inspect(point:MapPoint){route.setPoint(point);show('point');}
 function selectSite(id:string){setSelected(id);const f=mappedFacilities(p.study).find(f=>f.id===id);if(f)inspect({lat:f.lat,lon:f.lon});}
 function changeArea(bounds:Bounds|null,ids:string[]){p.updateArea(bounds,ids);route.clear();setSelected(null);show('plan');}
 async function toggleFullscreen(){
  setScreenError('');
  try{if(document.fullscreenElement)await document.exitFullscreen();else if(root.current?.requestFullscreen)await root.current.requestFullscreen();else setScreenError('Fullscreen is unavailable in this browser. The workspace still fills the window.');}
  catch{setScreenError('Fullscreen was unavailable. You can use your browser’s fullscreen command.');}
 }
 function checkGap(){
  if(!run)return;
  const access=new Map(run.demand_access[run.summary.worst_scenario].map(a=>[a.demand_id,a]));
  const gap=[...p.area.demands].filter(d=>!access.get(d.id)?.covered).sort((a,b)=>b.population-a.population)[0];
  if(gap&&gap.origin_lat!==null&&gap.origin_lon!==null){setStress(true);route.setDirection('from_resource');inspect({lat:gap.origin_lat,lon:gap.origin_lon});}
 }
 return <div ref={root} className={`citizen-app map-workspace ${panelOpen?'panel-open':'panel-closed'}`}>
  <a className="skip-link" href="#workspace-panel" onClick={()=>setPanelOpen(true)}>Skip to controls</a>
  <header className="citizen-header workspace-header">
   <a href="/" className="workspace-brand" aria-label="GridAid home"><span className="workspace-brand-icon" aria-hidden="true">G</span><strong>GridAid</strong></a>
   <span className="workspace-divider"/><h1>Quad Cities</h1><span className="workspace-region">Iowa + Illinois</span>
   <div className="workspace-header-actions"><ThemeToggle/><button className="workspace-fullscreen" aria-label={fullscreen?'Exit fullscreen':'Enter fullscreen'} title={fullscreen?'Exit fullscreen':'Enter fullscreen'} onClick={()=>void toggleFullscreen()}><span aria-hidden="true">⛶</span></button><a className="workspace-research" href="/?view=advanced">Research tools ↗</a></div>
  </header>
  <main className="workspace-stage" aria-label="Quad Cities map workspace">
   <div className="workspace-map-layer">{p.study?<SatelliteMap study={p.study} run={run} active={active} selected={selected} onSelect={setSelected} focusBounds={p.focusBounds} cityIds={p.cityIds} onAreaChange={changeArea} onPoint={inspect} checkedPoint={route.point} pointRoute={route.result?.conditions.at(-1)?.routes[0]} calculating={!!p.progress||route.busy} pointStatus={route.busy?'Checking roads…':route.error?'Point check unavailable':route.result?'No reachable route':''} immersive panelOpen={panelOpen} onDrawingChange={drawing=>{if(drawing)setPanelOpen(false);}}/>:<div className="map-loading">{p.loading?<><span className="spinner"/> Loading Quad Cities…</>:<>Map unavailable. Use Retry loading in the Plan panel.</>}</div>}</div>
   {!panelOpen&&<button className="workspace-open-panel" onClick={()=>setPanelOpen(true)}>☰ <span>Open panel</span></button>}
   <aside className={`workspace-dock ${panelOpen?'':'dock-hidden'}`} id="workspace-panel" tabIndex={-1} aria-label="Planning controls" aria-hidden={!panelOpen} inert={!panelOpen}>
    <nav className="workspace-panel-tabs" aria-label="Workspace panels">
     <button aria-pressed={panel==='plan'} onClick={()=>show('plan')}>Plan</button>
     <button aria-pressed={panel==='results'} disabled={!run} onClick={()=>show('results')}>Results</button>
     <button aria-pressed={panel==='point'} disabled={!route.point} onClick={()=>show('point')}>Point</button>
     <button aria-label="Data and methodology" aria-pressed={panel==='info'} onClick={()=>show('info')}>Info</button>
     <button className="workspace-close-panel" aria-label="Hide panel" onClick={()=>setPanelOpen(false)}>×</button>
    </nav>
    <div ref={content} className="workspace-panel-body">
     <div hidden={panel!=='plan'}>
      <form className="simple-form" onSubmit={e=>{e.preventDefault();route.clear();show('plan');void p.findPlan();}} noValidate>
       <div className="workspace-section-heading"><h2>Resource plan</h2><span>{p.cityIds.length?`${p.cityIds.length} cities`:p.focusBounds?'Custom area':'Regional'}</span></div>
       <p className="workspace-area-name">{p.areaLabel}</p>
       <div className="workspace-fields"><div><label htmlFor="resource-count">How many resources?</label><input id="resource-count" type="number" min="1" max={p.maxCount} step="1" inputMode="numeric" value={p.resources} onChange={e=>p.update('resources',e.target.value)} aria-describedby="input-validation"/></div><div><label htmlFor="travel-target">Travel-time target</label><div className="minutes-field"><input id="travel-target" type="number" min="1" max="60" step="1" inputMode="decimal" value={p.minutes} onChange={e=>p.update('minutes',e.target.value)} aria-describedby="input-validation"/><span>min</span></div></div></div>
       <p className="workspace-field-help">Resources can be response teams or supply stations. Choose cities or draw an area on the map.</p>
       <p id="input-validation" className="input-validation" role={p.validation?'alert':undefined}>{p.validation}</p>
       <button className="find-plan" type="submit" disabled={p.loading||!!p.progress||!p.study||!!p.validation}>{p.loading?'Loading data…':p.progress?'Calculating…':p.error&&p.study?'Try again':'Find a plan'}<span aria-hidden="true">→</span></button>
       {p.progress&&<div className="calculation-progress" role="status"><span className="spinner"/>{p.progress}<button type="button" onClick={p.cancel}>Cancel</button></div>}
       {p.error&&<div className="citizen-error" role="alert"><strong>{p.study?'Calculation failed':'Data unavailable'}</strong><p>{p.error}</p>{!p.study&&<button type="button" onClick={p.retryLoad}>Retry loading</button>}</div>}
       <details className="workspace-input-details" open={!!p.progress}><summary>Model & calculation inputs</summary><ModelActivity study={p.study} config={p.preset} phase={p.progress}/></details>
      </form>
      <div className="workspace-plan-note"><strong>Three plans, one comparison</strong><p>The starting, normal-day and disruption plans use the same resources and travel target.</p><span>Click any map point to check road travel.</span></div>
     </div>
     <section hidden={panel!=='results'} className="plan-answer" ref={answer} tabIndex={-1} aria-label="Your recommendation" aria-live="polite">
      {run&&result?<><div className="workspace-section-heading"><h2>{run.selected_site_ids.length} suggested locations.</h2><span>Calculated</span></div>
       <div className="answer-metrics"><div><strong data-testid="recommended-normal">{pct(run.metrics.normal.coverage)}</strong><span>normal-day coverage</span></div><div><strong data-testid="recommended-worst">{pct(run.summary.minimum_coverage)}</strong><span>toughest-test coverage</span></div></div>
       <div className="workspace-result-conditions" role="group" aria-label="View conditions"><button aria-pressed={!stress} onClick={()=>setStress(false)}>Normal day</button><button aria-pressed={stress} onClick={()=>setStress(true)}>Toughest tested day</button></div><p className="workspace-current-condition">Map: {scenarioName(p.study,active)}</p>
       <ol className="suggested-locations">{run.selected_site_ids.map((id,i)=>{const c=p.study!.dataset.candidates.find(c=>c.id===id)!;return <li key={id}><button aria-pressed={selected===id} onClick={()=>selectSite(id)}><span className="location-number">{i+1}</span><span><strong>{c.label}</strong><small>{c.community?.replace(' city','')??'Quad Cities'}</small></span><span aria-hidden="true">↗</span></button></li>;})}</ol>
       <button className="coverage-gap" onClick={checkGap} disabled={!p.area.demands.some(d=>!run.demand_access[run.summary.worst_scenario]?.find(a=>a.demand_id===d.id)?.covered)}>Check the largest population coverage gap →</button>
       <details className="workspace-result-details"><summary>Tradeoffs & calculation details</summary><div className="plain-tradeoff" data-testid="plain-tradeoff">{same?'The normal-day and disruption plans suggest the same locations for these settings.':<>Compared with the normal-day plan: <strong>{pointChange(run.summary.minimum_coverage,normalPlan!.summary.minimum_coverage)}</strong> in the toughest test and <strong>{pointChange(run.metrics.normal.coverage,normalPlan!.metrics.normal.coverage)}</strong> on a normal day. pp means percentage points.</>}</div><p className="coverage-explainer">Coverage is the share of population represented within your {result.config.threshold_minutes}-minute target, estimated from whole census tract points and assumed access paths.</p><div className="table-scroll"><table><caption>Tested plans</caption><thead><tr><th>Plan</th><th>Normal</th><th>Toughest</th></tr></thead><tbody>{result.runs.map(r=><tr key={r.run_id}><th>{titles[r.kind]}{r.run_id===run.run_id?' ✓':''}</th><td>{pct(r.metrics.normal.coverage)}</td><td>{pct(r.summary.minimum_coverage)}</td></tr>)}</tbody></table></div><PlacementDetails run={run} study={p.study} active={active} site={selected} onSite={setSelected}/></details>
       <p className="site-caveat">Mapped facilities are planning candidates; resource availability is unverified.</p><a className="download-plan" href={`/api/runs/${run.run_id}`} target="_blank" rel="noreferrer">Open plan data ↗</a>
      </>:<p className="workspace-empty">Calculate a plan to compare locations.</p>}
     </section>
     <div hidden={panel!=='point'}><PointInspector route={route}/></div>
     <section className="workspace-info" hidden={panel!=='info'}><h2>Data & methodology</h2><p>OpenStreetMap roads and mapped facilities dated October 23, 2026. City boundaries and whole-tract population use Census 2020 data.</p><p>Planning compares a starting placement, a normal-day placement and a disruption placement. The recommended score weights average coverage at 60% and toughest-test coverage at 40%.</p><p>Routes respect the saved road network and one-way restrictions. Speeds, access paths, winter effects and closures are assumptions. No live traffic or verified emergency service availability is provided.</p><p>The Quad Cities calculation uses population. The evaluated incident forecast applies to the separate original Iowa study.</p><p>Animated lines illustrate activity on saved roads; they are not live solver telemetry or calculated routes.</p><a href="/?view=advanced">Open research tools & methodology ↗</a></section>
    </div>
   </aside>
   {screenError&&<div className="workspace-toast" role="status">{screenError}<button aria-label="Dismiss fullscreen message" onClick={()=>setScreenError('')}>×</button></div>}
  </main>
  <footer className="workspace-statusbar"><span><i/> {p.loading?'Loading region':p.progress?'Calculating plan':route.busy?'Checking point':'Quad Cities study'}</span><span className="workspace-status-source">OSM 2026 · Census 2020 · Planning estimates</span><button onClick={()=>show('info')}>Data & limits</button></footer>
 </div>;
}
