import type {Metric,SampleMetric,Study} from './types';

export const kinds=['baseline','static','resilient'] as const;
export const colors={baseline:'#596b7e',static:'#2368ac',resilient:'#08785e'};
export const titles={baseline:'Baseline',static:'Static',resilient:'Resilient'};
export const pct=(v:number)=>`${(v*100).toFixed(1)}%`;
export const minutes=(v:number)=>`${(v/60).toFixed(2)} min`;
export const scenarioName=(study:Study|null,id:string)=>study?.scenarios.find(s=>s.id===id)?.name??id.replaceAll('_',' ');
export const noDemand=(m:Metric|SampleMetric)=>'no_demand' in m?m.no_demand:m.incidents===0;

// JSON null encodes both infinite statistics and absent demand. Use the API's
// demand flag / incident count and unreachable share to distinguish them.
export function travel(v:number|null,m:Metric|SampleMetric,conditional=false){
 if(noDemand(m))return 'No demand';
 if(v!==null)return minutes(v);
 if(conditional)return m.unreachable_share>0?'No reachable demand':'Unavailable';
 return m.unreachable_share>0?'Unbounded (unreachable demand)':'Unavailable';
}

export function pointChange(after:number,before:number){
 const value=(after-before)*100;
 // Avoid a negative zero after presentation rounding.
 return `${Math.abs(value)<.05?'0.0':`${value>0?'+':''}${value.toFixed(1)}`} pp`;
}
