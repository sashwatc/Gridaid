import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './style.css';
import {usePlanning} from './usePlanning';
import {Controls} from './components/Controls';
import {Workflow} from './components/Workflow';
import {MapPanel,type Placement} from './components/MapPanel';
import {Comparison} from './components/Comparison';
import {PlacementDetails} from './components/PlacementDetails';
import {SimulationPanel} from './components/SimulationPanel';
import {Methodology} from './components/Methodology';

function App(){
 const p=usePlanning();
 const [tab,setTab]=useState<'planner'|'methodology'>('planner');
 const [placement,setPlacement]=useState<Placement>('latest');
 const shown=placement==='latest'?p.latest:p.runs.find(r=>r.kind===placement)??p.latest;
 useEffect(()=>{if(placement!=='latest'&&!p.runs.some(r=>r.kind===placement))setPlacement('latest')},[p.runs,placement]);
 function view(value:Placement){setPlacement(value);p.setSite(null)}
 return <>
  <a className="skip-link" href="#main-content">Skip to workspace</a>
  <header><a className="brand" href="#" onClick={()=>setTab('planner')}><span className="brand-mark">G<span>+</span></span><strong>GridAid</strong><span className="brand-sub">RESILIENCE LAB</span></a><nav aria-label="Primary"><button aria-current={tab==='planner'?'page':undefined} className={tab==='planner'?'nav-active':''} onClick={()=>setTab('planner')}>Planning workspace</button><button aria-current={tab==='methodology'?'page':undefined} className={tab==='methodology'?'nav-active':''} onClick={()=>setTab('methodology')}>Methodology & trust</button></nav><span className="local"><i/> Local planning simulator</span></header>
  {tab==='methodology'?<Methodology study={p.study} riskInfo={p.riskInfo} evaluation={p.evaluation} pageTime={p.pageTime}/>:<>
   <Workflow busy={p.busy} stale={p.stale} runs={p.runs} available={!!p.study} canStatic={p.canStatic} canResilient={p.canResilient} canSimulate={p.canSimulate} execute={p.execute}/>
   <div className="workspace"><Controls config={p.config} setConfig={p.setConfig} study={p.study} busy={p.busy} advanced={p.advanced} setAdvanced={p.setAdvanced} trials={p.trials} setTrials={p.setTrials} onTrialsChange={p.onTrialsChange} loadDemo={p.loadDemo}/>
    <main className="canvas" id="main-content"><div className="page-heading"><div><span className="eyebrow">{p.config.dataset==='fixture'?'SYNTHETIC CORRIDOR / TEACHING FIXTURE':'SCOTT COUNTY, IOWA / PUBLIC-DATA CROP'}</span><h1>How well does your plan hold up?</h1><p>Place resources. Test disruption. Compare the tradeoff.</p></div><span className="badge">{p.config.dataset==='fixture'?'SYNTHETIC LAB':'PUBLIC-DATA CROP'}</span></div>
     {p.busy&&<div role="status" className="status"><span className="spinner"/>{p.busy}…</div>}{p.error&&<div role="alert" className="error">{p.error}</div>}{p.stale&&<div role="status" className="stale">Controls changed. Results below are stale. Load baseline to recalculate with the current assumptions.</div>}
     {p.config.dataset==='iowa'&&<p className="hint geography-note">39 whole-tract weights at original 2020 Census internal points; not all Scott County. Access: {p.config.access_mode==='connector'?`${p.config.access_speed_kph} km/h assumed straight connector`:'road-only optimistic diagnostic'}. This does not measure exact household coverage.</p>}
     <div className="result-space" aria-busy={!!p.busy}>
      <div id="network-map"><MapPanel study={p.study} config={p.config} runs={p.runs} shown={shown} placement={placement} onPlacement={view} active={p.active} onActive={value=>{p.setActive(value);p.setSite(null)}} layers={p.layers} setLayers={p.setLayers} onSite={p.setSite} stale={p.stale}/></div>
      <Comparison runs={p.runs} study={p.study} stale={p.stale} onView={kind=>{view(kind);document.getElementById('network-map')?.scrollIntoView({block:'start'})}}/>
      {shown&&<PlacementDetails run={shown} study={p.study} active={p.active} site={p.site} onSite={p.setSite}/>}
      {p.simulation&&<SimulationPanel simulation={p.simulation} runs={p.runs} study={p.study} active={p.active}/>}
     </div>
     <footer>GridAid / Transparent assumptions. Measurable resilience.<span>Dataset {p.study?.dataset.version??'not loaded'} · {p.study?.dataset.model_version??'no ML for fixture'}</span></footer>
    </main>
   </div>
  </>}
 </>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
