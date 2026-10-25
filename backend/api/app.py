from collections import OrderedDict
import json
import os
from pathlib import Path
from typing import Literal
from fastapi import FastAPI,HTTPException,Query,Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse,FileResponse
from fastapi.staticfiles import StaticFiles
from backend.schemas import (PlanRequest,Run,CompareRequest,SimulationRequest,Comparison,Simulation,
                             Study,Health,DemandLayers,MLCard,Explanation,RiskLayer,DemoPreset)
from backend.security import Guard,ComputeGate
from backend.services.data import load_dataset,ROOT
from backend.services.scenarios import scenario_catalog


def create_app(rate_limit=30,compute_limit=2):
    app=FastAPI(title='GridAid',version='0.1.0',debug=False,docs_url=None,redoc_url=None)
    app.state.runs=OrderedDict();app.state.gate=ComputeGate(compute_limit)
    app.add_middleware(CORSMiddleware,allow_origins=os.environ.get('GRIDAID_CORS','http://127.0.0.1:5173,http://localhost:5173').split(','),allow_methods=['GET','POST'],allow_headers=['Content-Type'])
    app.add_middleware(Guard,rate_limit=rate_limit)

    @app.exception_handler(RequestValidationError)
    async def invalid(request,exc):
        # Do not echo bodies, input values or internal stack traces.
        return JSONResponse(status_code=422,content={'detail':'Invalid request','fields':[list(map(str,e['loc'])) for e in exc.errors()]})

    def dataset(identifier):
        try:return load_dataset(identifier)
        except ValueError as exc:raise HTTPException(422,str(exc)) from None

    def validate(config):
        data=dataset(config.dataset)
        if config.resource_count>len(data.candidates):raise HTTPException(422,'Resource count exceeds available candidates')
        if config.demand_model!='population' and not data.ml_validated:raise HTTPException(422,'ML unavailable: no validated Iowa incident-risk layer')

    async def compute(operation,payload):
        status,value=await app.state.gate.run(operation,payload)
        if status!='ok':raise HTTPException({'invalid':422,'busy':503,'timeout':504,'error':500}.get(status,500),value)
        return value

    async def optimize(config,kind):
        validate(config)
        run=await compute(kind,config.model_dump())
        app.state.runs[run['run_id']]=run
        if len(app.state.runs)>100:app.state.runs.popitem(last=False)
        return run

    def get_runs(ids):
        if any(i not in app.state.runs for i in ids):raise HTTPException(404,'Run unavailable or expired')
        runs=[app.state.runs[i] for i in ids]
        if any(r['configuration']!=runs[0]['configuration'] or r['dataset_version']!=runs[0]['dataset_version'] or r['model_version']!=runs[0]['model_version'] or r['matrix_keys']!=runs[0]['matrix_keys'] for r in runs):
            raise HTTPException(422,'Comparison requires identical controls and dataset/model versions')
        if any(r['solver']['status'] not in ('optimal','feasible','heuristic') for r in runs):raise HTTPException(422,'A run has no feasible placement')
        return runs

    @app.get('/api/demo-preset',response_model=DemoPreset)
    def demo_preset():
        path=ROOT/'docs/demo_preset.json'
        if not path.exists():raise HTTPException(503,'Demo experiment report unavailable')
        preset=json.loads(path.read_text())
        if preset['dataset_version']!=dataset('iowa').version:raise HTTPException(409,'Demo preset is stale; rebuild real-demo experiments')
        return preset

    @app.get('/api/health',response_model=Health)
    def health():return {'status':'ok','version':'0.1.0'}

    @app.get('/api/study-area',response_model=Study)
    def study_area(dataset_id:str=Query('fixture',pattern='^(fixture|iowa)$'),winter_multiplier:float=Query(1.6,ge=1,le=3),closure_profile:Literal['central','east']='central'):
        data=dataset(dataset_id)
        return {'dataset':data,'scenarios':list(scenario_catalog(data,winter_multiplier,closure_profile).values()),'quality':data.quality(),
                'available_datasets':['fixture']+(['iowa'] if ((ROOT/'data/processed/iowa.json').exists() or (ROOT/'data/public/iowa.json.gz').exists()) else [])}

    @app.get('/api/demand-layers',response_model=DemandLayers)
    def demand_layers(dataset_id:str=Query('fixture',pattern='^(fixture|iowa)$')):
        data=dataset(dataset_id)
        return {'layers':[{'id':'population','available':True},{'id':'ml_risk','available':data.ml_validated,'reason':'Retrospective January 2024 forecast only.' if data.ml_validated else 'No validated risk for the synthetic corridor fixture.'},{'id':'blended','available':data.ml_validated,'reason':'Separately normalized population and predicted count.'}]}

    @app.get('/api/baseline',response_model=Run)
    async def get_baseline(dataset_id:str=Query('fixture',pattern='^(fixture|iowa)$'),resource_count:int=Query(3,ge=1,le=25),threshold_minutes:float=Query(5,ge=1,le=60)):
        return await optimize(PlanRequest(dataset=dataset_id,resource_count=resource_count,threshold_minutes=threshold_minutes),'baseline')

    @app.post('/api/baseline',response_model=Run)
    async def post_baseline(config:PlanRequest):return await optimize(config,'baseline')

    @app.post('/api/optimize/static',response_model=Run)
    async def static(config:PlanRequest):return await optimize(config,'static')

    @app.post('/api/optimize/resilient',response_model=Run)
    async def resilient(config:PlanRequest):return await optimize(config,'resilient')

    @app.post('/api/scenarios/evaluate',response_model=Comparison)
    async def evaluate(config:CompareRequest):return {'runs':get_runs(config.run_ids)}

    @app.post('/api/simulate',response_model=Simulation)
    async def simulation(config:SimulationRequest):
        runs=get_runs(config.run_ids)
        return await compute('simulate',{'runs':runs,'trials':config.trials,'seed':config.seed})

    @app.get('/api/runs/{run_id}/explanation',response_model=Explanation)
    def explanation(run_id:str):
        if run_id not in app.state.runs:raise HTTPException(404,'Run unavailable or expired')
        return app.state.runs[run_id]['explanation']

    @app.get('/api/runs/{run_id}',response_model=Run)
    def export(run_id:str):
        if run_id not in app.state.runs:raise HTTPException(404,'Run unavailable or expired')
        return app.state.runs[run_id]

    @app.get('/api/ml/model-card',response_model=MLCard)
    def model_card():
        path=ROOT/'docs/ml_real_metrics.json'
        available=path.exists() and dataset('iowa').ml_validated
        fixture=ROOT/'docs/ml_fixture_metrics.json'
        return {'available_for_iowa':available,'status':'retrospective_heldout_evaluation' if available else 'fixture_pipeline_only',
                'model_version':json.loads(path.read_text())['model_version'] if available else None,
                'reason':'Retrospective January 2024 transportation crash-count forecast; finalized lag counts lack historical as-of reporting timestamps. See held-out metrics and limitations in the model card.' if available else 'No evaluated Iowa model; synthetic fixture results are not Iowa validation.',
                'evaluation':json.loads(path.read_text()) if available else None,
                'fixture_report':json.loads(fixture.read_text()) if fixture.exists() else None}

    @app.get('/api/ml/risk-layer',response_model=RiskLayer)
    def risk_layer(dataset_id:str=Query('fixture',pattern='^(fixture|iowa)$')):
        data=dataset(dataset_id)
        total=sum(d.risk or 0 for d in data.demands)
        return {'available':data.ml_validated,'model_version':data.model_version,'forecast_period':'2024-01' if data.ml_validated else None,
                'reason':'Historical transportation incident forecast, not current emergency risk.' if data.ml_validated else 'No risk predictions for the synthetic graph.',
                'values':[{'demand_id':d.id,'predicted_count':d.risk,'normalized_risk':d.risk/total if total else 0.} for d in data.demands] if data.ml_validated else []}

    dist=ROOT/'frontend/dist'
    if dist.exists():
        app.mount('/assets',StaticFiles(directory=dist/'assets'),name='assets')
        @app.get('/',include_in_schema=False)
        def index():return FileResponse(dist/'index.html')
    return app

app=create_app()
