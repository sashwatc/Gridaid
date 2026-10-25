import {useState} from 'react';
import {kphToMph,mphToKph} from '../units';

export function ImperialSpeedInput({value,onChange}:{value:number;onChange:(kph:number)=>void}){
 const [draft,setDraft]=useState<string|null>(null);
 return <input aria-label="Access speed" type="number" min={kphToMph(1)} max={kphToMph(60)} step="any" value={draft??kphToMph(value).toFixed(2)} onFocus={()=>setDraft(kphToMph(value).toFixed(2))} onBlur={()=>setDraft(null)} onChange={e=>{setDraft(e.target.value);onChange(mphToKph(Number(e.target.value)));}}/>;
}
