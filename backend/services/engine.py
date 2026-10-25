from datetime import datetime,timezone
from uuid import uuid4
from backend.schemas import PlanRequest,Run
from backend.services.data import load_dataset
from backend.services.routing import MatrixCache
from backend.services.scenarios import scenario_catalog,demands_for
from backend.services.ml_inference import weights_for
from backend.services.optimization import baseline,solve_static
from backend.services.resilience import solve_resilient
from backend.services.metrics import deterministic_metrics,portfolio,nearest_times,safe
from backend.services.simulation import simulate
from backend.services.explanations import explain


def context(config):
    data=load_dataset(config.dataset)
    if config.resource_count>len(data.candidates):raise ValueError('resource count exceeds available distinct candidates')
    catalog=scenario_catalog(data,config.winter_multiplier,config.closure_profile);ids=list(dict.fromkeys(['normal',*config.scenario_ids]));cache=MatrixCache(disk=True)
    matrices={};keys={};weights={}
    for sid in ids:
        matrices[sid],keys[sid]=cache.get(data,catalog[sid],config.demand_model,config.blend,config.access_mode,config.access_speed_kph)
        weights[sid]=weights_for(data,catalog[sid],config.demand_model,config.blend)
    return data,catalog,matrices,keys,weights


def build_run(payload,kind):
    config=PlanRequest.model_validate(payload);data,catalog,matrices,keys,weights=context(config)
    threshold=config.threshold_minutes*60;p=config.resource_count
    if kind=='baseline':
        result=baseline(matrices['normal'],weights['normal'],p,threshold,config.baseline_method,config.seed)
    elif kind=='static':
        if config.method=='greedy':result=baseline(matrices['normal'],weights['normal'],p,threshold,'greedy',config.seed)
        else:result=solve_static(matrices['normal'],weights['normal'],p,threshold,config.objective,config.solver_limit_ms)
    elif kind=='resilient':
        ids=config.scenario_ids
        result=solve_resilient([matrices[s] for s in ids],[weights[s] for s in ids],p,threshold,
                               config.average_weight,config.worst_case_weight,config.solver_limit_ms)
    else:raise ValueError('unknown operation')
    selected=result['selected']
    metrics={sid:deterministic_metrics(t,weights[sid],selected,threshold) for sid,t in matrices.items()}
    summary=portfolio({s:metrics[s] for s in config.scenario_ids})
    summary['resilience_score']=config.average_weight*summary['average_coverage']+config.worst_case_weight*summary['minimum_coverage']
    access={sid:[{'demand_id':d.id,'time_s':safe(time),'covered':bool(time<=threshold),'weight':float(weight)} for d,time,weight in zip(demands_for(data,catalog[sid]),nearest_times(t,selected),weights[sid])] for sid,t in matrices.items()}
    explanation=explain(data,config.scenario_ids,matrices,weights,selected,threshold,p)
    return Run(run_id=uuid4().hex,created_at=datetime.now(timezone.utc).isoformat(),kind=kind,configuration=config,
               dataset_version=data.version,model_version=data.model_version,selected_site_ids=[data.candidates[j].id for j in selected],
               solver=result,demand_access=access,metrics=metrics,summary=summary,scenario_definitions={sid:catalog[sid] for sid in matrices},matrix_keys=keys,explanation=explanation).model_dump(mode='json')


def build_simulation(payload):
    runs=payload['runs'];config=PlanRequest.model_validate(runs[0]['configuration'])
    data,catalog,matrices,keys,weights=context(config)
    if any(r['dataset_version']!=data.version or r['model_version']!=data.model_version for r in runs):
        raise ValueError('Dataset/model changed; rerun configurations')
    if any(r['matrix_keys']!=keys for r in runs):raise ValueError('Scenario or routing inputs changed; rerun configurations')
    ids=config.scenario_ids
    configurations={r['run_id']:[next(j for j,c in enumerate(data.candidates) if c.id==sid) for sid in r['selected_site_ids']] for r in runs}
    result=simulate(configurations,{s:matrices[s] for s in ids},{s:weights[s] for s in ids},config.threshold_minutes*60,payload['trials'],payload['seed'])
    for value in result['configurations'].values():
        summary=value['summary'];summary['resilience_score']=config.average_weight*summary['average_coverage']+config.worst_case_weight*summary['minimum_coverage']
    return {**result,'runs':runs,'simulation_id':uuid4().hex}


def worker(operation,payload):
    return build_simulation(payload) if operation=='simulate' else build_run(payload,operation)
