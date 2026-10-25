"""Independent counterexamples added during continuation; prior oracles retained."""
import asyncio
from itertools import combinations
import threading
import time
import os
import struct
import numpy as np
import pytest
from backend.services.data import Dataset
from backend.services.scenarios import Scenario
from backend.services.routing import MatrixCache
from backend.services.optimization import solve_static
from backend.services.resilience import solve_resilient
from backend.security import ComputeGate,run_bounded


def terminal_graph(reverse=False):
    edges=[dict(id='forward',u='a',v='b',length_m=1000,speed_kph=60)]
    legs=[dict(edge_id='forward',fraction=.25)]
    if reverse:
        edges.append(dict(id='reverse',u='b',v='a',length_m=1000,speed_kph=60));legs.append(dict(edge_id='reverse',fraction=.75))
    return Dataset.model_validate(dict(id='toy',name='Terminal',version='1',provenance={},
        nodes=[dict(id='a',lat=41,lon=-90),dict(id='b',lat=41,lon=-89.99)],edges=edges,
        candidates=[dict(id='A',node='a',label='A',snap_m=50),dict(id='B',node='b',label='B')],
        demands=[dict(id='inside',node='a',population=1,snap_m=100,road_access=legs)]))


def test_partial_directed_road_arrival_connectors_closure_and_units():
    data=terminal_graph();normal=Scenario(id='normal',name='Normal');cache=MatrixCache()
    t,key=cache.get(data,normal)
    # 1000 m at 60 km/h: 60 s; quarter-edge 15 s; (50+100)m at 20km/h: 27s.
    assert t[0,0]==pytest.approx(42)
    assert np.isinf(t[1,0]) # Downstream site cannot teleport backward into a one-way road.
    fast,newkey=cache.get(data,normal,access_speed_kph=40)
    assert newkey!=key and fast[0,0]==pytest.approx(28.5)
    zero,_=cache.get(data,normal,access_mode='node_only');assert zero[0,0]==15
    winter=Scenario(id='winter',name='Winter',multiplier=2.)
    assert cache.get(data,winter)[0][0,0]==pytest.approx(84)
    closure=Scenario(id='closed',name='Closed',closed_edge_ids=['forward'])
    assert np.isinf(cache.get(data,closure)[0]).all()
    both=terminal_graph(True)
    assert cache.get(both,normal)[0][1,0]==pytest.approx(63)
    assert cache.get(both,closure)[0][1,0]==pytest.approx(63)
    assert np.isinf(cache.get(both,closure)[0][0,0])


def test_p_median_oracle_does_not_reuse_production_penalty_or_objective():
    t=np.array([[90000.,np.inf,10],[80000.,40000.,np.inf],[100000.,80000.,5],[np.inf,70000.,50],
                [70000.,60000.,60],[100000.,np.inf,30],[85000.,90000.,15],[np.inf,100000.,70]])
    w=[2,3,5];unreachable_cost=103600. # Explicit independent policy: max finite 100000 + 3600.
    values=[]
    for c in combinations(range(8),3):
        values.append(sum(w[i]*min(t[j,i] if np.isfinite(t[j,i]) else unreachable_cost for j in c) for i in range(3)))
    result=solve_static(t,np.array(w),3,60,'p_median')
    assert result['status']=='optimal' and result['objective']==pytest.approx(min(values))
    assert result['unreachable_penalty_s']==unreachable_cost


def test_normalized_shared_placement_hand_counterexample():
    # Sites A and B specialize. C covers 100% in state one and 60% in state two.
    ts=[np.array([[0,np.inf,np.inf],[np.inf,0,0],[0,0,np.inf]]),
        np.array([[0,np.inf,np.inf],[np.inf,0,0],[0,0,np.inf]])]
    ws=[np.array([9000.,1000.,0.]),np.array([1.,5.,4.])]
    # A -> (.9,.1), B -> (.1,.9), C -> (1,.6): shared optimum C score .72.
    oracle=[]
    for j in range(3):
        cover=[sum(float(w[i]) for i in range(3) if t[j,i]<=60)/sum(w) for t,w in zip(ts,ws)]
        oracle.append(.6*sum(cover)/2+.4*min(cover))
    r=solve_resilient(ts,ws,1,60)
    assert r['objective']==pytest.approx(max(oracle))
    assert len(r['selected'])==1 and r['selected']==[2]
    # Weighting the first state's raw total must not change the answer.
    scaled=solve_resilient(ts,[ws[0]*100,ws[1]],1,60)
    assert scaled['objective']==pytest.approx(r['objective'])


def partial_ipc(connection,operation,payload):
    # A worker can stall after emitting an IPC frame header; poll() alone is no deadline.
    os.write(connection.fileno(),struct.pack('!i',10000))
    time.sleep(1.5)
    connection.close()


def test_process_deadline_includes_receiving_result():
    start=time.monotonic()
    with pytest.raises(TimeoutError):run_bounded('test',{},timeout=.3,target=partial_ipc)
    assert time.monotonic()-start<1.2


def test_cancelled_client_cannot_release_capacity_while_work_continues(monkeypatch):
    import backend.security as security
    started=threading.Event();release=threading.Event()
    def operation(op,payload):
        started.set();release.wait(2);return ('ok',{})
    monkeypatch.setattr(security,'run_bounded',operation)
    async def run():
        gate=ComputeGate(1);first=asyncio.create_task(gate.run('job',{}))
        while not started.is_set():await asyncio.sleep(.01)
        first.cancel()
        with pytest.raises(asyncio.CancelledError):await first
        try:
            assert gate.active==1
            assert await gate.run('second',{})==('busy','Computation capacity reached')
        finally:
            release.set()
            while gate.active:await asyncio.sleep(.01)
    asyncio.run(run())


def test_real_ml_training_only_preprocessing_and_final_test_noninterference(monkeypatch):
    import pandas as pd
    from ml import real_train
    from sklearn.impute import SimpleImputer
    rng=np.random.default_rng(812)
    ids=[str(i) for i in range(10)]
    index=pd.MultiIndex.from_product([ids,pd.date_range('2019-01-01','2023-12-01',freq='MS')],names=['cell_id','period'])
    counts=pd.Series(rng.poisson(np.repeat(np.linspace(.3,3,10),60)),index=index)
    table=real_train.table_from_counts(counts,ids)
    train,validation,test=real_train.split(table)
    seen=[];original=SimpleImputer.fit
    def audited_fit(self,x,*args,**kwargs):
        seen.append(tuple(x.index));return original(self,x,*args,**kwargs)
    monkeypatch.setattr(SimpleImputer,'fit',audited_fit)
    a,_,artifact_a=real_train.fit(table)
    altered=table.copy();altered.loc[test.index,'target_count']+=10
    b,_,artifact_b=real_train.fit(altered)
    assert len(seen)==6 and all(indices==tuple(train.index) for indices in seen)
    assert a['validation']==b['validation']
    assert a['selected_by_validation_mae']==b['selected_by_validation_mae']
    assert artifact_a==artifact_b and a['artifact_hash']==b['artifact_hash']
    assert a['test']!=b['test'] # Final metrics change, but cannot reach back into fitting/selection.
    assert (train.target_count==0).any()
    bad=table.copy();bad.loc[test.index[0],'region']='development'
    with pytest.raises(ValueError,match='geography group'):real_train.split(bad)


def test_real_geography_attachments_original_coordinates_and_known_large_gap():
    import json
    from pathlib import Path
    from backend.services.data import load_dataset
    from pyproj import Transformer
    from shapely.geometry import LineString,Point
    data=load_dataset('iowa');nodes={n.id:n for n in data.nodes};edges={e.id:e for e in data.edges}
    project=Transformer.from_crs(4326,26915,always_xy=True).transform
    largest=max(data.demands,key=lambda d:d.snap_m)
    assert largest.id=='19163012601' and largest.population==5484
    assert largest.snap_m==pytest.approx(871.0455951571253,abs=.01)
    # Original and road coordinates are distinct; the old zero-time relocation is gone.
    assert largest.origin_lat==pytest.approx(41.5904964)
    assert Point(project(largest.origin_lon,largest.origin_lat)).distance(Point(project(largest.snap_lon,largest.snap_lat)))==pytest.approx(largest.snap_m,abs=.01)
    for d in data.demands:
        assert d.origin_lat is not None and d.snap_lat is not None
        for a in d.road_access:
            e=edges[a.edge_id];assert 0<=a.fraction<=1
            # Test in the processing CRS: inverse projection is not a linear degree-space map.
            assert LineString([project(*p) for p in e.geometry]).distance(Point(project(d.snap_lon,d.snap_lat)))<1e-6
    n=Scenario(id='normal',name='Normal');cache=MatrixCache()
    t,_=cache.get(data,n);zero,_=cache.get(data,n,access_mode='node_only')
    finite=np.isfinite(t)
    assert (t[finite]>=zero[finite]).all()
    for i,d in enumerate(data.demands):
        for j,c in enumerate(data.candidates):
            if np.isfinite(t[j,i]):assert t[j,i]-zero[j,i]==pytest.approx((d.snap_m+c.snap_m)*3.6/20)
    assert data.quality()['population_total']==127326


def test_real_demo_report_matches_solver_and_published_coincidences():
    import json
    from pathlib import Path
    r=json.loads(Path('docs/real_demo_results.json').read_text())
    assert len(r['cases'])==12 and any(c['coincident_sites'] for c in r['cases'])
    chosen=next(c for c in r['cases'] if c['id']==r['chosen_case'])
    assert chosen['normal_loss']>0 and chosen['worst_gain']>.01
    for c in r['cases']:
        for kind in ['static','resilient']:
            result=c['results'][kind];assert result['solver_status']=='optimal'
        assert c['results']['resilient']['summary']['resilience_score']+1e-8>=c['results']['static']['summary']['resilience_score']


def test_geographic_projection_builds_correct_bidirectional_terminal_legs():
    from backend.services.geography import attach_points
    from pyproj import Transformer
    from shapely.geometry import LineString
    forward=Transformer.from_crs(4326,26915,always_xy=True).transform
    inverse=Transformer.from_crs(26915,4326,always_xy=True).transform
    a,b=forward(-90,41),forward(-89.99,41);v=np.array(b)-a
    target=np.array(a)+v*.25;origin=target+np.array([-v[1],v[0]])/np.linalg.norm(v)*100
    lon,lat=inverse(*origin)
    data=terminal_graph(True)
    data=data.model_copy(update={'provenance':{'study_bbox_south_west_north_east':[40.99,-90.01,41.01,-89.98]},
        'edges':[e.model_copy(update={'geometry':[[-90,41],[-89.99,41]] if e.id=='forward' else [[-89.99,41],[-90,41]]}) for e in data.edges],
        'demands':[data.demands[0].model_copy(update={'id':'tract','road_access':[],'snap_m':300})]})
    census={'features':[{'properties':{'GEOID':'tract','INTPTLAT':lat,'INTPTLON':lon},'geometry':{'type':'Polygon','coordinates':[[[-90.01,40.99],[-89.98,40.99],[-89.98,41.01],[-90.01,41.01],[-90.01,40.99]]]}}]}
    updated,report=attach_points(data,census,{'features':[]})
    d=updated.demands[0]
    assert d.snap_m==pytest.approx(100,abs=1e-6)
    fractions={a.edge_id:a.fraction for a in d.road_access}
    assert fractions==pytest.approx({'forward':.25,'reverse':.75},abs=1e-7)
    assert d.legacy_snap_m==300 and d.origin_lon==lon
    t,_=MatrixCache().get(updated,Scenario(id='normal',name='Normal'))
    assert t[:,0]==pytest.approx([42,63],abs=1e-5)


def test_cache_eviction_during_read_rebuilds_instead_of_failing(tmp_path,monkeypatch):
    from pathlib import Path
    from backend.services.data import load_dataset
    data=load_dataset('fixture');normal=Scenario(id='normal',name='Normal')
    first=MatrixCache(disk=True);first.directory=tmp_path;t,key=first.get(data,normal)
    original=Path.read_bytes;removed=False
    def racing_read(path):
        nonlocal removed
        if path.name==f'{key}.npy' and not removed:
            removed=True;path.unlink();raise FileNotFoundError('simulated concurrent cache eviction')
        return original(path)
    monkeypatch.setattr(Path,'read_bytes',racing_read)
    second=MatrixCache(disk=True);second.directory=tmp_path
    assert second.get(data,normal)[0]==pytest.approx(t)
