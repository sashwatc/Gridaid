import {useEffect,useMemo,useRef,useState} from 'react';
import {CircleMarker,GeoJSON,MapContainer,Pane,Polyline,Rectangle,ScaleControl,TileLayer,Tooltip,useMap,useMapEvents} from 'react-leaflet';
import {DomEvent} from 'leaflet';
import type {Bounds,MapPoint,PointRoute,Run,Study} from '../types';
import {mappedFacilities,regionCities,scopedPoints} from '../region';
import {AreaChooser,AreaDrawing} from './AreaSelection';
import {CalculationLines} from './CalculationLines';

type Props={study:Study;run?:Run;active:string;selected:string|null;onSelect:(id:string)=>void;focusBounds:Bounds|null;cityIds:string[];onAreaChange:(bounds:Bounds|null,ids:string[])=>void;onPoint:(point:MapPoint)=>void;checkedPoint:MapPoint|null;pointRoute?:PointRoute;pointStatus:string;calculating:boolean};
const imagery='https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const attribution='Imagery © <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9">Esri</a>, Vantor, Earthstar Geographics, GIS User Community';

function MapControls({study,selected,focusBounds,cityIds}:{study:Study;selected:string|null;focusBounds:Bounds|null;cityIds:string[]}){
 const map=useMap();
 const controls=useRef<HTMLDivElement|null>(null);
 const box=study.dataset.provenance.study_bbox_south_west_north_east as number[];
 function fit(){map.fitBounds([[box[0],box[1]],[box[2],box[3]]],{padding:[22,22],animate:false});}
 useEffect(()=>{
  const cities=regionCities(study).filter(c=>cityIds.includes(c.id));
  const target=focusBounds??(cities.length?[Math.min(...cities.map(c=>c.bounds[0])),Math.min(...cities.map(c=>c.bounds[1])),Math.max(...cities.map(c=>c.bounds[2])),Math.max(...cities.map(c=>c.bounds[3]))]:box);
  map.fitBounds([[target[0],target[1]],[target[2],target[3]]],{padding:[22,22],animate:false});
 },[study,map,focusBounds,cityIds]);
 useEffect(()=>{if(controls.current){DomEvent.disableClickPropagation(controls.current);DomEvent.disableScrollPropagation(controls.current);}},[]);
 useEffect(()=>{
  const site=study.dataset.candidates.find(c=>c.id===selected);
  const node=study.dataset.nodes.find(n=>n.id===site?.node);
  const facility=mappedFacilities(study).find(f=>f.id===selected);
  if(node)map.setView([facility?.lat??node.lat,facility?.lon??node.lon],Math.max(map.getZoom(),13),{animate:false});
 },[selected,study,map]);
 return <div ref={controls} className="map-tools"><span className="north-arrow" aria-label="North is up">↑ N</span><button onClick={fit}>Show whole area</button></div>;
}

function PointClicks({onPoint}:{onPoint:(point:MapPoint)=>void}){useMapEvents({click:e=>onPoint({lat:e.latlng.lat,lon:e.latlng.lng})});return null;}

export function SatelliteMap({study,run,active,selected,onSelect,focusBounds,cityIds,onAreaChange,onPoint,checkedPoint,pointRoute,pointStatus,calculating}:Props){
 const [drawing,setDrawing]=useState(false);
 const suppressClick=useRef(0);
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
 const cities=regionCities(study),facilities=new Map(mappedFacilities(study).map(f=>[f.id,f]));
 const area=scopedPoints(study,focusBounds,cityIds);
 function commitArea(bounds:Bounds|null,ids:string[]){suppressClick.current=bounds?performance.now()+500:0;onAreaChange(bounds,ids);}
 function check(point:MapPoint){if(!drawing&&performance.now()>suppressClick.current)onPoint(point);}
 function retry(){errors.current=0;setTileReady(false);setUnavailable(false);setAttempt(x=>x+1);setMode('satellite');}
 return <section className="citizen-map" aria-label="Plan map">
  <div className="citizen-map-heading"><div><h2>Your community, on the map</h2><p>Quad Cities · Iowa & Illinois</p></div><div className="map-view-buttons" role="group" aria-label="Map background"><button aria-pressed={satellite} onClick={retry}>Satellite</button><button aria-pressed={!satellite} onClick={()=>setMode('roads')}>Road map</button></div></div>
  <AreaChooser study={study} bounds={focusBounds} cityIds={cityIds} onChange={commitArea} drawing={drawing} setDrawing={setDrawing}/>
  <p className="area-preview" data-testid="area-preview">{area.demands.length} census points · {area.population.toLocaleString()} people represented (2020) · {area.candidates.length} eligible locations</p>
  {unavailable&&mode==='satellite'&&<div className="imagery-notice" role="status">Satellite imagery is unavailable. Your plan still works on the road map. <button onClick={retry}>Retry satellite</button></div>}
  <div className={`citizen-map-surface ${satellite?'satellite':'road-map'} ${calculating?'map-calculating':''}`}><MapContainer className="citizen-leaflet" center={[41.565,-90.59]} zoom={12} preferCanvas zoomAnimation={false} scrollWheelZoom={false}>
   <MapControls study={study} selected={selected} focusBounds={focusBounds} cityIds={cityIds}/><PointClicks onPoint={check}/><AreaDrawing study={study} bounds={focusBounds} cityIds={cityIds} onChange={commitArea} drawing={drawing} setDrawing={setDrawing}/><ScaleControl imperial={true} metric={false} position="bottomleft"/>
   {satellite&&<TileLayer key={attempt} url={imagery} maxZoom={19} attribution={attribution} eventHandlers={{tileload:()=>setTileReady(true),tileerror:()=>{errors.current++;if(errors.current>=3)setUnavailable(true);}}}/>}
   {!satellite&&<Polyline positions={roadPaths} pathOptions={{color:'#8ba4ad',weight:1.6,opacity:.65}}/>}
   <Rectangle bounds={[[box[0],box[1]],[box[2],box[3]]]} pathOptions={{color:satellite?'#fff':'#3d6673',weight:2,dashArray:'6 6',fill:false}}/>
   {cityIds.length>0&&<GeoJSON key={cityIds.join(',')} data={{type:'FeatureCollection',features:cities.filter(c=>cityIds.includes(c.id)).map(c=>({type:'Feature',properties:{name:c.name},geometry:c.geometry}))} as import('geojson').FeatureCollection} style={{color:'#ffe090',weight:2,fillOpacity:.04}} interactive={false}/>}
   {closurePaths.length>0&&<Polyline positions={closurePaths} pathOptions={{color:'#ff6b55',weight:5}}/>}
   {coverage&&area.demands.map(d=>{
    const node=nodes.get(d.node)!;const a=access.get(d.id);
    const color=a?(a.covered?'#20d4a0':'#ffbb60'):'#9ed9ed';
    return <CircleMarker key={d.id} center={[d.origin_lat??node.lat,d.origin_lon??node.lon]} radius={6} bubblingMouseEvents={false} eventHandlers={{click:()=>check({lat:d.origin_lat??node.lat,lon:d.origin_lon??node.lon})}} pathOptions={{color:satellite?'white':'#365564',weight:1,fillColor:color,fillOpacity:.9}}><Tooltip>{d.community??'Study point'} · {d.population.toLocaleString()} people represented<br/>{a?(a.covered?'Within your travel target':a.time_s===null?'No route from these locations':'Beyond your travel target'):'Population representative point'}<br/>Click for nearest location and travel time</Tooltip></CircleMarker>;
   })}
   <Pane name="citizen-place-labels" style={{zIndex:450,pointerEvents:'none'}}>{cities.map(p=><CircleMarker key={p.id} center={p.center} radius={0} pathOptions={{stroke:false,fill:false}} interactive={false}><Tooltip permanent direction="center" pane="citizen-place-labels" className="citizen-place-label">{p.name}</Tooltip></CircleMarker>)}</Pane>
   {run?.selected_site_ids.map((id,i)=>{
    const candidate=study.dataset.candidates.find(c=>c.id===id)!;const n=nodes.get(candidate.node)!;
    const f=facilities.get(id);
    return <CircleMarker key={id} center={[f?.lat??n.lat,f?.lon??n.lon]} bubblingMouseEvents={false} radius={selected===id?19:16} pathOptions={{color:'white',weight:3,fillColor:'#086c58',fillOpacity:1}} eventHandlers={{click:()=>{if(!drawing){onSelect(id);check({lat:f?.lat??n.lat,lon:f?.lon??n.lon});}}}}><Tooltip permanent direction="center" className="site-number">{i+1}</Tooltip></CircleMarker>;
   })}
   {pointRoute&&<><Polyline positions={pointRoute.road_path.map(p=>[p[1],p[0]])} pathOptions={{color:'#358cff',weight:6,opacity:.95}} interactive={false}/>{pointRoute.access_paths.map((path,i)=><Polyline key={i} positions={path.map(p=>[p[1],p[0]])} pathOptions={{color:'#d3e7ff',weight:3,dashArray:'5 5'}} interactive={false}/>)}</>}
   {checkedPoint&&<CircleMarker center={[checkedPoint.lat,checkedPoint.lon]} radius={9} pathOptions={{color:'white',weight:3,fillColor:'#358cff',fillOpacity:1}} interactive={false}><Tooltip permanent direction="top" className="point-map-summary">{pointRoute?`${(pointRoute.time_s/60).toFixed(1)} min · ${pointRoute.label}`:pointStatus||'Checked point'}</Tooltip></CircleMarker>}
   {calculating&&<CalculationLines study={study} bounds={focusBounds} cityIds={cityIds}/>}
  </MapContainer>{calculating&&<div className="map-activity-badge" data-testid="map-activity" title="Illustrative activity on saved roads, not a live solver trace"><span/> Analyzing mapped roads</div>}</div>
  <div className="citizen-map-legend"><span><i className="legend-location"/> Suggested location</span>{run&&<><span><i style={{background:'#20d4a0'}}/> Within target</span><span><i style={{background:'#ffbb60'}}/> Outside target</span></>}<label><input type="checkbox" checked={coverage} onChange={e=>setCoverage(e.target.checked)}/> Show {run?'coverage':'population'}</label></div>
  <p className="map-footnote">White dashed boundary: supported region. Dots represent whole census tracts, not individual homes. Blue: modeled road route; dashed blue: assumed access. Satellite images are not live conditions.</p>
 </section>;
}
