import json
import platform
from pathlib import Path
from time import perf_counter
import numpy as np
from backend.services.data import load_dataset
from backend.services.routing import MatrixCache
from backend.services.scenarios import scenario_catalog
from backend.services.ml_inference import weights_for
from backend.services.optimization import solve_static
from backend.services.resilience import solve_resilient
from backend.services.simulation import simulate
from ml.features import fixture_table,split_table,FEATURES,preprocessor
from sklearn.ensemble import RandomForestRegressor
from sklearn.pipeline import make_pipeline


def timed(fn):
    start=perf_counter();value=fn();return value,perf_counter()-start


def main():
    report={'hardware':platform.platform(),'processor':platform.processor(),'python':platform.python_version(),'datasets':{}}
    for name in ['fixture','iowa']:
        data,load=timed(lambda:load_dataset(name));scenarios=scenario_catalog(data);cache=MatrixCache()
        matrix,build=timed(lambda:cache.get(data,scenarios['normal'])[0]);_,cached=timed(lambda:cache.get(data,scenarios['normal']))
        matrices,all_time=timed(lambda:{sid:cache.get(data,s)[0] for sid,s in scenarios.items()})
        weights={sid:weights_for(data,s) for sid,s in scenarios.items()}
        static,static_time=timed(lambda:solve_static(matrix,weights['normal'],3,300))
        median,median_time=timed(lambda:solve_static(matrix,weights['normal'],3,300,'p_median'))
        robust,robust_time=timed(lambda:solve_resilient(list(matrices.values()),list(weights.values()),3,300))
        simulation,sim_time=timed(lambda:simulate({'static':static['selected'],'resilient':robust['selected']},matrices,weights,300))
        report['datasets'][name]={'version':data.version,'nodes':len(data.nodes),'edges':len(data.edges),'candidates':len(data.candidates),'demand':len(data.demands),'graph_load_s':load,'normal_matrix_build_s':build,'memory_cache_load_with_fingerprint_s':cached,'portfolio_matrix_build_s':all_time,
                                  'static_total_s':static_time,'static_solver_s':static['runtime_s'],'p_median_total_s':median_time,'resilient_total_s':robust_time,'resilient_solver_s':robust['runtime_s'],'simulation_10000_s':sim_time,
                                  'statuses':{'static':static['status'],'p_median':median['status'],'resilient':robust['status']},
                                  'static_summary':simulation['configurations']['static']['summary'],'resilient_summary':simulation['configurations']['resilient']['summary']}
        print(name,json.dumps(report['datasets'][name]),flush=True)
    tr,va,te=split_table(fixture_table())
    model=make_pipeline(preprocessor(),RandomForestRegressor(n_estimators=80,max_depth=6,random_state=42,n_jobs=1)).fit(tr[FEATURES],tr.target_count)
    _,inference=timed(lambda:model.predict(te[FEATURES]))
    report['ml_fixture_inference_s']=inference;report['ml_fixture_rows']=len(te)
    Path('docs/benchmarks.json').write_text(json.dumps(report,indent=2)+'\n')
if __name__=='__main__':main()
