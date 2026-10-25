"""Bounded, replayable Davenport public-data build. Cached raw inputs are hash checked."""
from datetime import datetime,timezone
import argparse
import json
from pathlib import Path
import re
import geopandas as gpd
import numpy as np
from pyproj import Geod,Transformer
from scipy.spatial import cKDTree
from shapely.geometry import Point,box
from backend.services.external import fetch_bytes
from backend.services.data import Dataset,digest

RAW=Path('data/raw');OUT=Path('data/processed')
BBOX=(41.50,-90.70,41.63,-90.48) # south west north east; Davenport study crop


def acquire(name,url,params=None,body=None,refresh=False):
    RAW.mkdir(parents=True,exist_ok=True)
    path=RAW/(name+'.json');meta=RAW/(name+'.meta.json')
    if path.exists() and not refresh:
        raw=path.read_bytes();metadata=json.loads(meta.read_text())
        import hashlib
        if hashlib.sha256(raw).hexdigest()!=metadata['sha256']:raise ValueError('raw snapshot hash mismatch')
        return json.loads(raw),metadata
    raw=fetch_bytes(url,params=params,body=body)
    parsed=json.loads(raw)
    if isinstance(parsed,dict) and parsed.get('error'):raise ValueError(str(parsed['error']))
    import hashlib
    metadata={'url':url,'params':params,'body':body,'retrieved_at':datetime.now(timezone.utc).isoformat(),
              'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)}
    path.write_bytes(raw);meta.write_text(json.dumps(metadata,indent=2))
    return parsed,metadata


def parse_speed(tags):
    raw=tags.get('maxspeed','')
    match=re.fullmatch(r'(\d+(?:\.\d+)?)\s*(mph|km/h|kph)?',raw)
    if match:
        speed=float(match[1])*(1.609344 if match[2]=='mph' else 1)
        if 1<=speed<=160:return speed,'osm_maxspeed'
    defaults={'motorway':90,'trunk':80,'primary':60,'secondary':50,'tertiary':40,'residential':30,'living_street':15,'service':20,'unclassified':35}
    return defaults.get(tags.get('highway'),30),'modeled_assumption'


def parse_osm(osm):
    geod=Geod(ellps='WGS84')
    nodes={str(n['id']):{'id':str(n['id']),'lat':n['lat'],'lon':n['lon']} for n in osm['elements'] if n['type']=='node'}
    edges=[];seen=set();skipped=0
    for way in osm['elements']:
        if way['type']!='way':continue
        tags=way.get('tags',{})
        if tags.get('access') in ('private','no') or tags.get('motor_vehicle')=='no':continue
        speed,speed_source=parse_speed(tags)
        oneway=tags.get('oneway')
        if oneway not in (None,'yes','no','1','0','true','false','-1'):
            raise ValueError(f'Unsupported conditional/reversible road direction: {oneway}')
        reverse=oneway=='-1'
        directed=oneway in ('yes','1','true','-1') or (oneway not in ('no','0','false') and (tags.get('junction')=='roundabout' or tags.get('highway')=='motorway'))
        refs=list(map(str,way['nodes']))
        if reverse:refs.reverse()
        for part,(u,v) in enumerate(zip(refs,refs[1:])):
            if u not in nodes or v not in nodes:raise ValueError('missing OSM endpoint')
            a,b=nodes[u],nodes[v]
            length=geod.inv(a['lon'],a['lat'],b['lon'],b['lat'])[2]
            if length<=0:skipped+=1;continue
            for start,end in ([(u,v)] if directed else [(u,v),(v,u)]):
                eid=f"{way['id']}:{part}:{start}>{end}"
                if eid in seen:raise ValueError('duplicate OSM edge')
                seen.add(eid)
                edges.append(dict(id=eid,u=start,v=end,length_m=length,speed_kph=speed,speed_source=speed_source,road_class=tags.get('highway','unknown'),
                                  geometry=[[nodes[start]['lon'],nodes[start]['lat']],[nodes[end]['lon'],nodes[end]['lat']]]))
    used={e[k] for e in edges for k in ('u','v')}
    return sorted((n for n in nodes.values() if n['id'] in used),key=lambda n:int(n['id'])),edges,skipped


def simplify_roads(nodes,edges):
    import networkx as nx
    import osmnx as ox
    from shapely.geometry import LineString
    graph=nx.MultiDiGraph(crs='EPSG:4326')
    graph.add_nodes_from((n['id'],{'x':n['lon'],'y':n['lat']}) for n in nodes)
    for e in edges:
        attrs={k:v for k,v in e.items() if k not in ('u','v','geometry')}
        attrs['geometry']=LineString(e['geometry'])
        graph.add_edge(e['u'],e['v'],**attrs)
    graph=ox.simplification.simplify_graph(graph,edge_attrs_differ=['road_class','speed_kph','speed_source'],remove_rings=False,edge_attr_aggs={'length_m':sum})
    reduced_nodes=[{'id':n,'lon':a['x'],'lat':a['y']} for n,a in graph.nodes(data=True)]
    reduced_edges=[]
    for u,v,k,a in graph.edges(keys=True,data=True):
        ids=a['id'] if isinstance(a['id'],list) else [a['id']]
        reduced_edges.append(dict(id=digest(sorted(ids))[:24],u=u,v=v,length_m=a['length_m'],speed_kph=a['speed_kph'],
                                  speed_source=a['speed_source'],road_class=a['road_class'],geometry=[list(p) for p in a['geometry'].coords]))
    return reduced_nodes,reduced_edges


def pbf_roads(refresh=False):
    import hashlib
    import osmium
    url='https://download.geofabrik.de/north-america/us/iowa-261023.osm.pbf'
    RAW.mkdir(parents=True,exist_ok=True)
    path=RAW/'iowa-261023.osm.pbf';meta=RAW/'iowa_pbf.meta.json'
    if not path.exists() or refresh:
        raw=fetch_bytes(url,max_bytes=160_000_000)
        metadata={'url':url,'retrieved_at':datetime.now(timezone.utc).isoformat(),'source_date':'2026-10-23',
                  'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'license':'ODbL 1.0; OpenStreetMap contributors; extract by Geofabrik'}
        path.write_bytes(raw);meta.write_text(json.dumps(metadata,indent=2))
    metadata=json.loads(meta.read_text())
    if hashlib.file_digest(path.open('rb'),'sha256').hexdigest()!=metadata['sha256']:raise ValueError('PBF snapshot hash mismatch')
    nodes={};ways=[];south,west,north,east=BBOX
    class Crop(osmium.SimpleHandler):
        def way(self,way):
            tags=dict(way.tags)
            if not re.fullmatch(r'(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service)(_link)?',tags.get('highway','')):return
            points=[(str(n.ref),n.lon,n.lat) for n in way.nodes]
            if not any(south<=lat<=north and west<=lon<=east for _,lon,lat in points):return
            for node,lon,lat in points:nodes[node]={'type':'node','id':node,'lon':lon,'lat':lat}
            ways.append({'type':'way','id':str(way.id),'nodes':[p[0] for p in points],'tags':tags})
    Crop().apply_file(str(path),locations=True,idx='flex_mem')
    return {'elements':[*nodes.values(),*ways]},metadata


def build(refresh=False,roads_source='geofabrik'):
    census,census_meta=acquire('census2020_scott','https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/6/query',
        params={'where':"STATE='19' AND COUNTY='163'",'outFields':'GEOID,POP100,INTPTLAT,INTPTLON','outSR':'4326','f':'geojson','returnGeometry':'true'},refresh=refresh)
    south,west,north,east=BBOX
    query=f'[out:json][timeout:35];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service)(_link)?$"]({south},{west},{north},{east});(._;>;);out body;'
    if roads_source=='overpass':
        osm,osm_meta=acquire('osm_davenport','https://overpass-api.de/api/interpreter',body={'data':query},refresh=refresh)
    else:
        osm,osm_meta=pbf_roads(refresh)
    nodes,edges,skipped=parse_osm(osm)
    unsimplified_counts={'nodes':len(nodes),'edges':len(edges)}
    nodes,edges=simplify_roads(nodes,edges)
    features=gpd.GeoDataFrame.from_features(census['features'],crs='EPSG:4326')
    if not features.geometry.is_valid.all() or features.GEOID.duplicated().any():raise ValueError('invalid or duplicate Census geometry')
    # 2020 Census internal points avoid invalid polygon centroids outside concave tracts.
    projected=Transformer.from_crs(4326,26915,always_xy=True)
    xy=np.array([projected.transform(n['lon'],n['lat']) for n in nodes]);tree=cKDTree(xy)
    demands=[];excluded=[]
    for row in features.itertuples():
        lat,lon=float(row.INTPTLAT),float(row.INTPTLON)
        if not(south<=lat<=north and west<=lon<=east):excluded.append(row.GEOID);continue
        distance,index=tree.query(projected.transform(lon,lat))
        if distance>2000:raise ValueError(f'excessive snap {row.GEOID}: {distance}')
        demands.append(dict(id=row.GEOID,node=nodes[index]['id'],population=float(row.POP100),snap_m=float(distance)))
    if not demands:raise ValueError('empty Census study crop')
    # Candidate grid chosen without population weights; all assumed resources, no facility claim.
    # Keep all disconnected demand, but propose sites on the largest strongly connected
    # road component within the study crop. Road geometry outside the crop is routing buffer.
    import networkx as nx
    graph=nx.DiGraph();graph.add_edges_from((e['u'],e['v']) for e in edges)
    component=max(nx.strongly_connected_components(graph),key=len)
    eligible=np.array([i for i,n in enumerate(nodes) if n['id'] in component and south<=n['lat']<=north and west<=n['lon']<=east],dtype=int)
    if len(eligible)<25:raise ValueError('not enough connected candidates in study crop')
    pool=xy[eligible];order=np.lexsort((pool[:,0],pool[:,1]));local=[int(order[len(order)//2])]
    distances=np.full(len(pool),np.inf)
    for _ in range(min(32,len(pool))-1):
        distances=np.minimum(distances,np.linalg.norm(pool-pool[local[-1]],axis=1));local.append(int(np.argmax(distances)))
    indices=eligible[local].tolist()
    candidates=[dict(id=f'C{i+1}',node=nodes[index]['id'],label=f'Assumed candidate {i+1}',snap_m=0) for i,index in enumerate(indices)]
    provenance={'kind':'public_roads_census_assumed_resources','sources':[osm_meta,census_meta],'crs':'EPSG:4326',
                'distance_crs':'WGS84 ellipsoid road lengths; EPSG:26915 (NAD83 UTM 15N) for snapping and candidate dispersion',
                'candidate_rule':'32 farthest-spread nodes on largest strongly connected component inside crop, independent of demand; disconnected demand is retained',
                'population':'2020 Decennial Census POP100, whole-tract population at official internal point; include tracts whose internal point is in crop',
                'study_bbox_south_west_north_east':BBOX,'excluded_tract_ids':excluded,'skipped_zero_length_edges':skipped,'unsimplified_counts':unsimplified_counts,'simplification':'OSMnx degree-two contraction; preserve direction, parallel edges, speed/class/source changes and rings; sum geodesic lengths',
                'license':'Roads © OpenStreetMap contributors, ODbL 1.0; Census U.S. public domain; resources and scenarios are synthetic assumptions',
                'assumptions':'Crop can truncate routes. No traffic, emergency-vehicle speed, dispatch delay, capacity or road turn restrictions. Speeds are OSM tags or explicit class defaults. This is not current population.'}
    data=dict(id='iowa',name='Davenport / Scott County public-data crop',version='',provenance=provenance,nodes=nodes,edges=edges,demands=demands,candidates=candidates)
    data['version']=digest(data)[:20];dataset=Dataset.model_validate(data)
    from scripts.geography_audit import prepare_geography
    dataset=prepare_geography(dataset)
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'iowa.json').write_text(dataset.model_dump_json())
    (OUT/'iowa_quality.json').write_text(json.dumps(dataset.quality(),indent=2))
    (OUT/'iowa_manifest.json').write_text(json.dumps(provenance,indent=2))
    gpd.GeoDataFrame([{'id':d.id,'population':d.population,'snap_m':d.snap_m,'geometry':Point(next(n['lon'] for n in nodes if n['id']==d.node),next(n['lat'] for n in nodes if n['id']==d.node))} for d in dataset.demands],crs=4326).to_parquet(OUT/'population_demand.parquet')
    print(json.dumps(dataset.quality(),indent=2))
    return dataset

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--refresh',action='store_true');parser.add_argument('--roads-source',choices=['geofabrik','overpass'],default='geofabrik');args=parser.parse_args()
    build(args.refresh,args.roads_source)
