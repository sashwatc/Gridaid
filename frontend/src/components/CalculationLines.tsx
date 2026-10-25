import {useEffect,useMemo} from 'react';
import {svg} from 'leaflet';
import {Pane,Polyline,useMap} from 'react-leaflet';
import type {Bounds,Study} from '../types';
import {inBounds,regionCities} from '../region';

// Decorative activity follows actual saved road geometry. It does not claim
// to stream solver iterations, candidate decisions or calculated routes.
export function CalculationLines({study,bounds=null,cityIds=[]}:{study:Study;bounds?:Bounds|null;cityIds?:string[]}){
 const map=useMap();
 const renderer=useMemo(()=>svg({pane:'calculation-lines'}),[]);
 useEffect(()=>()=>{if(renderer&&map.hasLayer(renderer))map.removeLayer(renderer);},[map,renderer]);
 const paths=useMemo(()=>{
  const cities=regionCities(study).filter(c=>cityIds.includes(c.id));
  const box=bounds??(cities.length?[Math.min(...cities.map(c=>c.bounds[0])),Math.min(...cities.map(c=>c.bounds[1])),Math.max(...cities.map(c=>c.bounds[2])),Math.max(...cities.map(c=>c.bounds[3]))] as Bounds:null);
  const nodes=new Map(study.dataset.nodes.map(n=>[n.id,n]));
  const eligible=study.dataset.edges.filter(e=>{const n=nodes.get(e.u)!;return inBounds(n.lat,n.lon,box);});
  const major=eligible.filter(e=>['motorway','trunk','primary','secondary'].includes(e.road_class?.split('_')[0]));
  const pool=major.length>=12?major:eligible;
  const outgoing=new Map<string,typeof pool>();
  for(const edge of pool)outgoing.set(edge.u,[...(outgoing.get(edge.u)??[]),edge]);
  // Join connected real segments into visible street traces at region zoom.
  // The bounded walks are an illustration, not routing or solver decisions.
  const traces:[number,number][][]=[],used=new Set<string>();
  const count=Math.min(64,pool.length);
  for(let i=0;i<count;i++){
   let edge=pool[Math.floor(i*pool.length/count)];
   const trace:[number,number][]=[],visited=new Set<string>([edge.u]);
   for(let step=0;step<42;step++){
    if(used.has(edge.id))break;
    used.add(edge.id);visited.add(edge.v);
    trace.push(...(edge.geometry.length?edge.geometry.map(p=>[p[1],p[0]] as [number,number]):[nodes.get(edge.u)!,nodes.get(edge.v)!].map(n=>[n.lat,n.lon] as [number,number])));
    const a=nodes.get(edge.u)!,b=nodes.get(edge.v)!;
    const heading=[b.lon-a.lon,b.lat-a.lat];
    const candidates=(outgoing.get(edge.v)??[]).filter(next=>!visited.has(next.v)&&!used.has(next.id));
    const score=(next:typeof edge)=>{const c=nodes.get(next.v)!,dx=c.lon-b.lon,dy=c.lat-b.lat;return (next.road_class===edge.road_class?2:0)+(heading[0]*dx+heading[1]*dy)/Math.max(1e-12,Math.hypot(...heading)*Math.hypot(dx,dy));};
    candidates.sort((x,y)=>score(y)-score(x));
    if(!candidates.length)break;
    edge=candidates[0];
   }
   if(trace.length>1)traces.push(trace);
  }
  return traces;
 },[study,bounds,cityIds]);
 return <Pane name="calculation-lines" style={{zIndex:425,pointerEvents:'none'}}><Polyline className="calculation-road-base" positions={paths} renderer={renderer} interactive={false} pathOptions={{color:'#54c8ee',weight:3,opacity:.2,lineCap:'round'}}/><Polyline className="calculation-road-line" positions={paths} renderer={renderer} interactive={false} pathOptions={{color:'#8ceaff',weight:3,opacity:.95,dashArray:'7 15',lineCap:'round'}}/></Pane>;
}
