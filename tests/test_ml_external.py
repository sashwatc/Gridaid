from datetime import datetime,timezone,timedelta
import json
import httpx
import numpy as np
import pytest
from ml.features import fixture_table,validate_table,split_table,preprocessor,FEATURES
from ml.train import train
from backend.services.external import fetch_bytes,validated_feed
from backend.services.ml_inference import weights_for,normalize
from backend.services.data import load_dataset
from backend.services.scenarios import Scenario


def test_ml_schema_splits_zeros_and_leakage():
    table=fixture_table();tr,va,te=split_table(table)
    assert (tr.target_count==0).any()
    assert tr.period.max()<va.period.min()<te.period.min()
    assert not set(tr.segment_id)&set(te.segment_id)
    bad=table.copy();bad['same_period_crashes']=bad.target_count
    with pytest.raises(ValueError):validate_table(bad)
    bad=table.copy();bad.loc[0,'lag_period']=bad.loc[0,'period']
    with pytest.raises(ValueError):validate_table(bad)
    prep=preprocessor();prep.fit(tr[FEATURES]);before=prep.named_transformers_['numeric'][0].statistics_.copy()
    altered=te.copy();altered['aadt']=1e12;prep.transform(altered[FEATURES])
    assert np.array_equal(before,prep.named_transformers_['numeric'][0].statistics_)


def test_ml_reproducible_actual_baseline_comparison():
    a,_=train(fixture_table());b,_=train(fixture_table())
    assert a==b
    assert a['data_kind']=='synthetic_fixture' and not a['available_for_iowa']
    assert set(a['test'])=={'global_mean','previous_period','poisson','random_forest'}
    assert a['selected_by_validation_mae']==min(a['validation'],key=lambda k:a['validation'][k]['mae'])
    assert all(v['mae']>=0 for v in a['test'].values())


def test_demand_modes_validated_gate_and_normalization():
    data=load_dataset('fixture')
    data=data.model_copy(update={'ml_validated':True,'model_version':'TEST_ONLY',
        'demands':[d.model_copy(update={'risk':float(i+1)}) for i,d in enumerate(data.demands)]})
    s=Scenario(id='normal',name='Normal')
    risk=weights_for(data,s,'ml_risk');blend=weights_for(data,s,'blended',.25)
    assert risk.sum()==pytest.approx(1)
    assert blend==pytest.approx(.25*normalize([d.population for d in data.demands])+.75*risk)
    with pytest.raises(ValueError):normalize([np.inf,1])


def test_external_host_redirect_size_and_fallback(tmp_path):
    with pytest.raises(ValueError):fetch_bytes('https://evil.example/data')
    for url in ['http://api.census.gov/x','https://api.census.gov:8080/x','https://name@api.census.gov/x']:
        with pytest.raises(ValueError):fetch_bytes(url)
    with pytest.raises(ValueError):fetch_bytes('https://api.census.gov/x',max_bytes=2,transport=httpx.MockTransport(lambda r:httpx.Response(200,content=b'long')))
    with pytest.raises((ValueError,httpx.HTTPStatusError)):
        fetch_bytes('https://api.census.gov/x',transport=httpx.MockTransport(lambda r:httpx.Response(302,headers={'location':'https://evil.example'})))
    now=datetime.now(timezone.utc);cache=tmp_path/'feed.json'
    transport=httpx.MockTransport(lambda r:httpx.Response(200,json={'source_timestamp':now.isoformat(),'records':[]}))
    assert not validated_feed('https://iowadot.gov/feed',cache,transport,now)['cached_fallback']
    broken=httpx.MockTransport(lambda r:httpx.Response(503))
    assert validated_feed('https://iowadot.gov/feed',cache,broken,now)['cached_fallback']
    assert validated_feed('https://iowadot.gov/feed',cache,broken,now+timedelta(days=2))['stale']
    cache.unlink()
    with pytest.raises(ValueError):validated_feed('https://iowadot.gov/feed',cache,broken,now)
