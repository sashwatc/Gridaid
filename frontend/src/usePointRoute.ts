import {useEffect,useRef,useState} from 'react';
import {api} from './api';
import type {Bounds,MapPoint,PointRouteResult,Run,Study} from './types';

export function usePointRoute(study:Study|null,run:Run|undefined,scenario:string,bounds:Bounds|null,cities:string[],paused=false){
 const [point,setPoint]=useState<MapPoint|null>(null),[direction,setDirection]=useState<'to_resource'|'from_resource'>('to_resource');
 const [result,setResult]=useState<PointRouteResult|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const cache=useRef(new Map<string,PointRouteResult>());
 const body=point&&study&&!paused?{dataset:study.dataset.id,lat:point.lat,lon:point.lon,run_id:run?.run_id??null,scenario_id:scenario,direction,focus_bounds:bounds,focus_city_ids:cities}:null;
 const key=JSON.stringify(body);
 useEffect(()=>{
  setResult(null);setError('');
  if(!body){setBusy(false);return;}
  const saved=cache.current.get(key);if(saved){setResult(saved);setBusy(false);return;}
  const abort=new AbortController();setBusy(true);
  const timer=window.setTimeout(()=>{
   api<PointRouteResult>('/api/route/point',body,abort.signal).then(data=>{if(!abort.signal.aborted){cache.current.set(key,data);if(cache.current.size>20)cache.current.delete(cache.current.keys().next().value!);setResult(data);}}).catch(e=>{if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Unable to check this point. Please try again.');}).finally(()=>{if(!abort.signal.aborted)setBusy(false);});
  },250);
  return()=>{window.clearTimeout(timer);abort.abort();};
 },[key,attempt]);
 return {point,setPoint,direction,setDirection,result,busy,error,retry:()=>setAttempt(x=>x+1),clear:()=>setPoint(null)};
}
