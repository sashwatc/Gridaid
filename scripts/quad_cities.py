"""Build a dated, offline Quad Cities road/population/facility snapshot.

Uses hash-checked Geofabrik extracts for both states and official 2020 Census
tracts/places. No online fetching is exposed through the application API.
"""
from collections import defaultdict
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import re

import networkx as nx
import numpy as np
import osmium
from pyproj import Transformer
from scipy.spatial import cKDTree
from shapely.geometry import Point, shape

from backend.services.data import Dataset, digest
from backend.services.external import fetch_bytes
from backend.services.geography import attach_points
from scripts.ingest import acquire, parse_osm, simplify_roads

BBOX=(41.42,-90.73,41.65,-90.34)
CITIES={'Davenport city','Bettendorf city','Rock Island city','Moline city','East Moline city'}
ROAD=r'(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service)(_link)?'


def build():
    nodes={};ways={};facilities={};sources=[]
    south,west,north,east=BBOX
    def inside(lat,lon):return south<=lat<=north and west<=lon<=east
    class Crop(osmium.SimpleHandler):
        def node(self,node):
            tags=dict(node.tags)
            if tags.get('amenity') in ('fire_station','hospital','police') and inside(node.location.lat,node.location.lon):
                facilities[f'node/{node.id}']=(tags,node.location.lat,node.location.lon)
        def way(self,way):
            tags=dict(way.tags)
            if not re.fullmatch(ROAD,tags.get('highway','')) and tags.get('amenity') not in ('fire_station','hospital','police'):return
            points=[(str(n.ref),n.lon,n.lat) for n in way.nodes]
            if not points or not any(inside(lat,lon) for _,lon,lat in points):return
            if re.fullmatch(ROAD,tags.get('highway','')):
                for node,lon,lat in points:nodes[node]={'type':'node','id':node,'lon':lon,'lat':lat}
                value={'type':'way','id':str(way.id),'nodes':[p[0] for p in points],'tags':tags}
                if str(way.id) in ways and ways[str(way.id)]!=value:raise ValueError('Border road differs between dated extracts')
                ways[str(way.id)]=value
            if tags.get('amenity') in ('fire_station','hospital','police'):
                # An OSM building's representative point, never a fabricated facility.
                from shapely.geometry import Polygon
                coords=[(p[1],p[2]) for p in points]
                if len(coords)>=4 and coords[0]==coords[-1]:
                    polygon=Polygon(coords)
                    if not polygon.is_valid:return
                    point=polygon.representative_point();lat,lon=point.y,point.x
                else:lat,lon=points[0][2],points[0][1]
                if inside(lat,lon):facilities[f'way/{way.id}']=(tags,lat,lon)
    for state in ('iowa','illinois'):
        path=Path(f'data/raw/{state}-261023.osm.pbf')
        meta_path=Path(f'data/raw/quad_{state}_pbf.meta.json')
        if not path.exists() or not meta_path.exists():
            path.parent.mkdir(parents=True,exist_ok=True)
            url=f'https://download.geofabrik.de/north-america/us/{state}-261023.osm.pbf'
            raw=fetch_bytes(url,timeout=90,max_bytes=160_000_000 if state=='iowa' else 400_000_000)
            path.write_bytes(raw)
            meta_path.write_text(json.dumps({'url':url,'source_date':'2026-10-23','retrieved_at':datetime.now(timezone.utc).isoformat(),'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'license':'OpenStreetMap contributors, ODbL 1.0; extract by Geofabrik'},indent=2))
        meta=json.loads(meta_path.read_text())
        with path.open('rb') as stream:
            if hashlib.file_digest(stream,'sha256').hexdigest()!=meta['sha256']:raise ValueError('Raw PBF hash mismatch')
        print('Parsing',state,flush=True)
        Crop().apply_file(str(path),locations=True,idx='flex_mem',filters=[osmium.filter.KeyFilter('highway','amenity')])
        sources.append(meta)
    road_nodes,edges,skipped=parse_osm({'elements':[*nodes.values(),*ways.values()]})
    unsimplified={'nodes':len(road_nodes),'edges':len(edges)}
    road_nodes,edges=simplify_roads(road_nodes,edges)
    print('Simplified roads',len(road_nodes),len(edges),flush=True)
    census,census_meta=acquire('quad_cities_census2020','https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/6/query',params={'where':"(STATE='19' AND COUNTY='163') OR (STATE='17' AND COUNTY='161')",'outFields':'GEOID,POP100,INTPTLAT,INTPTLON','outSR':'4326','f':'geojson','returnGeometry':'true'})
    places,places_meta=acquire('quad_cities_places2020','https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/26/query',params={'where':"STATE IN ('19','17')",'geometry':f'{west},{south},{east},{north}','geometryType':'esriGeometryEnvelope','inSR':'4326','outSR':'4326','spatialRel':'esriSpatialRelIntersects','outFields':'*','f':'geojson','returnGeometry':'true'})
    sources.extend([census_meta,places_meta])
    city_geoms=[(f['properties']['NAME'],shape(f['geometry'])) for f in places['features']]
    def community(lat,lon):
        return next((name for name,geom in city_geoms if geom.covers(Point(lon,lat))),'Unincorporated study area')
    project=Transformer.from_crs(4326,26915,always_xy=True)
    xy=np.array([project.transform(n['lon'],n['lat']) for n in road_nodes]);tree=cKDTree(xy)
    demands=[]
    for feature in census['features']:
        a=feature['properties'];lat,lon=float(a['INTPTLAT']),float(a['INTPTLON'])
        if not inside(lat,lon):continue
        distance,index=tree.query(project.transform(lon,lat))
        if distance>2000:raise ValueError(f"Census point too far from roads: {a['GEOID']}")
        demands.append({'id':a['GEOID'],'node':road_nodes[index]['id'],'population':float(a['POP100']),'snap_m':float(distance)})
    graph=nx.DiGraph();graph.add_edges_from((e['u'],e['v']) for e in edges)
    connected=max(nx.strongly_connected_components(graph),key=len)
    mapped=[];used_nodes=set()
    for osm_id,(tags,lat,lon) in sorted(facilities.items()):
        name=community(lat,lon)
        if name not in CITIES:continue
        distance,index=tree.query(project.transform(lon,lat));node=road_nodes[index]['id']
        if distance>2000 or node in used_nodes:continue
        used_nodes.add(node)
        mapped.append({'id':'OSM-'+osm_id.replace('/','-'),'node':node,'label':tags.get('name') or tags.get('operator') or tags['amenity'].replace('_',' ').title(),'lat':lat,'lon':lon,'snap_m':float(distance),'kind':tags['amenity'],'community':name,'source_url':'https://www.openstreetmap.org/'+osm_id,'eligible':node in connected})
    eligible=[f for f in mapped if f['eligible']]
    if len(eligible)<15:raise ValueError('Too few mapped facilities for a regional comparison')
    # Keep every mapped location for point lookup; use up to 32 dispersed
    # connected facilities as placement candidates, independent of population.
    selected=[]
    for name in sorted(CITIES):
        group=[f for f in eligible if f['community']==name]
        if not group:raise ValueError('Missing connected mapped facility in '+name)
        selected.append(group[0])
    while len(selected)<min(32,len(eligible)):
        remaining=[f for f in eligible if f not in selected]
        chosen=max(remaining,key=lambda f:min(np.linalg.norm(np.array(project.transform(f['lon'],f['lat']))-np.array(project.transform(g['lon'],g['lat']))) for g in selected))
        selected.append(chosen)
    candidates=[{k:f[k] for k in ('id','node','label','snap_m','community')} for f in selected]
    cities=[]
    for feature in places['features']:
        a=feature['properties']
        if a['NAME'] not in CITIES:continue
        geom=shape(feature['geometry']);w,s,e,n=geom.bounds;p=geom.representative_point()
        cities.append({'id':a['GEOID'],'name':a['NAME'].removesuffix(' city'),'community':a['NAME'],'state':'IA' if a['STATE']=='19' else 'IL','center':[p.y,p.x],'bounds':[max(s,south),max(w,west),min(n,north),min(e,east)],'geometry':feature['geometry']})
    if len(cities)!=5:raise ValueError('The five Quad Cities were not all found')
    provenance={'kind':'public_roads_census_mapped_facilities','sources':sources,'study_bbox_south_west_north_east':BBOX,'population':'2020 Decennial Census POP100 at original tract internal points; whole tract weights, not households','roads_date':'2026-10-23','cities':sorted(cities,key=lambda c:c['name']),'facilities':mapped,'candidate_rule':'Up to 32 dispersed connected OSM fire stations, hospitals and police stations; at least one per core city; not evidence of available resources','license':'Roads/facilities © OpenStreetMap contributors, ODbL 1.0; Census public domain','assumptions':'OSM speed tags or class defaults; no live traffic, turn restrictions, dispatch or facility-availability verification; access connectors are assumed straight paths','unsimplified_counts':unsimplified,'skipped_zero_length_edges':skipped,'created_at':datetime.now(timezone.utc).isoformat()}
    data=Dataset.model_validate({'id':'quad_cities','name':'Quad Cities · Iowa and Illinois','version':'','nodes':road_nodes,'edges':edges,'demands':demands,'candidates':candidates,'provenance':provenance})
    data,report=attach_points(data,census,places,unincorporated='Unincorporated Quad Cities study area')
    origins={f['id']:f for f in mapped}
    data=data.model_copy(update={'candidates':[c.model_copy(update={'community':origins[c.id]['community']}) for c in data.candidates]})
    data=data.model_copy(update={'version':digest(data.model_dump(exclude={'version'}))[:20]})
    Dataset.model_validate(data.model_dump())
    Path('data/public/quad_cities.json.gz').write_bytes(gzip.compress(data.model_dump_json().encode(),mtime=0))
    Path('docs/quad_cities_manifest.json').write_text(json.dumps({'version':data.version,'quality':data.quality(),'cities':[{k:v for k,v in c.items() if k!='geometry'} for c in cities],'mapped_facilities':len(mapped),'sources':sources,'assumptions':provenance['assumptions']},indent=2)+'\n')
    print(data.version,data.quality(),'facilities',len(mapped),flush=True)


if __name__=='__main__':build()
