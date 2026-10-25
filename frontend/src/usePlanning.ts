import {useEffect,useRef,useState} from 'react';
import type {Config,Study,Run,Simulation} from './types';
import {api,type Evaluation} from './api';
import {initialLayers} from './components/MapPanel';

const initial:Config={dataset:'fixture',resource_count:3,threshold_minutes:5,objective:'coverage',method:'exact',demand_model:'population',blend:.5,scenario_ids:['normal','winter','closure','resource_failure','event','combined'],average_weight:.6,worst_case_weight:.4,seed:42,solver_limit_ms:2000,baseline_method:'deterministic',access_mode:'connector',access_speed_kph:20,winter_multiplier:1.6,closure_profile:'central'};

export function usePlanning(){
 const [config,setConfig]=useState<Config>(()=>{
  const params=new URLSearchParams(window.location.search);
  return params.get('dataset')==='iowa'&&params.get('demand')==='blended'?{...initial,dataset:'iowa',demand_model:'blended'}:initial;
 }),[study,setStudy]=useState<Study|null>(null),[runs,setRuns]=useState<Run[]>([]),[simulation,setSimulation]=useState<Simulation|null>(null);
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[active,setActive]=useState('normal'),[site,setSite]=useState<string|null>(null);
 const [layers,setLayers]=useState(initialLayers);
 const [trials,setTrials]=useState(10000),[advanced,setAdvanced]=useState(false),[riskInfo,setRiskInfo]=useState(''),[pageTime,setPageTime]=useState<number|null>(null),[evaluation,setEvaluation]=useState<Evaluation|null>(null);
 const currentTrials=useRef(trials);currentTrials.current=trials;
 const controller=useRef<AbortController|null>(null),signature=JSON.stringify(config),current=useRef(signature);current.current=signature;
 const [resultSignature,setResultSignature]=useState('');const stale=!!runs.length&&resultSignature!==signature;
 useEffect(()=>{controller.current?.abort();setBusy('');setSimulation(null);setSite(null);setError('')},[signature]);
 useEffect(()=>{let alive=true;setStudy(null);setRuns([]);setBusy('Loading study area');
  api<Study>(`/api/study-area?dataset_id=${config.dataset}&winter_multiplier=${config.winter_multiplier}&closure_profile=${config.closure_profile}`).then(data=>{if(alive){performance.mark('gridaid-study-data-ready');setStudy(data);setError('');setBusy('');setPageTime(performance.now())}}).catch(e=>{if(alive){setError(e.message);setBusy('')}});
  return ()=>{alive=false};},[config.dataset,config.winter_multiplier,config.closure_profile]);
 useEffect(()=>{api<{reason:string;evaluation:Evaluation|null}>('/api/ml/model-card').then(x=>{setRiskInfo(x.reason);setEvaluation(x.evaluation)}).catch(()=>setRiskInfo('Model status could not be loaded.'))},[]);
 useEffect(()=>{if(study&&!study.dataset.ml_validated)setLayers(p=>({...p,risk:false}))},[study]);
 const latest=runs.find(r=>r.kind==='resilient')??runs.find(r=>r.kind==='static')??runs[0];
 async function execute(kind:'baseline'|'static'|'resilient'|'simulation'){
  const token=signature;controller.current?.abort();const abort=new AbortController();controller.current=abort;setBusy(kind==='simulation'?'Sampling paired incidents':`Calculating ${kind}`);setError('');
  try{
   if(kind==='simulation'){
    const result=await api<Simulation>('/api/simulate',{run_ids:runs.map(r=>r.run_id),trials,seed:config.seed},abort.signal);
    if(controller.current===abort&&current.current===token&&currentTrials.current===trials)setSimulation(result);
   }else{
    const endpoint=kind==='baseline'?'/api/baseline':`/api/optimize/${kind}`;
    const run=await api<Run>(endpoint,config,abort.signal);
    if(controller.current===abort&&current.current===token){
     setRuns(prev=>kind==='baseline'||resultSignature!==token?[run]:[...prev.filter(r=>r.kind!==kind),run]);setResultSignature(token);setSimulation(null);setSite(null);
     if(!['optimal','feasible','heuristic'].includes(run.solver.status))setError(`Solver returned ${run.solver.status}; no feasible configuration available.`);
    }
   }
  }catch(e){if(controller.current===abort&&current.current===token&&!(e instanceof DOMException&&e.name==='AbortError'))setError(e instanceof Error?e.message:'Request failed')}
  finally{if(controller.current===abort&&current.current===token)setBusy('')}
 }
 useEffect(()=>{if(active!=='normal'&&!config.scenario_ids.includes(active))setActive('normal')},[config.scenario_ids,active]);
 async function loadDemo(){setError('');try{const preset=await api<{configuration:Config}>('/api/demo-preset');setConfig(preset.configuration);setActive('normal');setAdvanced(true);setRuns([]);setSimulation(null)}catch(e){setError(e instanceof Error?e.message:'Demo preset unavailable')}}
 const canStatic=!busy&&!stale&&runs.some(r=>r.kind==='baseline');
 const canResilient=canStatic&&runs.some(r=>r.kind==='static'&&r.selected_site_ids.length===config.resource_count);
 const canSimulate=canResilient&&runs.some(r=>r.kind==='resilient'&&r.selected_site_ids.length===config.resource_count);
 return {config,setConfig,study,runs,simulation,busy,error,active,setActive,site,setSite,layers,setLayers,trials,setTrials,advanced,setAdvanced,riskInfo,evaluation,pageTime,latest,stale,canStatic,canResilient,canSimulate,execute,loadDemo,onTrialsChange:()=>{setSimulation(null);if(busy==='Sampling paired incidents'){controller.current?.abort();setBusy('')}}};
}
