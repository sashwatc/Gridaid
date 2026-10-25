"""Reproducible fixture sensitivity, algorithm and diminishing-return comparisons."""
import json
from pathlib import Path
import numpy as np
from backend.services.data import load_dataset
from backend.services.routing import MatrixCache
from backend.services.scenarios import scenario_catalog
from backend.services.ml_inference import weights_for
from backend.services.optimization import solve_static,baseline
from backend.services.resilience import solve_resilient
from backend.services.metrics import deterministic_metrics,portfolio


def run():
    data=load_dataset('fixture');catalog=scenario_catalog(data);cache=MatrixCache()
    results=[]
    cases=[('default',3,300,1.6,.6,'closure',0)]
    cases += [(f'resources-{p}',p,300,1.6,.6,'closure',0) for p in [1,2,4]]
    cases += [(f'threshold-{t}',3,t,1.6,.6,'closure',0) for t in [180,420]]
    cases += [(f'winter-{m}',3,300,m,.6,'closure',0) for m in [1.2,2.]]
    cases += [(f'average-{a}',3,300,1.6,a,'closure',0) for a in [0.,1.]]
    cases += [('alternate-corridor',3,300,1.6,.6,'alternate',0),('alternate-outage',3,300,1.6,.6,'closure',1)]
    for name,p,threshold,winter,alpha,closure,failure in cases:
        scenarios=dict(catalog)
        scenarios['winter']=scenarios['winter'].model_copy(update={'multiplier':winter})
        scenarios['resource_failure']=scenarios['resource_failure'].model_copy(update={'disabled_site_ids':[data.candidates[failure].id]})
        if closure=='alternate':
            scenarios['closure']=scenarios['closure'].model_copy(update={'closed_edge_ids':[e.id for e in data.edges if {e.u,e.v}=={'2-4','3-4'}]})
        scenarios['combined']=scenarios['combined'].model_copy(update={'multiplier':winter,'closed_edge_ids':scenarios['closure'].closed_edge_ids,'disabled_site_ids':scenarios['resource_failure'].disabled_site_ids})
        matrices={sid:cache.get(data,s)[0] for sid,s in scenarios.items()};weights={sid:weights_for(data,s) for sid,s in scenarios.items()}
        solved=solve_resilient(list(matrices.values()),list(weights.values()),p,threshold,alpha,1-alpha)
        metrics={sid:deterministic_metrics(t,weights[sid],solved['selected'],threshold) for sid,t in matrices.items()}
        summary=portfolio(metrics);summary['resilience_score']=alpha*summary['average_coverage']+(1-alpha)*summary['minimum_coverage']
        results.append(dict(case=name,p=p,threshold_s=threshold,winter= winter,average_weight=alpha,selected=solved['selected'],solver=solved,summary=summary))
    comparisons=[]
    t=cache.get(data,catalog['normal'])[0];w=weights_for(data,catalog['normal'])
    for method in ['deterministic','random','greedy']:
        comparisons.append(baseline(t,w,3,300,method))
    comparisons.append(solve_static(t,w,3,300))
    output={'data_kind':'synthetic_fixture','dataset_version':data.version,'sensitivity':results,'algorithm_comparison':comparisons,
            'stability_across_sensitivity':{c.id:sum(i in r['selected'] for r in results)/len(results) for i,c in enumerate(data.candidates)},
            'demand_blend_experiment':'Blocked for Iowa: no validated risk. Demand normalization and all blend endpoints independently unit-tested with labeled artificial risk.'}
    Path('docs/experiments.json').write_text(json.dumps(output,indent=2)+'\n')
    print(f'{len(results)} sensitivity cases and {len(comparisons)} algorithm comparisons written')
if __name__=='__main__':run()
