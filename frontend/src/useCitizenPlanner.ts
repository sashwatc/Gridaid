import {useEffect,useRef,useState} from 'react';
import {api} from './api';
import type {Config,Run,Study} from './types';

export type PlanResult={runs:Run[];recommended:Run;config:Config};

export function useCitizenPlanner(){
 const [study,setStudy]=useState<Study|null>(null);
 const [preset,setPreset]=useState<Config|null>(null);
 const [resources,setResources]=useState('4'),[minutes,setMinutes]=useState('5');
 const [loading,setLoading]=useState(true),[progress,setProgress]=useState(''),[error,setError]=useState('');
 const [result,setResult]=useState<PlanResult|null>(null),[attempt,setAttempt]=useState(0);
 const request=useRef<AbortController|null>(null);
 const initialized=useRef(false);
 useEffect(()=>{
  const abort=new AbortController();setLoading(true);setError('');
  async function load(){
   try{
    const demo=await api<{configuration:Config}>('/api/demo-preset',undefined,abort.signal);
    const config=demo.configuration;
    const data=await api<Study>(`/api/study-area?dataset_id=${config.dataset}&winter_multiplier=${config.winter_multiplier}&closure_profile=${config.closure_profile}`,undefined,abort.signal);
    if(abort.signal.aborted)return;
    setPreset(config);setStudy(data);
    if(!initialized.current){setResources(String(config.resource_count));setMinutes(String(config.threshold_minutes));initialized.current=true;}
   }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Unable to load the map. Please try again.');}
   finally{if(!abort.signal.aborted)setLoading(false);}
  }
  void load();return()=>abort.abort();
 },[attempt]);
 useEffect(()=>()=>request.current?.abort(),[]);

 const count=Number(resources),threshold=Number(minutes),maxCount=Math.min(25,study?.dataset.candidates.length??25);
 const validation=!Number.isInteger(count)||count<1||count>maxCount?`Choose a whole number of resources from 1 to ${maxCount}.`:!Number.isFinite(threshold)||threshold<1||threshold>60?'Choose a travel time from 1 to 60 minutes.':'';
 function cancel(){request.current?.abort();request.current=null;setProgress('');}
 function update(field:'resources'|'minutes',value:string){cancel();setResult(null);setError('');if(field==='resources')setResources(value);else setMinutes(value);}
 async function findPlan(){
  if(!preset||!study||validation||request.current)return;
  const abort=new AbortController();request.current=abort;setError('');setResult(null);
  const config={...preset,resource_count:count,threshold_minutes:threshold};
  const runs:Run[]=[];
  try{
   for(const [path,message] of [
    ['/api/baseline','1 of 3 · Checking the starting plan'],
    ['/api/optimize/static','2 of 3 · Finding locations for normal days'],
    ['/api/optimize/resilient','3 of 3 · Testing snow and road closures'],
   ]){
    setProgress(message);
    const run=await api<Run>(path,config,abort.signal);
    if(request.current!==abort||abort.signal.aborted)return;
    if(!['optimal','feasible','heuristic'].includes(run.solver.status)||run.selected_site_ids.length!==count)throw new Error('A complete plan could not be found. Please try again, or choose fewer resources.');
    runs.push(run);
   }
   // Prefer the resilience solution on an exact tie; never invent an improvement.
   const recommended=[...runs].reverse().sort((a,b)=>b.summary.resilience_score-a.summary.resilience_score)[0];
   if(request.current===abort)setResult({runs,recommended,config});
  }catch(e){if(request.current===abort&&!abort.signal.aborted)setError(e instanceof Error?e.message:'Unable to finish your plan. Please try again.');}
  finally{if(request.current===abort){request.current=null;setProgress('');}}
 }
 return {study,preset,resources,minutes,loading,progress,error,result,validation,maxCount,update,findPlan,cancel,retryLoad:()=>setAttempt(x=>x+1)};
}
