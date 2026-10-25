"""Deterministic spatial audit and directed terminal-road attachments.

The connector is an explicitly assumed straight access leg, not an observed road,
path across property, or a household service area. It never joins separate roads.
"""
from collections import defaultdict
import numpy as np
import geopandas as gpd
from pyproj import Geod
from shapely.geometry import LineString,Point,shape,box
from shapely import STRtree
from backend.services.data import EdgeAccess,digest


def attach_points(data,census,places,unincorporated='Unincorporated Scott County'):
    nodes={n.id:n for n in data.nodes};groups={};members=defaultdict(list)
    for e in data.edges:
        coords=tuple(map(tuple,e.geometry or [[nodes[e.u].lon,nodes[e.u].lat],[nodes[e.v].lon,nodes[e.v].lat]]))
        if not (np.allclose(coords[0],(nodes[e.u].lon,nodes[e.u].lat),rtol=0,atol=1e-7) and np.allclose(coords[-1],(nodes[e.v].lon,nodes[e.v].lat),rtol=0,atol=1e-7)):
            raise ValueError('Road geometry does not follow directed endpoints')
        key=min(coords,coords[::-1]);groups.setdefault(key,len(groups));members[key].append(e)
    keys=list(groups);geoms=gpd.GeoSeries([LineString(k) for k in keys],crs=4326).to_crs(26915)
    tree=STRtree(geoms.to_numpy());geod=Geod(ellps='WGS84')
    tracts={f['properties']['GEOID']:f for f in census['features']}
    place_features=[(f['properties']['NAME'],shape(f['geometry'])) for f in places['features']]
    def community(lon,lat):
        matches=[name for name,geom in place_features if geom.covers(Point(lon,lat))]
        return ', '.join(sorted(matches)) if matches else unincorporated
    def fractional_length(key,line,position):
        projected=np.asarray(line.coords);lengths=np.linalg.norm(np.diff(projected,axis=0),axis=1)
        coords=np.asarray(key);geo=geod.inv(coords[:-1,0],coords[:-1,1],coords[1:,0],coords[1:,1])[2]
        end=np.cumsum(lengths);k=min(int(np.searchsorted(end,position,side='right')),len(lengths)-1)
        before=end[k-1] if k else 0.
        return float((geo[:k].sum()+geo[k]*((position-before)/lengths[k] if lengths[k] else 0.))/geo.sum())
    demands=[];rows=[]
    for d in data.demands:
        f=tracts[d.id];attrs=f['properties'];lat,lon=float(attrs['INTPTLAT']),float(attrs['INTPTLON'])
        point=gpd.GeoSeries([Point(lon,lat)],crs=4326).to_crs(26915).iloc[0]
        matches=tree.query_nearest(point,all_matches=True)
        index=min(matches,key=lambda i:min(e.id for e in members[keys[i]]))
        key=keys[index];line=geoms.iloc[index];position=line.project(point);snap=line.interpolate(position)
        distance=point.distance(snap)
        snapped=gpd.GeoSeries([snap],crs=26915).to_crs(4326).iloc[0]
        fraction=np.clip(fractional_length(key,line,position),0.,1.)
        legs=[];node=d.legacy_node or d.node
        if position<1e-6 or line.length-position<1e-6:
            # At an endpoint, arrival via any legal road is sufficient even if this edge closes.
            edge=members[key][0];forward=tuple(map(tuple,edge.geometry))==key
            node=(edge.u if forward else edge.v) if position<1e-6 else (edge.v if forward else edge.u)
        else:
            for e in sorted(members[key],key=lambda e:e.id):
                forward=tuple(map(tuple,e.geometry))==key
                legs.append(EdgeAccess(edge_id=e.id,fraction=float(fraction if forward else 1-fraction)))
        old_m=d.legacy_snap_m if d.legacy_snap_m is not None else d.snap_m
        updated=d.model_copy(update={'origin_lat':lat,'origin_lon':lon,'snap_lat':snapped.y,'snap_lon':snapped.x,
                                     'node':node,'snap_m':float(distance),'legacy_snap_m':old_m,
                                     'legacy_node':d.legacy_node or d.node,'road_access':legs,'community':community(lon,lat)})
        demands.append(updated)
        rows.append({'tract_id':d.id,'population_2020':d.population,'community_at_internal_point':updated.community,
                     'original_lat':lat,'original_lon':lon,'legacy_node':updated.legacy_node,'legacy_node_snap_m':old_m,
                     'road_snap_lat':snapped.y,'road_snap_lon':snapped.x,'road_snap_m':float(distance),
                     'directed_access': [a.model_dump() for a in legs],
                     'road_classes':sorted({e.road_class for e in members[key]}),'tract_geometry_bounds':list(shape(f['geometry']).bounds)})
    sites=[c.model_copy(update={'community':community(nodes[c.node].lon,nodes[c.node].lat)}) for c in data.candidates]
    candidate_rows=[{'site_id':c.id,'node':c.node,'lat':nodes[c.node].lat,'lon':nodes[c.node].lon,'community':c.community,'snap_m':c.snap_m,'location_kind':'assumed graph-node site; no independent original facility location'} for c in sites]
    counts={name:{'demand_points':sum(d.community==name for d in demands),'candidates':sum(c.community==name for c in sites)} for name in sorted({d.community for d in demands}|{c.community for c in sites})}
    selected=gpd.GeoSeries([shape(tracts[d.id]['geometry']) for d in demands],crs=4326)
    footprint=selected.union_all();crop=data.provenance['study_bbox_south_west_north_east'];rectangle=box(crop[1],crop[0],crop[3],crop[2])
    areas=gpd.GeoSeries([footprint,footprint.intersection(rectangle),rectangle],crs=4326).to_crs(26915).area
    report={'method_version':'directed-edge-plus-explicit-access-v2','boundary_south_west_north_east':crop,
            'selection':'Whole Scott County 2020 tracts whose official internal points are in the rectangle; candidates in rectangle on largest strong component; intersecting whole OSM ways form an irregular routing buffer.',
            'communities_at_points':counts,'community_area_intersections_km2':{name:float(gpd.GeoSeries([footprint.intersection(geom)],crs=4326).to_crs(26915).area.iloc[0]/1e6) for name,geom in place_features},
            'selected_tract_area_km2':float(areas.iloc[0]/1e6),'selected_tract_area_outside_rectangle_km2':float((areas.iloc[0]-areas.iloc[1])/1e6),'rectangle_area_km2':float(areas.iloc[2]/1e6),
            'demand':rows,'candidates':candidate_rows,'population_total_2020':sum(d.population for d in demands),
            'legacy_max_snap_m':max(d.legacy_snap_m for d in demands),'road_max_snap_m':max(d.snap_m for d in demands),
            'legacy_median_snap_m':float(np.median([d.legacy_snap_m for d in demands])),'road_median_snap_m':float(np.median([d.snap_m for d in demands])),
            'limitations':['Internal points are not household locations or necessarily polygon centroids. Whole-tract weights do not imply exact within-threshold population.',
                          'Straight access connectors can cross barriers or private land; they are lower-bound illustrative distances with assumed speeds, not verified paths.',
                          'Nearest physical road and its legal directed approaches are fixed before disruptions; a closed access segment can make a point unreachable. No scenario resnapping.',
                          'Area intersections identify represented geography, not city population allocation. Candidate sites are invented locations, not actual public facilities.']}
    provenance={**data.provenance,'geography':{k:v for k,v in report.items() if k not in ('demand','candidates')}}
    updated=data.model_copy(update={'demands':demands,'candidates':sites,'provenance':provenance})
    return updated.model_copy(update={'version':digest(updated.model_dump(exclude={'version'}))[:20]}),report
