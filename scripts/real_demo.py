"""Predeclared real-data comparison grid, and transparent access sensitivity.

No scenario/count/threshold search beyond this fixed grid. ML is not fitted or tuned.
"""
import json
from itertools import product
from pathlib import Path
import numpy as np
from backend.schemas import PlanRequest
from backend.services.data import load_dataset
from backend.services.routing import MatrixCache
from backend.services.scenarios import scenario_catalog
from backend.services.optimization import baseline,solve_static
from backend.services.resilience import solve_resilient
from backend.services.metrics import deterministic_metrics,portfolio
from backend.services.ml_inference import weights_for


def evaluate(data,catalog,ids,p,cache,access_mode='connector',speed=20.,configurations=None):
    matrices={s:cache.get(data,catalog[s],access_mode=access_mode,access_speed_kph=speed)[0] for s in ids}
    weights={s:weights_for(data,catalog[s]) for s in ids}
    solutions={'baseline':baseline(matrices['normal'],weights['normal'],p,300,'deterministic',42),
               'static':solve_static(matrices['normal'],weights['normal'],p,300),
               'resilient':solve_resilient(list(matrices.values()),list(weights.values()),p,300)}
    result={}
    for kind,solution in solutions.items():
        selected=solution['selected'] if configurations is None else configurations[kind]
        metrics={s:deterministic_metrics(t,weights[s],selected,300) for s,t in matrices.items()}
        result[kind]={'selected_site_ids':[data.candidates[j].id for j in selected], 'selected_indices':selected,
                      'normal':metrics['normal']['coverage'],'summary':portfolio(metrics),'scenarios':metrics,
                      'solver_status':solution['status'],'objective':solution['objective'],'bound':solution['bound'],
                      'runtime_s':solution['runtime_s']}
    return result


def main():
    data=load_dataset('iowa');cache=MatrixCache(capacity=64)
    ids=['normal','winter','closure','winter_closure'];cases=[]
    for p,winter,closure in product([2,3,4],[1.25,1.6],['central','east']):
        catalog=scenario_catalog(data,winter,closure)
        results=evaluate(data,catalog,ids,p,cache)
        cases.append({'id':f'p{p}-winter{winter}-{closure}','resource_count':p,'winter_multiplier':winter,'closure_profile':closure,'scenario_ids':ids,
                      'closed_directed_edges':len(catalog['closure'].closed_edge_ids),'results':results,
                      'coincident_sites':results['static']['selected_site_ids']==results['resilient']['selected_site_ids'],
                      'normal_loss':results['static']['normal']-results['resilient']['normal'],
                      'worst_gain':results['resilient']['summary']['minimum_coverage']-results['static']['summary']['minimum_coverage']})
        print(cases[-1]['id'], 'normal loss',round(cases[-1]['normal_loss'],4),'worst gain',round(cases[-1]['worst_gain'],4),'coincident',cases[-1]['coincident_sites'],flush=True)
    reference_ids=['normal','winter','closure','resource_failure','event','combined']
    reference=evaluate(data,scenario_catalog(data),reference_ids,3,cache)
    useful=[c for c in cases if c['worst_gain']>.01 and c['normal_loss']>0]
    # Selection criterion is explicit; all other cases are published, including coincidences.
    chosen=max(useful,key=lambda c:(c['worst_gain'],-c['normal_loss'],-c['resource_count'])) if useful else cases[0]
    config=PlanRequest(dataset='iowa',resource_count=chosen['resource_count'],threshold_minutes=5.,
                       scenario_ids=ids,winter_multiplier=chosen['winter_multiplier'],closure_profile=chosen['closure_profile'])
    preset={'id':chosen['id'],'label':'Real Iowa road/weather comparison','dataset_version':data.version,
            'description':'Assumed road/weather conditions on observed roads. Selected from the fully published 12-case grid; no resource outage or added event in this portfolio. Coverage refers to weighted tract internal points with assumed access, not exact households.',
            'configuration':config.model_dump(mode='json')}
    Path('docs/demo_preset.json').write_text(json.dumps(preset,indent=2)+'\n')
    fixed={k:r['selected_indices'] for k,r in chosen['results'].items()};sensitivity=[]
    cat=scenario_catalog(data,chosen['winter_multiplier'],chosen['closure_profile'])
    for mode,speed in [('node_only',20.),('connector',5.),('connector',20.),('connector',40.)]:
        optimum=evaluate(data,cat,ids,chosen['resource_count'],cache,mode,speed)
        fixed_result=evaluate(data,cat,ids,chosen['resource_count'],cache,mode,speed,fixed)
        sensitivity.append({'mode':mode,'access_speed_kph':speed,'reoptimized':optimum,'fixed_20kph_placements':fixed_result})
    legacy=data.model_copy(update={'demands':[d.model_copy(update={'node':d.legacy_node or d.node,'road_access':[],'snap_m':d.legacy_snap_m or 0}) for d in data.demands]})
    sensitivity.append({'mode':'legacy_junction_zero_access','access_speed_kph':None,
                        'reoptimized':evaluate(legacy,cat,ids,chosen['resource_count'],cache,'node_only'),
                        'fixed_20kph_placements':evaluate(legacy,cat,ids,chosen['resource_count'],cache,'node_only',configurations=fixed)})
    report={'dataset_version':data.version,'data_kind':'observed_osm_census_with_assumed_candidates_disruptions_and_access',
            'predeclared_grid':{'resources':[2,3,4],'winter_multipliers':[1.25,1.6],'closure_profiles':['central','east'],'threshold_minutes':5,'demand':'population','average_weight':.6,'worst_weight':.4,'access_speed_kph':20},
            'scenario_definitions':{profile:{s:v.model_dump(mode='json') for s,v in scenario_catalog(data,1.6,profile).items() if s in ids} for profile in ['central','east']},
            'cases':cases,'six_scenario_default_reference':reference,
            'preset_selection':'Largest worst-case gain >1 percentage point among cases with positive normal loss, then smallest loss/resource count; otherwise first case without claiming a tradeoff.',
            'chosen_case':chosen['id'],'access_sensitivity':sensitivity}
    Path('docs/real_demo_results.json').write_text(json.dumps(report,indent=2)+'\n')
    markdown='# All real-data comparisons\n\nEvery cell below is normal / portfolio average / portfolio minimum weighted representative-point coverage, in percent. These are the same assumptions for baseline/static/resilient within each row. All road/weather and access conditions are assumed. Full solver/status/selected IDs/metrics are in real_demo_results.json.\n\n| Case | Baseline N/A/W | Static N/A/W | Resilient N/A/W | Same selected sites? |\n|---|---|---|---|---|\n'
    def triplet(result):return ' / '.join(f'{100*v:.2f}' for v in [result['normal'],result['summary']['average_coverage'],result['summary']['minimum_coverage']])
    for case in cases:
        markdown+='| '+case['id']+' | '+' | '.join(triplet(case['results'][kind]) for kind in ['baseline','static','resilient'])+' | '+('yes' if case['coincident_sites'] else 'no')+' |\n'
    markdown+='\n## Separate six-scenario default reference (p=3)\n\nThis uses all original six scenarios, including resource failure/event/combined. Its portfolio differs from the four-state grid above; do not compare their averages as the same objective.\n\n| Layout | Normal / average / minimum (%) |\n|---|---|\n'
    for kind,result in reference.items():markdown+=f'| {kind} | {triplet(result)} |\n'
    Path('docs/real_data_results.md').write_text(markdown)
    print('Selected preset',chosen['id'],flush=True)
if __name__=='__main__':main()
