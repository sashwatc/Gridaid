"""Filter planning points and eligible sites while retaining the routing buffer."""
from shapely.geometry import Point,shape


def area_predicate(data,bounds=None,city_ids=()):
    region=data.provenance.get('study_bbox_south_west_north_east')
    if bounds:
        s,w,n,e=bounds
        if not(-90<=s<n<=90 and -180<=w<e<=180):raise ValueError('Invalid area bounds')
        if region and (s<region[0]-1e-8 or w<region[1]-1e-8 or n>region[2]+1e-8 or e>region[3]+1e-8):
            raise ValueError('Choose an area inside the supported road and population region')
    cities={c['id']:c for c in data.provenance.get('cities',[])}
    if set(city_ids)-cities.keys():raise ValueError('Unknown city; choose a supported Quad Cities location')
    polygons=[shape(cities[c]['geometry']) for c in city_ids]
    def included(lat,lon):
        return (not bounds or bounds[0]<=lat<=bounds[2] and bounds[1]<=lon<=bounds[3]) and (not polygons or any(g.covers(Point(lon,lat)) for g in polygons))
    return included


def focus_dataset(data,config):
    if not config.focus_bounds and not config.focus_city_ids:return data
    included=area_predicate(data,config.focus_bounds,config.focus_city_ids)
    nodes={n.id:n for n in data.nodes}
    facilities={f['id']:f for f in data.provenance.get('facilities',[])}
    demands=[d for d in data.demands if included(d.origin_lat if d.origin_lat is not None else nodes[d.node].lat,d.origin_lon if d.origin_lon is not None else nodes[d.node].lon)]
    candidates=[c for c in data.candidates if included(facilities[c.id]['lat'] if c.id in facilities else nodes[c.node].lat,facilities[c.id]['lon'] if c.id in facilities else nodes[c.node].lon)]
    if not demands or sum(d.population for d in demands)<=0:raise ValueError('This area has no population representative points. Enlarge the area or select another city.')
    if len(candidates)<config.resource_count:raise ValueError(f'This area has {len(candidates)} eligible locations. Use fewer resources or enlarge the area.')
    return data.model_copy(update={'demands':demands,'candidates':candidates})


def focus_scenarios(original,data,catalog,config):
    if data is original:return catalog
    included=area_predicate(original,config.focus_bounds,config.focus_city_ids)
    nodes={n.id:n for n in data.nodes};ids={c.id for c in data.candidates}
    ratio=sum(d.population for d in data.demands)/sum(d.population for d in original.demands)
    result={}
    for sid,s in catalog.items():
        temporary=[d.model_copy(update={'population':d.population*ratio,'risk':d.risk*ratio if d.risk is not None else None}) for d in s.temporary_demand if included(nodes[d.node].lat,nodes[d.node].lon)]
        result[sid]=s.model_copy(update={'disabled_site_ids':[i for i in s.disabled_site_ids if i in ids],'temporary_demand':temporary})
    return result
