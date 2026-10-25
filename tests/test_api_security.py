import asyncio
import time
from fastapi.testclient import TestClient
import pytest
from backend.api.app import create_app
from backend.security import ComputeGate,run_bounded


def forever(connection,operation,payload):
    while True:time.sleep(.1)


def test_entire_api_workflow_and_result_integrity():
    with TestClient(create_app(rate_limit=200)) as client:
        assert client.get('/api/health').json()['status']=='ok'
        study=client.get('/api/study-area').json();assert study['dataset']['id']=='fixture'
        config={'resource_count':3,'threshold_minutes':5.0,'scenario_ids':['normal','winter','closure','resource_failure','event','combined']}
        runs=[]
        for endpoint in ('/api/baseline','/api/optimize/static','/api/optimize/resilient'):
            response=client.post(endpoint,json=config)
            assert response.status_code==200,response.text
            run=response.json();runs.append(run)
            assert len(set(run['selected_site_ids']))==3
            assert run['dataset_version']==study['dataset']['version']
            assert run['configuration']['seed']==42
            assert run['metrics']['normal']['coverage']>=0
            assert client.get(f"/api/runs/{run['run_id']}").json()==run
            assert client.get(f"/api/runs/{run['run_id']}/explanation").json()==run['explanation']
        ids=[r['run_id'] for r in runs]
        assert client.post('/api/scenarios/evaluate',json={'run_ids':ids}).json()['runs']==runs
        response=client.post('/api/simulate',json={'run_ids':ids,'trials':10000,'seed':42})
        assert response.status_code==200,response.text
        sim=response.json()
        assert set(sim['configurations'])==set(ids)
        assert sim['runs']==runs
        for run in runs:
            for sid,metric in run['metrics'].items():
                sampled=sim['configurations'][run['run_id']]['scenarios'][sid]
                assert abs(sampled['coverage']-metric['coverage'])<.035
        assert client.get('/api/ml/risk-layer').json()['available'] is False
        assert client.get('/api/ml/model-card').json()['available_for_iowa'] is True
        changed=client.post('/api/baseline',json={**config,'threshold_minutes':6.0}).json()
        assert client.post('/api/scenarios/evaluate',json={'run_ids':[ids[0],changed['run_id']]}).status_code==422
        assert runs[0]['configuration']['threshold_minutes']==5.0
        assert client.post('/api/simulate',json={'run_ids':['0'*32]}).status_code==404


@pytest.mark.parametrize('payload',[{'resource_count':0},{'resource_count':True},{'resource_count':26},{'resource_count':9},{'threshold_minutes':'5'},{'threshold_minutes':1e200},{'scenario_ids':['unknown']},{'scenario_ids':['normal']*7},{'scenario_ids':['normal','normal']},{'demand_model':'fake'},{'demand_model':'ml_risk'},{'average_weight':.9},{'foo':1},{'objective':'p_median','method':'greedy'}])
def test_invalid_requests(payload):
    with TestClient(create_app()) as client:
        assert client.post('/api/optimize/static',json=payload).status_code==422


def test_oversized_nonfinite_headers_cors_and_rate_limits():
    with TestClient(create_app(rate_limit=1)) as client:
        assert client.post('/api/optimize/static',content=b'x'*17000).status_code==413
        response=client.post('/api/optimize/static',content=b'{"threshold_minutes":NaN}',headers={'content-type':'application/json'})
        assert response.status_code==422
        assert 'NaN' not in response.text
        assert client.post('/api/optimize/static',json={}).status_code==429
        r=client.get('/api/health',headers={'Origin':'https://evil.example'})
        assert 'access-control-allow-origin' not in r.headers
        assert r.headers['x-content-type-options']=='nosniff'
        assert r.headers['x-frame-options']=='DENY'
        assert "frame-ancestors 'none'" in r.headers['content-security-policy']
        assert client.get('/api/health',headers={'Origin':'http://127.0.0.1:5173'}).headers['access-control-allow-origin']=='http://127.0.0.1:5173'
        assert client.get('/api/study-area?dataset_id=evil').status_code==422
        assert client.get('/api/study-area?dataset_id=fixture&unknown=1').status_code==200
        assert client.post('/api/upload',content=b'file').status_code in (404,429)


def test_hard_process_deadline_kills_work():
    start=time.monotonic()
    with pytest.raises(TimeoutError):run_bounded('test',{},timeout=.2,target=forever)
    assert time.monotonic()-start<3


def test_computation_capacity_and_safe_error(monkeypatch):
    import backend.security as security
    def slow(op,payload):time.sleep(.2);return ('ok',{})
    monkeypatch.setattr(security,'run_bounded',slow)
    async def run():
        gate=ComputeGate(1)
        first=asyncio.create_task(gate.run('x',{}));await asyncio.sleep(.01)
        assert await gate.run('x',{})==('busy','Computation capacity reached')
        await first;assert gate.active==0
    asyncio.run(run())
    app=create_app()
    @app.get('/api/test-error')
    def error():raise RuntimeError('SECRET internal stack')
    with TestClient(app,raise_server_exceptions=False) as client:
        result=client.get('/api/test-error')
        assert result.status_code==500 and 'SECRET' not in result.text
        assert result.headers['x-content-type-options']=='nosniff'


def test_real_ml_risk_blend_all_scenarios_and_public_api():
    with TestClient(create_app(rate_limit=100)) as client:
        layer=client.get('/api/ml/risk-layer?dataset_id=iowa').json()
        assert layer['available'] and layer['forecast_period']=='2024-01'
        assert sum(v['normalized_risk'] for v in layer['values'])==pytest.approx(1)
        assert len(layer['values'])==39
        config={'dataset':'iowa','resource_count':3,'threshold_minutes':5.0,'demand_model':'blended','blend':.5}
        r=client.post('/api/optimize/resilient',json=config)
        assert r.status_code==200,r.text
        run=r.json();assert len(run['selected_site_ids'])==3
        assert run['model_version']==layer['model_version']
        assert run['solver']['status'] in ('optimal','feasible')
        # Same demand normalization for all scenario modes; events add 50% assumed risk.
        assert run['metrics']['event']['total_weight']==pytest.approx(1)
        assert len(run['demand_access']['event'])==40
        result=client.post('/api/simulate',json={'run_ids':[run['run_id']],'trials':10000})
        assert result.status_code==200,result.text
