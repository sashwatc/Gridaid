import {useEffect,useMemo,useRef,useState} from 'react';
import {CircleMarker,MapContainer,Pane,Polyline,Rectangle,ScaleControl,TileLayer,Tooltip,useMap} from 'react-leaflet';
import type {Run,Study} from '../types';

type Props={study:Study;run?:Run;active:string;selected:string|null;onSelect:(id:string)=>void};
const imagery='https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const attribution='Imagery © <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9">Esri</a>, Vantor, Earthstar Geographics, GIS User Community';

function MapControls({study,selected}:{study:Study;selected:string|null}){
 const map=useMap();
 const box=study.dataset.provenance.study_bbox_south_west_north_east as number[];
 function fit(){map.fitBounds([[box[0],box[1]],[box[2],box[3]]],{padding:[22,22],animate:false});}
 useEffect(fit,[study,map]);
 useEffect(()=>{
  const site=study.dataset.candidates.find(c=>c.id===selected);
  const node=study.dataset.nodes.find(n=>n.id===site?.node);
  if(node)map.setView([node.lat,node.lon],Math.max(map.getZoom(),13),{animate:false});
 },[selected,study,map]);
 return <div className="map-tools"><span className="north-arrow" aria-label="North is up">↑ N</span><button onClick={fit}>Show whole area</button></div>;
}

export function SatelliteMap({study,run,active,selected,onSelect}:Props){
 const [mode,setMode]=useState<'satellite'|'roads'>('satellite');
 const [unavailable,setUnavailable]=useState(false),[tileReady,setTileReady]=useState(false),[attempt,setAttempt]=useState(0);
 const [coverage,setCoverage]=useState(true);
 const errors=useRef(0);
 const satellite=mode==='satellite'&&!unavailable;
 useEffect(()=>{
  if(!satellite||tileReady)return;
  const timer=window.setTimeout(()=>setUnavailable(true),12000);
  return()=>window.clearTimeout(timer);
 },[satellite,tileReady,attempt]);
 const nodes=useMemo(()=>new Map(study.dataset.nodes.map(n=>[n.id,n])),[study]);
 const roadPaths=useMemo(()=>satellite?[]:study.dataset.edges.map(e=>e.geometry.length?e.geometry.map(p=>[p[1],p[0]] as [number,number]):[nodes.get(e.u)!,nodes.get(e.v)!].map(n=>[n.lat,n.lon] as [number,number])),[study,nodes,satellite]);
 const access=new Map(run?.demand_access[active]?.map(d=>[d.demand_id,d])??[]);
 const scenario=study.scenarios.find(s=>s.id===active);
 const closed=new Set(scenario?.closed_edge_ids??[]);
 const closurePaths=useMemo(()=>study.dataset.edges.filter(e=>closed.has(e.id)).map(e=>e.geometry.map(p=>[p[1],p[0]] as [number,number])),[study,active]);
 const box=study.dataset.provenance.study_bbox_south_west_north_east as number[];
 const labels=useMemo(()=>{
  const groups=new Map<string,{lat:number;lon:number}[]>();
  for(const c of study.dataset.candidates){const n=nodes.get(c.node);if(n&&c.community?.endsWith(' city'))groups.set(c.community,[...(groups.get(c.community)??[]),n]);}
  return [...groups].map(([name,points])=>({name:name.replace(' city',''),lat:points.reduce((sum,p)=>sum+p.lat,0)/points.length,lon:points.reduce((sum,p)=>sum+p.lon,0)/points.length}));
 },[study,nodes]);
 function retry(){errors.current=0;setTileReady(false);setUnavailable(false);setAttempt(x=>x+1);setMode('satellite');}
 return <section className="citizen-map" aria-label="Plan map">
  <div className="citizen-map-heading"><div><h2>Your community, on the map</h2><p>Davenport & Bettendorf, Iowa</p></div><div className="map-view-buttons" role="group" aria-label="Map background"><button aria-pressed={satellite} onClick={retry}>Satellite</button><button aria-pressed={!satellite} onClick={()=>setMode('roads')}>Road map</button></div></div>
  {unavailable&&mode==='satellite'&&<div className="imagery-notice" role="status">Satellite imagery is unavailable. Your plan still works on the road map. <button onClick={retry}>Retry satellite</button></div>}
  <div className={`citizen-map-surface ${satellite?'satellite':'road-map'}`}><MapContainer className="citizen-leaflet" center={[41.565,-90.59]} zoom={12} preferCanvas zoomAnimation={false} scrollWheelZoom={false}>
   <MapControls study={study} selected={selected}/><ScaleControl imperial={false} position="bottomleft"/>
   {satellite&&<TileLayer key={attempt} url={imagery} maxZoom={19} attribution={attribution} eventHandlers={{tileload:()=>setTileReady(true),tileerror:()=>{errors.current++;if(errors.current>=3)setUnavailable(true);}}}/>}
   {!satellite&&<Polyline positions={roadPaths} pathOptions={{color:'#8ba4ad',weight:1.6,opacity:.65}}/>}
   <Rectangle bounds={[[box[0],box[1]],[box[2],box[3]]]} pathOptions={{color:satellite?'#fff':'#3d6673',weight:2,dashArray:'6 6',fill:false}}/>
   {closurePaths.length>0&&<Polyline positions={closurePaths} pathOptions={{color:'#ff6b55',weight:5}}/>}
   {coverage&&study.dataset.demands.map(d=>{
    const node=nodes.get(d.node)!;const a=access.get(d.id);
    const color=a?(a.covered?'#20d4a0':'#ffbb60'):'#9ed9ed';
    return <CircleMarker key={d.id} center={[d.origin_lat??node.lat,d.origin_lon??node.lon]} radius={6} pathOptions={{color:satellite?'white':'#365564',weight:1,fillColor:color,fillOpacity:.9}}><Tooltip>{d.community??'Study point'} · {d.population.toLocaleString()} people represented<br/>{a?(a.covered?'Within your travel target':a.time_s===null?'No route from these locations':'Beyond your travel target'):'Population representative point'}</Tooltip></CircleMarker>;
   })}
   <Pane name="citizen-place-labels" style={{zIndex:450,pointerEvents:'none'}}>{labels.map(p=><CircleMarker key={p.name} center={[p.lat,p.lon]} radius={0} pathOptions={{stroke:false,fill:false}} interactive={false}><Tooltip permanent direction="center" pane="citizen-place-labels" className="citizen-place-label">{p.name}</Tooltip></CircleMarker>)}</Pane>
   {run?.selected_site_ids.map((id,i)=>{
    const candidate=study.dataset.candidates.find(c=>c.id===id)!;const n=nodes.get(candidate.node)!;
    return <CircleMarker key={id} center={[n.lat,n.lon]} radius={selected===id?19:16} pathOptions={{color:'white',weight:3,fillColor:'#086c58',fillOpacity:1}} eventHandlers={{click:()=>onSelect(id)}}><Tooltip permanent direction="center" className="site-number">{i+1}</Tooltip></CircleMarker>;
   })}
  </MapContainer></div>
  <div className="citizen-map-legend"><span><i className="legend-location"/> Suggested location</span>{run&&<><span><i style={{background:'#20d4a0'}}/> Within target</span><span><i style={{background:'#ffbb60'}}/> Outside target</span></>}<label><input type="checkbox" checked={coverage} onChange={e=>setCoverage(e.target.checked)}/> Show {run?'coverage':'population'}</label></div>
  <p className="map-footnote">Dashed line: study area. Dots represent whole census tracts, not individual homes. Satellite images are background imagery, not live conditions.</p>
 </section>;
}
