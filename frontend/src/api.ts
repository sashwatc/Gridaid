export async function api<T>(path:string,body?:unknown,signal?:AbortSignal):Promise<T>{
 const res=await fetch(path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal});
 const data=await res.json();
 if(!res.ok)throw new Error(typeof data.detail==='string'?data.detail:`Request failed (${res.status})`);
 return data as T;
}

export type Evaluation={model_version:string;selected_by_validation_mae:string;forecast_period:string;test:Record<string,{mae:number;rmse:number;rank_correlation:number|null}>;validation_permutation_importance:Record<string,number>};
