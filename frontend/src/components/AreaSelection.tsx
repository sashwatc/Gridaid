import {useEffect,useRef,useState} from 'react';
import {divIcon,type LatLng} from 'leaflet';
import {Marker,Rectangle,useMap,useMapEvents} from 'react-leaflet';
import {regionCities} from '../region';
import type {Bounds,Study} from '../types';

type AreaProps={study:Study;bounds:Bounds|null;cityIds:string[];onChange:(bounds:Bounds|null,cities:string[])=>void;drawing:boolean;setDrawing:(value:boolean)=>void};
export function AreaChooser({study,bounds,cityIds,onChange,drawing,setDrawing}:AreaProps){
 const cities=regionCities(study);
 return <div className="area-chooser"><div className="area-actions"><label><span className="area-label-text">Cities</span><select aria-label="Add a city" value="" onChange={e=>{if(e.target.value){onChange(null,[...cityIds,e.target.value]);setDrawing(false);}}}><option value="">Add a city…</option>{cities.filter(c=>!cityIds.includes(c.id)).map(c=><option key={c.id} value={c.id}>{c.name}, {c.state}</option>)}</select></label><button className={drawing?'area-active':''} aria-label={drawing?'Cancel selection':'Draw an area'} aria-pressed={drawing} onClick={()=>setDrawing(!drawing)}>{drawing?'Cancel':'Draw area'}</button><button aria-label="Whole Quad Cities" onClick={()=>{onChange(null,[]);setDrawing(false);}}>Reset area</button></div>
  <div className="chosen-cities">{cityIds.map(id=>{const city=cities.find(c=>c.id===id)!;return <button key={id} aria-label={`Remove ${city.name}`} onClick={()=>onChange(null,cityIds.filter(c=>c!==id))}>{city.name} <span aria-hidden="true">×</span></button>;})}{bounds&&<span>Custom area · drag the center to move it or the corners to resize.</span>}</div>
  {drawing&&<p role="status">Drag a box on the map, or tap two opposite corners. Escape cancels.</p>}
 </div>;
}

const handle=divIcon({className:'area-corner',html:'',iconSize:[16,16],iconAnchor:[8,8]});
const moveHandle=divIcon({className:'area-move',html:'↔',iconSize:[30,30],iconAnchor:[15,15]});

export function AreaDrawing({study,bounds,onChange,drawing,setDrawing}:AreaProps){
 const map=useMap();
 const region=study.dataset.provenance.study_bbox_south_west_north_east as Bounds;
 const start=useRef<LatLng|null>(null),firstTap=useRef<LatLng|null>(null),ignoreClick=useRef(false);
 const [preview,setPreview]=useState<Bounds|null>(null);
 const clamp=(p:LatLng)=>({lat:Math.max(region[0],Math.min(region[2],p.lat)),lng:Math.max(region[1],Math.min(region[3],p.lng))});
 function rectangle(a:LatLng,b:LatLng):Bounds{const x=clamp(a),y=clamp(b);return [Math.min(x.lat,y.lat),Math.min(x.lng,y.lng),Math.max(x.lat,y.lat),Math.max(x.lng,y.lng)];}
 function commit(value:Bounds){if(value[2]-value[0]>.0001&&value[3]-value[1]>.0001){onChange(value,[]);setDrawing(false);setPreview(null);firstTap.current=null;}}
 function end(point:LatLng){
  if(!drawing||!start.current)return;
  const a=start.current;start.current=null;
  if(map.latLngToContainerPoint(a).distanceTo(map.latLngToContainerPoint(point))>8){ignoreClick.current=true;commit(rectangle(a,point));}
 }
 useMapEvents({
  mousedown:e=>{if(drawing)start.current=e.latlng;},
  mousemove:e=>{if(drawing){const anchor=start.current??firstTap.current;if(anchor)setPreview(rectangle(anchor,e.latlng));}},
  mouseup:e=>end(e.latlng),
  click:e=>{if(!drawing)return;if(ignoreClick.current){ignoreClick.current=false;return;}if(firstTap.current){commit(rectangle(firstTap.current,e.latlng));}else{firstTap.current=e.latlng;}},
 });
 useEffect(()=>{
  if(!drawing){start.current=null;firstTap.current=null;setPreview(null);return;}
  ignoreClick.current=false;
  const wasDragging=map.dragging.enabled(),wasDouble=map.doubleClickZoom.enabled();
  map.dragging.disable();map.doubleClickZoom.disable();map.getContainer().classList.add('drawing-area');
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape')setDrawing(false);};
  const up=(event:MouseEvent)=>end(map.mouseEventToLatLng(event));
  window.addEventListener('keydown',key);window.addEventListener('mouseup',up);
  return()=>{if(wasDragging)map.dragging.enable();if(wasDouble)map.doubleClickZoom.enable();map.getContainer().classList.remove('drawing-area');window.removeEventListener('keydown',key);window.removeEventListener('mouseup',up);};
 },[drawing,map]);
 if(drawing)return preview?<Rectangle bounds={[[preview[0],preview[1]],[preview[2],preview[3]]]} interactive={false} pathOptions={{color:'#ffe090',weight:3,fillOpacity:.15}}/>:null;
 if(!bounds)return null;
 const corners:[[number,number],[number,number],[number,number],[number,number]]=[[bounds[0],bounds[1]],[bounds[0],bounds[3]],[bounds[2],bounds[3]],[bounds[2],bounds[1]]];
 const opposite=[2,3,0,1];
 return <><Rectangle bounds={[[bounds[0],bounds[1]],[bounds[2],bounds[3]]]} interactive={false} pathOptions={{color:'#ffe090',weight:3,fillOpacity:.05}}/>{corners.map((point,i)=><Marker key={i} position={point} icon={handle} draggable title={`Resize area corner ${i+1}`} eventHandlers={{dragend:e=>{const value=e.target.getLatLng() as LatLng;const other=map.containerPointToLatLng(map.latLngToContainerPoint(corners[opposite[i]]));commit(rectangle(value,other));}}}/>)}<Marker icon={moveHandle} position={[(bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2]} draggable title="Move selected area" eventHandlers={{dragend:e=>{const p=e.target.getLatLng() as LatLng;const height=bounds[2]-bounds[0],width=bounds[3]-bounds[1];const s=Math.max(region[0],Math.min(region[2]-height,p.lat-height/2)),w=Math.max(region[1],Math.min(region[3]-width,p.lng-width/2));onChange([s,w,s+height,w+width],[]);}}}/></>;
}
