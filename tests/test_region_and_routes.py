from math import isclose
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.api.app import create_app
from backend.schemas import PlanRequest
from backend.services.area import focus_dataset,area_predicate
from backend.services.data import Dataset,load_dataset
from backend.services.point_routes import attach_query,query_scenario
from backend.services.scenarios import Scenario


def directed_line():
    return Dataset.model_validate({'id':'fixture','name':'Hand road','version':'hand','provenance':{'study_bbox_south_west_north_east':[41.49,-90.61,41.51,-90.57]},
        'nodes':[{'id':name,'lat':41.5,'lon':lon} for name,lon in [('A',-90.60),('B',-90.59),('C',-90.58)]],
        'edges':[{'id':name,'u':u,'v':v,'length_m':1000,'speed_kph':60,'geometry':[[a,41.5],[b,41.5]]} for name,u,v,a,b in [('AB','A','B',-90.60,-90.59),('BC','B','C',-90.59,-90.58)]],
        'demands':[{'id':'west','node':'A','population':100,'origin_lat':41.5,'origin_lon':-90.60},{'id':'east','node':'C','population':200,'origin_lat':41.5,'origin_lon':-90.58}],
        'candidates':[{'id':'site-A','node':'A','label':'A'},{'id':'site-C','node':'C','label':'C'}]})


def point_attachment(data):
    return {'members':[data.edges[0]],'canonical':tuple(map(tuple,data.edges[0].geometry)),'fraction':.25,
        'prefix':[[-90.60,41.5],[-90.5975,41.5]],'suffix':[[-90.5975,41.5],[-90.59,41.5]],
        'gap_m':100.,'endpoint':None,'snap':[41.5,-90.5975]}


def sites():
    return [{'id':'site-A','node':'A','label':'A','lat':41.5,'lon':-90.60,'snap_m':0},
            {'id':'site-C','node':'C','label':'C','lat':41.5,'lon':-90.58,'snap_m':20}]


def test_directional_point_routes_use_legal_partial_edges_and_units():
    data=directed_line();a=point_attachment(data)
    outgoing=query_scenario(data,a,41.5001,-90.5975,sites(),Scenario(id='normal',name='Normal'),'to_resource','node_only')
    assert [r['id'] for r in outgoing['routes']]==['site-C']
    assert outgoing['routes'][0]['time_s']==105 # 3/4 of AB (45 s) + BC (60 s)
    assert outgoing['routes'][0]['distance_m']==1750
    incoming=query_scenario(data,a,41.5001,-90.5975,sites(),Scenario(id='normal',name='Normal'),'from_resource','node_only')
    assert [r['id'] for r in incoming['routes']]==['site-A']
    assert incoming['routes'][0]['time_s']==15 # A can reach the first quarter; C cannot go backwards.
    assert incoming['routes'][0]['road_path'][0]==[-90.60,41.5]
    assert incoming['routes'][0]['road_path'][-1]==[-90.5975,41.5]
    winter=query_scenario(data,a,41.5001,-90.5975,sites(),Scenario(id='winter',name='Winter',multiplier=2),'to_resource','connector',20)
    assert winter['routes'][0]['road_time_s']==210
    assert winter['routes'][0]['access_time_s']==43.2 # (100+20) m at 20 km/h, then winter ×2.
    assert winter['routes'][0]['time_s']==253.2
    assert winter['routes'][0]['distance_m']==1870


def test_closed_terminal_road_does_not_resnap_and_endpoints_keep_legal_access():
    data=directed_line();a=point_attachment(data);closed=Scenario(id='closure',name='Closed',closed_edge_ids=['AB'])
    assert query_scenario(data,a,41.5,-90.5975,sites(),closed,'to_resource')['routes']==[]
    a['endpoint']='B';a['snap']=[41.5,-90.59];a['gap_m']=0
    result=query_scenario(data,a,41.5,-90.59,sites(),closed,'to_resource','node_only')
    assert result['routes'][0]['id']=='site-C' and result['routes'][0]['time_s']==60
    failed=Scenario(id='resource_failure',name='Unavailable',disabled_site_ids=['site-C'])
    assert query_scenario(data,point_attachment(data),41.5,-90.5975,sites(),failed,'to_resource')['routes']==[]


def test_projection_finds_fixed_road_position_in_metric_crs():
    from pyproj import Transformer
    from shapely.geometry import LineString,Point
    data=directed_line();a=attach_query(data,41.5002,-90.5975)
    project=Transformer.from_crs(4326,26915,always_xy=True)
    road=LineString([project.transform(-90.6,41.5),project.transform(-90.59,41.5)])
    expected=Point(*project.transform(-90.5975,41.5002)).distance(road)
    assert a['gap_m']==pytest.approx(expected,abs=1e-7)
    assert a['fraction']==pytest.approx(.25,abs=.0001)
    assert a['endpoint'] is None


def test_area_filters_demand_and_candidates_but_keeps_roads():
    data=directed_line();bounds=[41.49,-90.61,41.51,-90.595]
    config=PlanRequest(resource_count=1,focus_bounds=bounds)
    focused=focus_dataset(data,config)
    assert [d.id for d in focused.demands]==['west']
    assert [c.id for c in focused.candidates]==['site-A']
    assert focused.nodes is data.nodes and focused.edges is data.edges
    assert focus_dataset(data,PlanRequest()) is data
    assert len(data.demands)==2 and len(data.candidates)==2
    with pytest.raises(ValueError,match='eligible locations'):focus_dataset(data,PlanRequest(resource_count=2,focus_bounds=bounds))
    with pytest.raises(ValueError,match='no population'):focus_dataset(data,PlanRequest(resource_count=1,focus_bounds=[41.49,-90.599,41.51,-90.591]))
    with pytest.raises(ValueError,match='supported'):area_predicate(data,[41.0,-91,42,-90])
    with pytest.raises(ValueError,match='Unknown city'):area_predicate(data,None,['unknown'])


def test_quad_cities_snapshot_has_both_states_real_facilities_and_city_boundaries():
    data=load_dataset('quad_cities')
    assert {c['name'] for c in data.provenance['cities']}=={'Davenport','Bettendorf','Rock Island','Moline','East Moline'}
    assert {d.id[:5] for d in data.demands}>={'19163','17161'}
    assert not data.ml_validated and data.model_version is None
    assert {c.community for c in data.candidates}>={'Davenport city','Bettendorf city','Rock Island city','Moline city','East Moline city'}
    facilities={f['id']:f for f in data.provenance['facilities']}
    assert all(c.id in facilities and facilities[c.id]['source_url'].startswith('https://www.openstreetmap.org/') for c in data.candidates)
    assert any(e.u!=e.v and e.geometry for e in data.edges)
    moline=next(c for c in data.provenance['cities'] if c['name']=='Moline')
    focused=focus_dataset(data,PlanRequest(dataset='quad_cities',resource_count=1,focus_city_ids=[moline['id']]))
    assert all(d.community=='Moline city' for d in focused.demands)
    assert all(c.community=='Moline city' for c in focused.candidates)


def test_quad_api_point_times_match_selected_plan_and_bad_inputs_are_rejected():
    with TestClient(create_app(rate_limit=100)) as client:
        preset=client.get('/api/community-preset');assert preset.status_code==200
        config=preset.json()['configuration'];assert config['dataset']=='quad_cities'
        study=client.get('/api/study-area?dataset_id=quad_cities').json()
        response=client.post('/api/optimize/static',json=config);assert response.status_code==200,response.text
        run=response.json();d=next(d for d in study['dataset']['demands'] if d['community']=='Moline city')
        response=client.post('/api/route/point',json={'dataset':'quad_cities','run_id':run['run_id'],'lat':d['origin_lat'],'lon':d['origin_lon'],'direction':'from_resource'})
        assert response.status_code==200,response.text
        point=response.json();expected=next(a for a in run['demand_access']['normal'] if a['demand_id']==d['id'])
        routes=point['conditions'][0]['routes']
        if expected['time_s'] is None:assert routes==[]
        else:assert routes[0]['time_s']==pytest.approx(expected['time_s'],abs=.001)
        assert point['scope']=='selected_plan'
        assert all(r['id'] in run['selected_site_ids'] for r in routes)
        assert client.post('/api/route/point',json={'lat':41.5,'lon':-91.5}).status_code==422
        assert client.post('/api/route/point',json={'lat':91.,'lon':-90.5}).status_code==422
        assert client.post('/api/route/point',json={'lat':41.5,'lon':-90.5,'run_id':'0'*32}).status_code==404
        assert client.post('/api/baseline',json={**config,'focus_city_ids':['not-a-city']}).status_code==422
