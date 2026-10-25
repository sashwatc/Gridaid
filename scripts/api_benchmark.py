"""Measure real local HTTP latency including validation, worker startup, caches and explanations."""
import json
from pathlib import Path
from time import perf_counter
import httpx

if __name__=='__main__':
    config={'dataset':'iowa','resource_count':3,'threshold_minutes':5.0,'demand_model':'population'}
    report={'origin':'http://127.0.0.1:8000','configuration':config,'warm_cache':True,'operations':{}}
    runs=[]
    with httpx.Client(base_url=report['origin'],timeout=30) as client:
        for kind,path in [('baseline','/api/baseline'),('static','/api/optimize/static'),('resilient','/api/optimize/resilient')]:
            start=perf_counter();response=client.post(path,json=config);response.raise_for_status();run=response.json();elapsed=perf_counter()-start
            runs.append(run['run_id']);report['operations'][kind]={'http_seconds':elapsed,'solver_seconds':run['solver']['runtime_s'],'solver_status':run['solver']['status']}
        start=perf_counter();response=client.post('/api/simulate',json={'run_ids':runs,'trials':10000,'seed':42});response.raise_for_status()
        report['operations']['simulate_10000']={'http_seconds':perf_counter()-start}
    Path('docs/api_benchmarks.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
