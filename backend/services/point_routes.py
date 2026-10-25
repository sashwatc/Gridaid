"""Point-to-facility queries on saved directed roads, with explicit access legs."""
from heapq import heappop,heappush
from math import inf,isfinite

import geopandas as gpd
import numpy as np
from pyproj import Geod,Transformer
from shapely import STRtree
from shapely.geometry import LineString,Point

from backend.services.area import area_predicate
from backend.services.data import load_dataset
from backend.services.routing import adjacency
from backend.services.scenarios import Scenario,scenario_catalog


def attach_query(data,lat,lon):
    nodes={n.id:n for n in data.nodes};groups={}
    for edge in data.edges:
        coords=tuple(map(tuple,edge.geometry or [[nodes[edge.u].lon,nodes[edge.u].lat],[nodes[edge.v].lon,nodes[edge.v].lat]]))
        key=min(coords,coords[::-1]);groups.setdefault(key,[]).append(edge)
    keys=list(groups)
    lines=gpd.GeoSeries([LineString(key) for key in keys],crs=4326).to_crs(26915)
    project=Transformer.from_crs(4326,26915,always_xy=True)
    point=Point(*project.transform(lon,lat))
    choices=STRtree(lines.to_numpy()).query_nearest(point,all_matches=True)
    index=min(choices,key=lambda i:min(e.id for e in groups[keys[i]]))
    key=keys[index];line=lines.iloc[index];position=line.project(point);snap=line.interpolate(position)
    gap=float(point.distance(snap))
    if gap>2000:raise ValueError('This point is more than 1.24 miles from a mapped driving road. Choose a point closer to a road.')
    inverse=Transformer.from_crs(26915,4326,always_xy=True);snap_lon,snap_lat=inverse.transform(snap.x,snap.y)
    projected=np.asarray(line.coords);lengths=np.linalg.norm(np.diff(projected,axis=0),axis=1)
    ends=np.cumsum(lengths);k=min(int(np.searchsorted(ends,position,side='right')),len(lengths)-1)
    before=ends[k-1] if k else 0.;portion=(position-before)/lengths[k] if lengths[k] else 0.
    coords=np.asarray(key);geod=Geod(ellps='WGS84');geo=np.asarray(geod.inv(coords[:-1,0],coords[:-1,1],coords[1:,0],coords[1:,1])[2])
    fraction=float(np.clip((geo[:k].sum()+geo[k]*portion)/geo.sum(),0,1))
    snap_coord=[snap_lon,snap_lat]
    prefix=[list(c) for c in key[:k+1]]+[snap_coord]
    suffix=[snap_coord]+[list(c) for c in key[k+1:]]
    first=sorted(groups[key],key=lambda e:e.id)[0]
    forward=tuple(map(tuple,first.geometry or [[nodes[first.u].lon,nodes[first.u].lat],[nodes[first.v].lon,nodes[first.v].lat]]))==key
    endpoint=None
    if position<1e-6:endpoint=first.u if forward else first.v
    elif line.length-position<1e-6:endpoint=first.v if forward else first.u
    return {'members':groups[key],'canonical':key,'fraction':fraction,'prefix':prefix,'suffix':suffix,'snap':[snap_lat,snap_lon],'gap_m':gap,'endpoint':endpoint}


def seeded_dijkstra(adj,seeds):
    distances={node:inf for node in adj};predecessor={};queue=[]
    for node,value in seeds.items():
        distances[node]=value['seconds'];heappush(queue,(value['seconds'],node))
    while queue:
        cost,u=heappop(queue)
        if cost!=distances[u]:continue
        for v,weight,edge_id in adj[u]:
            alt=cost+weight
            if alt<distances[v]:
                distances[v]=alt;predecessor[v]=(u,edge_id);heappush(queue,(alt,v))
    return distances,predecessor


def query_scenario(data,attachment,lat,lon,sites,scenario,direction,access_mode='connector',access_speed=20):
    adj=adjacency(data,scenario);reverse=direction=='from_resource'
    if reverse:
        backwards={n:[] for n in adj}
        for u,arcs in adj.items():
            for v,weight,eid in arcs:backwards[v].append((u,weight,eid))
        adj=backwards
    nodes={n.id:n for n in data.nodes};edges={e.id:e for e in data.edges}
    closed=set(scenario.closed_edge_ids);seeds={}
    if attachment['endpoint'] is not None:
        seeds[attachment['endpoint']]={'seconds':0.,'length_m':0.,'path':[[attachment['snap'][1],attachment['snap'][0]]]}
    else:
        for edge in sorted(attachment['members'],key=lambda e:e.id):
            if edge.id in closed:continue
            coords=tuple(map(tuple,edge.geometry or [[nodes[edge.u].lon,nodes[edge.u].lat],[nodes[edge.v].lon,nodes[edge.v].lat]]))
            forward=coords==attachment['canonical'];fraction=attachment['fraction'] if forward else 1-attachment['fraction']
            share=fraction if reverse else 1-fraction
            node=edge.u if reverse else edge.v
            path=list(reversed(attachment['prefix'])) if (forward and reverse or not forward and not reverse) else attachment['suffix']
            seconds=edge.time_s*share*scenario.multiplier*scenario.edge_multipliers.get(edge.id,1)
            if node not in seeds or seconds<seeds[node]['seconds']:
                seeds[node]={'seconds':seconds,'length_m':edge.length_m*share,'path':path}
    distances,predecessor=seeded_dijkstra(adj,seeds)
    routes=[];unreachable=0
    for site in sites:
        if site['id'] in scenario.disabled_site_ids:unreachable+=1;continue
        if abs(site['lat']-lat)<1e-7 and abs(site['lon']-lon)<1e-7:
            routes.append({**site,'time_s':0.,'road_time_s':0.,'access_time_s':0.,'distance_m':0.,'road_path':[[lon,lat]],'access_paths':[]});continue
        if not isfinite(distances.get(site['node'],inf)):unreachable+=1;continue
        current=site['node'];path_edges=[]
        while current in predecessor:
            previous,eid=predecessor[current];path_edges.append(eid);current=previous
        path_edges.reverse();seed=seeds[current]
        road_path=[list(c) for c in seed['path']];road_length=seed['length_m']
        for eid in path_edges:
            edge=edges[eid];coords=edge.geometry or [[nodes[edge.u].lon,nodes[edge.u].lat],[nodes[edge.v].lon,nodes[edge.v].lat]]
            road_path.extend([list(c) for c in (coords[::-1] if reverse else coords)]);road_length+=edge.length_m
        if reverse:road_path.reverse()
        gap=attachment['gap_m']+site.get('snap_m',0.)
        connector=gap*3.6/access_speed*scenario.multiplier if access_mode=='connector' else 0.
        node=nodes[site['node']]
        access_paths=[[[lon,lat],[attachment['snap'][1],attachment['snap'][0]]],[[node.lon,node.lat],[site['lon'],site['lat']]]] if access_mode=='connector' else []
        routes.append({**site,'time_s':float(distances[site['node']]+connector),'road_time_s':float(distances[site['node']]),'access_time_s':float(connector),'distance_m':float(road_length+(gap if access_mode=='connector' else 0.)),'road_path':road_path,'access_paths':access_paths})
    routes.sort(key=lambda r:(r['time_s'],r['id']))
    return {'scenario_id':scenario.id,'scenario_name':scenario.name,'routes':routes[:2],'unreachable_locations':unreachable}


def point_routes(payload):
    request=payload['request'];run=payload.get('run');data=load_dataset(request['dataset'])
    lat,lon=request['lat'],request['lon'];box=data.provenance.get('study_bbox_south_west_north_east')
    if box and not(box[0]<=lat<=box[2] and box[1]<=lon<=box[3]):raise ValueError('This point is outside the supported road-data region. Choose a point inside the dashed boundary.')
    if run and run['dataset_version']!=data.version:raise ValueError('Road data changed. Recalculate your plan before checking a point.')
    nodes={n.id:n for n in data.nodes};mapped={f['id']:f for f in data.provenance.get('facilities',[])}
    if run:
        ids=set(run['selected_site_ids']);pool=[c for c in data.candidates if c.id in ids]
        if len(pool)!=len(ids):raise ValueError('A plan location is no longer available. Recalculate the plan.')
        sites=[{'id':c.id,'node':c.node,'label':c.label,'lat':mapped[c.id]['lat'] if c.id in mapped else nodes[c.node].lat,'lon':mapped[c.id]['lon'] if c.id in mapped else nodes[c.node].lon,'snap_m':c.snap_m,'kind':mapped.get(c.id,{}).get('kind','assumed_site'),'source_url':mapped.get(c.id,{}).get('source_url'),'community':c.community} for c in pool]
        config=run['configuration'];catalog={sid:Scenario.model_validate(s) for sid,s in run['scenario_definitions'].items()}
    else:
        included=area_predicate(data,request.get('focus_bounds'),request.get('focus_city_ids',[]))
        sites=[f for f in mapped.values() if included(f['lat'],f['lon'])]
        config={'access_mode':'connector','access_speed_kph':20};catalog=scenario_catalog(data)
        if not sites:raise ValueError('No mapped facilities in this area. Select a larger area or calculate a plan.')
    sid=request['scenario_id']
    if sid not in catalog:raise ValueError('This condition was not calculated for the selected plan')
    attachment=attach_query(data,lat,lon)
    comparisons=[query_scenario(data,attachment,lat,lon,sites,catalog[key],request['direction'],config['access_mode'],config['access_speed_kph']) for key in dict.fromkeys(['normal',sid])]
    return {'dataset_version':data.version,'point':{'lat':lat,'lon':lon},'road_snap':{'lat':attachment['snap'][0],'lon':attachment['snap'][1],'distance_m':attachment['gap_m']},'direction':request['direction'],'scope':'selected_plan' if run else 'mapped_facilities','conditions':comparisons,'access_speed_kph':config['access_speed_kph'],'source_note':'Saved OpenStreetMap roads and mapped facilities; speeds may be assumed. No live traffic, turn restrictions, or confirmed facility availability. Dashed access legs are assumed straight paths.'}
