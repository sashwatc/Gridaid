export async function api<T>(path:string,body?:unknown,signal?:AbortSignal):Promise<T>{
 const timeout=AbortSignal.timeout(30000);
 try{
  const res=await fetch(path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:signal?AbortSignal.any([signal,timeout]):timeout});
  const contentType=res.headers.get('content-type')??'';
  if(!contentType.includes('application/json'))throw new Error('The planning service returned an unexpected response. Please try again.');
  const data=await res.json();
  if(!res.ok){
   if(res.status===429)throw new Error(`Too many calculations. Please wait ${res.headers.get('Retry-After')??'60'} seconds, then try again.`);
   if(res.status===503)throw new Error('The planning service is busy or temporarily unavailable. Please try again shortly.');
   if(res.status===504)throw new Error('The calculation took too long. Please try again, or use fewer resources.');
   throw new Error(typeof data.detail==='string'?data.detail:`The planning service could not finish (${res.status}). Please try again.`);
  }
  return data as T;
 }catch(error){
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  if(timeout.aborted)throw new Error('The planning service took too long to respond. Please try again.');
  if(error instanceof TypeError)throw new Error('Cannot reach the planning service. Check your connection and try again.');
  if(error instanceof SyntaxError)throw new Error('The planning service returned an unreadable response. Please try again.');
  throw error;
 }
}

export type Evaluation={model_version:string;selected_by_validation_mae:string;forecast_period:string;test:Record<string,{mae:number;rmse:number;rank_correlation:number|null}>;validation_permutation_importance:Record<string,number>};
