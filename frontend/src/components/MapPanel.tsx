import {useEffect,useMemo} from 'react';
import {MapContainer,TileLayer,Polyline,CircleMarker,Tooltip,Rectangle,Pane,ScaleControl,useMap} from 'react-leaflet';
import type {Config,Run,Study} from '../types';
import {colors,kinds,minutes,titles} from '../presentation';
import {feet} from '../units';
import {CalculationLines} from './CalculationLines';

export const initialLayers={roads:true,population:true,candidates:true,coverage:true,improvement:false,disruptions:true,basemap:false,risk:false,access:false};
export type Layers=typeof initialLayers;
export type Placement='latest'|Run['kind'];
type Props={study:Study|null;config:Config;runs:Run[];shown:Run|undefined;placement:Placement;onPlacement:(value:Placement)=>void;active:string;onActive:(value:string)=>void;layers:Layers;setLayers:React.Dispatch<React.SetStateAction<Layers>>;onSite:(id:string)=>void;stale:boolean;calculating:boolean};

function bounds(study:Study):[number,number][]{
 const box=study.dataset.provenance.study_bbox_south_west_north_east as number[]|undefined;
 return box?[[box[0],box[1]],[box[2],box[3]]]:study.dataset.nodes.map(n=>[n.lat,n.lon]);
}

function MapTools({study}:{study:Study}){
 const map=useMap();
 // Preserve the verified synchronous zoom/fit lifecycle across tab navigation.
 useEffect(()=>{
  map.fitBounds(bounds(study),{padding:[30,30],animate:false});
  let second=0;
  const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{
   const marks=performance.getEntriesByName('gridaid-study-data-ready');
   performance.measure('gridaid-map-commit-and-frame',{start:marks.length?marks[marks.length-1].startTime:performance.now(),end:performance.now()});
  })});
  return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second)};
 },[map,study]);
 return <div className="map-tools"><span className="north-arrow" aria-label="North is up">↑ N</span><button onClick={()=>map.fitBounds(bounds(study),{padding:[30,30],animate:false})}>Fit study area</button></div>;
}

export function MapPanel({study,config,runs,shown,placement,onPlacement,active,onActive,layers,setLayers,onSite,stale,calculating}:Props){
 const nodes=useMemo(()=>new Map(study?.dataset.nodes.map(n=>[n.id,n])??[]),[study]);
 const roads=useMemo(()=>study?.dataset.edges.map(e=>{
  const a=nodes.get(e.u)!,b=nodes.get(e.v)!;
  return {id:e.id,major:['motorway','trunk','primary','secondary'].includes(e.road_class?.split('_')[0]),path:e.geometry.length?e.geometry.map(p=>[p[1],p[0]] as [number,number]):[[a.lat,a.lon],[b.lat,b.lon]] as [number,number][]};
 })??[],[study,nodes]);
 // Place names come from the snapshot's audited community assignments. Their
 // anchors are averages of representative points/sites, not new city boundaries.
 const communities=useMemo(()=>{
  const groups=new Map<string,[number,number][]>();
  if(!study||study.dataset.id==='fixture')return [];
  const points=[...study.dataset.demands.map(d=>({community:d.community,lat:d.origin_lat??nodes.get(d.node)!.lat,lon:d.origin_lon??nodes.get(d.node)!.lon})),...study.dataset.candidates.map(c=>({...nodes.get(c.node)!,community:c.community}))];
  for(const p of points)if(p.community?.endsWith(' city'))groups.set(p.community,[...(groups.get(p.community)??[]),[p.lat,p.lon]]);
  return [...groups].map(([name,points])=>({name:name.replace(' city',''),center:[points.reduce((n,p)=>n+p[0],0)/points.length,points.reduce((n,p)=>n+p[1],0)/points.length] as [number,number]}));
 },[study,nodes]);
 const scenario=study?.scenarios.find(s=>s.id===active);
 const closed=new Set(layers.disruptions?scenario?.closed_edge_ids:[]);
 const access=new Map(shown?.demand_access[active]?.map(a=>[a.demand_id,a])??[]);
 const baseline=new Map(runs.find(r=>r.kind==='baseline')?.demand_access[active]?.map(a=>[a.demand_id,a])??[]);
 const box=study?.dataset.provenance.study_bbox_south_west_north_east as number[]|undefined;
 return <section className="map-card" aria-label="Network map">
  <div className="map-toolbar"><div><h2>Network & geographic access</h2><span>{study?`${study.quality.nodes.toLocaleString()} nodes · ${study.dataset.candidates.length} candidate sites`:'Loading study…'}</span></div><label>Stress-test view<select aria-label="Stress-test view" value={active} onChange={e=>onActive(e.target.value)}>{study?.scenarios.filter(s=>s.id==='normal'||config.scenario_ids.includes(s.id)).map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label></div>
  <div className="placement-bar" role="group" aria-label="Map placement"><span>View placement</span><div className="placement-options">{(['latest',...kinds] as const).map(kind=><button key={kind} aria-pressed={placement===kind} disabled={kind!=='latest'&&!runs.some(r=>r.kind===kind&&r.selected_site_ids.length>0)} onClick={()=>onPlacement(kind)}>{kind==='latest'?'Latest':titles[kind]}</button>)}</div><p data-testid="map-placement">{stale?'Stale · ':''}{shown?`${titles[shown.kind]} · ${shown.selected_site_ids.length} selected sites`:'No placement calculated'}</p></div>
  {study&&<div className="map-wrap"><MapContainer center={[41.55,-90.58]} zoom={12} scrollWheelZoom={true} preferCanvas={true} zoomAnimation={false} className="map" aria-label="Study road network and representative demand points">
   <MapTools study={study}/><ScaleControl position="bottomleft" imperial={true} metric={false}/>
   {layers.basemap&&study.dataset.id!=='fixture'&&<TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© OpenStreetMap contributors'/>}
   {box&&<Rectangle bounds={[[box[0],box[1]],[box[2],box[3]]]} pathOptions={{color:'#4e6e7b',weight:2,dashArray:'7 6',fill:false}}><Tooltip>Study selection rectangle · not a municipal or tract boundary</Tooltip></Rectangle>}
   {layers.roads&&<><Polyline positions={roads.filter(e=>!e.major&&!closed.has(e.id)).map(e=>e.path)} pathOptions={{color:'#9cb1ba',weight:1.3,opacity:.7}}/><Polyline positions={roads.filter(e=>e.major&&!closed.has(e.id)).map(e=>e.path)} pathOptions={{color:'#788f9b',weight:2.5,opacity:.8}}/></>}
   {layers.disruptions&&<Polyline positions={roads.filter(e=>closed.has(e.id)).map(e=>e.path)} pathOptions={{color:'#b93d35',weight:5,opacity:1}}/>}
   {(layers.population||layers.coverage||layers.improvement||layers.risk)&&[...study.dataset.demands,...(scenario?.temporary_demand??[])].map(d=>{
    const node=nodes.get(d.node);if(!node)return null;
    const n={lat:d.origin_lat??node.lat,lon:d.origin_lon??node.lon},a=access.get(d.id),b=baseline.get(d.id);
    const improved=layers.improvement&&a&&b&&a.covered&&!b.covered;
    const color=layers.risk&&d.risk!==null?'#78419c':layers.improvement&&a&&b?(improved?'#7344b6':!a.covered&&b.covered?'#b4522e':'#879ba7'):layers.coverage&&a?(a.covered?'#08785e':'#b55c26'):'#36758f';
    return <CircleMarker key={d.id} center={[n.lat,n.lon]} radius={layers.risk&&d.risk!==null?Math.min(22,4+Math.sqrt(d.risk)*3):Math.min(18,4+Math.sqrt(d.population)/8)} pathOptions={{color,weight:1.5,fillColor:color,fillOpacity:.3}}><Tooltip>{d.id} · {d.community??'synthetic point'} · demand {d.population.toFixed(0)} · access {feet(d.snap_m)}{layers.risk&&d.risk!==null?` · forecast count ${d.risk.toFixed(2)} (Jan 2024)`:''}<br/>{a?`Travel: ${a.time_s===null?'No route from an available selected site':minutes(a.time_s)} · ${a.covered?'within':'outside'} threshold`:'Load a placement for access.'}</Tooltip></CircleMarker>;
   })}
   {layers.access&&study.dataset.demands.filter(d=>d.origin_lat!==null&&d.snap_lat!==null).map(d=><Polyline key={`access-${d.id}`} positions={[[d.origin_lat!,d.origin_lon!],[d.snap_lat!,d.snap_lon!]]} pathOptions={{color:'#8c4ba5',weight:2,dashArray:'3 5'}}><Tooltip>{d.id}: assumed straight access {feet(d.snap_m)}; not a verified path</Tooltip></Polyline>)}
   {(layers.candidates||shown)&&study.dataset.candidates.map(c=>{
    const n=nodes.get(c.node);if(!n)return null;
    const chosen=shown?.selected_site_ids.includes(c.id);if(!chosen&&!layers.candidates)return null;
    const failed=layers.disruptions&&scenario?.disabled_site_ids.includes(c.id);
    return <CircleMarker key={c.id} center={[n.lat,n.lon]} radius={chosen?9:4} pathOptions={{color:failed?'#b93d35':chosen?colors[shown!.kind]:'#526a78',weight:chosen?3:1,fillColor:chosen?'white':'#f5f7f8',fillOpacity:1,dashArray:failed?'3 3':undefined}} eventHandlers={{click:()=>onSite(c.id)}}><Tooltip>{c.id} · {c.label}{chosen?' · selected':''}{failed?' · unavailable':''}</Tooltip></CircleMarker>;
   })}
   <Pane name="community-labels" style={{zIndex:450,pointerEvents:'none'}}>{communities.map(c=><CircleMarker key={c.name} center={c.center} radius={0} interactive={false} pathOptions={{stroke:false,fill:false}}><Tooltip permanent direction="center" pane="community-labels" className="place-label">{c.name}</Tooltip></CircleMarker>)}</Pane>
   {calculating&&<CalculationLines study={study}/>}
  </MapContainer>{calculating&&<div className="map-activity-badge" data-testid="map-activity" title="Illustrative activity on saved roads, not a live solver trace"><span/> Analyzing mapped roads</div>}</div>}
  <div className="map-context" data-testid="map-context"><strong>{config.dataset==='fixture'?'Synthetic corridor · invented geography':config.dataset==='quad_cities'?'Quad Cities · Iowa and Illinois':'Davenport / Bettendorf · Scott County, Iowa'}</strong><span>{box?`${box[0].toFixed(2)}–${box[2].toFixed(2)}°N · ${Math.abs(box[1]).toFixed(2)}–${Math.abs(box[3]).toFixed(2)}°W · dashed selection rectangle`:'Invented roads and demand; geographic coordinates are illustrative.'}</span>{config.dataset==='iowa'&&<span>Offline labels locate community point clusters. Online OSM tiles add street and river context.</span>}</div>
  <div className="map-legend" aria-label="Map legend">
   {layers.risk?<span><i style={{background:'#78419c'}}/>Jan 2024 forecast count · symbol size</span>:layers.improvement?<>{shown&&baseline.size>0?<><span><i style={{background:'#7344b6'}}/>New coverage vs baseline</span><span><i style={{background:'#b4522e'}}/>Lost coverage</span></>:<span>Calculate a baseline and placement to compare coverage.</span>}</>:layers.coverage&&shown?<><span><i style={{background:'#08785e'}}/>Covered demand</span><span><i style={{background:'#b55c26'}}/>Outside threshold</span></>:<span><i style={{background:'#36758f'}}/>Representative demand points</span>}
   <span><i className="site-symbol" style={{borderColor:shown?colors[shown.kind]:'#526a78'}}/>{shown?`${titles[shown.kind]} selected site`:'Candidate site'}</span>{layers.disruptions&&<span><i style={{background:'#b93d35'}}/>Closure / unavailable site</span>}{layers.access&&<span>Assumed access · unverified path</span>}
  </div>
  <details className="map-layers" open><summary>Map layers</summary><div className="layer-row">{Object.entries(layers).map(([key,value])=><label className="check" key={key}><input type="checkbox" checked={value} disabled={key==='risk'&&!study?.dataset.ml_validated||key==='basemap'&&config.dataset==='fixture'} onChange={e=>setLayers(p=>({...p,...(['risk','coverage','improvement'].includes(key)&&e.target.checked?{risk:false,coverage:false,improvement:false}:{}),[key]:e.target.checked}))}/>{key==='basemap'?'OSM tiles (online)':key==='risk'?'ML risk · Jan 2024':key}</label>)}{!study?.dataset.ml_validated&&<span className="hint">ML risk unavailable for this dataset</span>}</div></details>
  <div className="scenario-note"><b>{scenario?.name}</b> {scenario?.description}<span>Provenance: {scenario?.provenance}</span></div>
 </section>;
}
