import type {Bounds,Demand,MappedFacility,RegionCity,Study} from './types';

export const regionCities=(study:Study|null)=>(study?.dataset.provenance.cities as RegionCity[]|undefined)??[];
export const mappedFacilities=(study:Study|null)=>(study?.dataset.provenance.facilities as MappedFacility[]|undefined)??[];
export const inBounds=(lat:number,lon:number,bounds:Bounds|null)=>!bounds||lat>=bounds[0]&&lat<=bounds[2]&&lon>=bounds[1]&&lon<=bounds[3];
export function scopedPoints(study:Study|null,bounds:Bounds|null,cityIds:string[]){
 if(!study)return {demands:[] as Demand[],candidates:[] as Study['dataset']['candidates'],population:0};
 const communities=new Set(regionCities(study).filter(c=>cityIds.includes(c.id)).map(c=>c.community));
 const nodes=new Map(study.dataset.nodes.map(n=>[n.id,n]));
 const facilities=new Map(mappedFacilities(study).map(f=>[f.id,f]));
 const included=(lat:number,lon:number,community:string|null)=>inBounds(lat,lon,bounds)&&(!cityIds.length||communities.has(community??''));
 const demands=study.dataset.demands.filter(d=>included(d.origin_lat??nodes.get(d.node)!.lat,d.origin_lon??nodes.get(d.node)!.lon,d.community));
 const candidates=study.dataset.candidates.filter(c=>{const p=facilities.get(c.id)??nodes.get(c.node)!;return included(p.lat,p.lon,c.community);});
 return {demands,candidates,population:demands.reduce((sum,d)=>sum+d.population,0)};
}
