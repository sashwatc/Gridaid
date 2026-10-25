import json
from pathlib import Path
import numpy as np
import pytest
from backend.services.data import load_dataset,Dataset
from backend.services.routing import MatrixCache
from backend.services.scenarios import scenario_catalog
from backend.services.ml_inference import weights_for
from backend.services.explanations import explain
from scripts.ingest import parse_osm,parse_speed,simplify_roads
from ml.real_train import table_from_counts,split,fit,FEATURES
import pandas as pd


def test_osm_direction_mph_parallel_and_simplification_preserves_routes():
    raw={'elements':[{'type':'node','id':i,'lon':-90+i*.001,'lat':41} for i in range(4)]+[
        {'type':'way','id':10,'nodes':[0,1,2],'tags':{'highway':'residential','oneway':'-1','maxspeed':'30 mph'}},
        {'type':'way','id':11,'nodes':[0,1],'tags':{'highway':'residential','maxspeed':'20'}},
        {'type':'way','id':12,'nodes':[2,3],'tags':{'highway':'residential','access':'private'}}]}
    nodes,edges,skipped=parse_osm(raw)
    assert parse_speed({'highway':'residential','maxspeed':'30 mph'})[0]==pytest.approx(48.28032)
    assert [(e['u'],e['v']) for e in edges if e['speed_source']=='osm_maxspeed' and e['speed_kph']>40]==[('2','1'),('1','0')]
    assert all(e['v']!='3' for e in edges)
    reduced,ee=simplify_roads(nodes,edges)
    assert len(ee)<=len(edges)
    # Separate uniform chain specifically contracts its middle node without losing distance/time.
    from backend.services.scenarios import Scenario
    from backend.services.routing import adjacency,dijkstra
    chain_nodes=nodes[:3];chain=[{**e,'speed_kph':30,'speed_source':'modeled_assumption'} for e in edges[:2]]
    rn,re=simplify_roads(chain_nodes,chain)
    assert len(rn)==2 and len(re)==1
    assert re[0]['length_m']==pytest.approx(sum(e['length_m'] for e in chain))


def test_disk_cache_hit_and_corruption_rebuild(tmp_path):
    data=load_dataset('fixture');s=scenario_catalog(data)['normal']
    cache=MatrixCache(disk=True);cache.directory=tmp_path
    t,key=cache.get(data,s)
    second=MatrixCache(disk=True);second.directory=tmp_path
    assert second.get(data,s)[0]==pytest.approx(t)
    (tmp_path/f'{key}.npy').write_bytes(b'corrupt')
    third=MatrixCache(disk=True);third.directory=tmp_path
    assert third.get(data,s)[0]==pytest.approx(t)
    closure=scenario_catalog(data)['closure']
    assert third.get(data,closure)[1]!=key


def test_explanation_unique_marginal_redundancy_and_stability():
    data=load_dataset('fixture');catalog=scenario_catalog(data);cache=MatrixCache();ids=['normal','winter']
    matrices={s:cache.get(data,catalog[s])[0] for s in ids};weights={s:weights_for(data,catalog[s]) for s in ids}
    selected=[0,1,2];result=explain(data,ids,matrices,weights,selected,300,3)
    w=weights['normal'];covered=matrices['normal'][selected]<=300
    assert sum(x['marginal_in_order_weight'] for x in result['sites'])==pytest.approx(w[covered.any(axis=0)].sum())
    for i,site in enumerate(result['sites']):
        assert site['unique_weight']==pytest.approx(w[covered[i] & (covered.sum(axis=0)==1)].sum())
        assert site['redundant_weight']==pytest.approx(w[covered[i] & (covered.sum(axis=0)>1)].sum())
        assert 0<=site['selection_stability']<=1


def test_real_pipeline_lag_features_ignore_future_targets_and_zero_cells():
    ids=[str(i) for i in range(10)]
    index=pd.MultiIndex.from_tuples([('0',pd.Timestamp('2020-01-01')),('1',pd.Timestamp('2023-11-01'))],names=['cell_id','period'])
    counts=pd.Series([2,7],index=index)
    table=table_from_counts(counts,ids)
    assert len(table)==10*60 and (table.target_count==0).sum()==598
    train,val,test=split(table)
    assert not set(train.cell_id)&set(test.cell_id)
    altered=counts.copy();altered.loc[('1',pd.Timestamp('2023-11-01'))]=999
    after=table_from_counts(altered,ids)
    assert np.array_equal(table.loc[table.period<'2023-11-01',FEATURES].to_numpy(),after.loc[after.period<'2023-11-01',FEATURES].to_numpy(),equal_nan=True)


def test_public_snapshot_provenance_geometry_and_all_demand_retained():
    data=load_dataset('iowa')
    assert data.provenance['kind']=='public_roads_census_assumed_resources'
    assert len(data.demands)==39 and sum(d.population for d in data.demands)==127326
    assert data.quality()['weak_components']>1
    assert max(d.snap_m for d in data.demands)<=2000
    assert len({d.id for d in data.demands})==len(data.demands)


def test_observed_ml_final_selection_and_reproducible_artifact():
    report=json.loads(Path('docs/ml_real_metrics.json').read_text())
    assert report['data_kind']=='observed_iowa_crash_counts'
    assert report['selected_by_validation_mae']==min(report['validation'],key=lambda k:report['validation'][k]['mae'])
    assert not set(report['splits']['train']['cells'])&set(report['splits']['test']['cells'])
    assert report['zero_target_rows']>0
    assert report['spatial_join_audit']['unmatched_to_county_tracts']==0
    data=load_dataset('iowa')
    assert data.model_version==report['model_version']
    assert all(d.risk is not None and d.risk>=0 for d in data.demands)


def test_scenario_change_invalidates_stored_simulation(monkeypatch):
    from backend.services import engine
    request={'resource_count':3,'scenario_ids':['normal','winter']}
    run=engine.build_run(request,'static')
    original=engine.scenario_catalog
    def changed(data,*args):
        catalog=original(data,*args);catalog['winter']=catalog['winter'].model_copy(update={'multiplier':2.})
        return catalog
    monkeypatch.setattr(engine,'scenario_catalog',changed)
    with pytest.raises(ValueError,match='Scenario or routing inputs changed'):
        engine.build_simulation({'runs':[run],'trials':10000,'seed':42})


def test_committed_public_snapshot_works_without_processed_data(tmp_path,monkeypatch):
    import backend.services.data as module
    import shutil
    public=tmp_path/'data/public';public.mkdir(parents=True)
    shutil.copyfile(module.ROOT/'data/public/iowa.json.gz',public/'iowa.json.gz')
    expected=load_dataset('iowa')
    monkeypatch.setattr(module,'ROOT',tmp_path)
    actual=module.load_dataset('iowa')
    assert actual.model_dump()==expected.model_dump()


def test_unmodeled_road_direction_and_ml_schema_are_rejected():
    raw={'elements':[{'type':'node','id':i,'lat':41,'lon':-90+i*.001} for i in [0,1]]+[
        {'type':'way','id':1,'nodes':[0,1],'tags':{'highway':'residential','oneway':'alternating'}}]}
    with pytest.raises(ValueError,match='road direction'):parse_osm(raw)
    ids=[str(i) for i in range(10)]
    counts=pd.Series([],index=pd.MultiIndex.from_tuples([],names=['cell_id','period']),dtype=int)
    table=table_from_counts(counts,ids);table['same_period_crashes']=table.target_count
    with pytest.raises(ValueError,match='schema'):split(table)
