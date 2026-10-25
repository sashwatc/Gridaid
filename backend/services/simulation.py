import hashlib
import numpy as np
from backend.services.metrics import nearest_times,sample_metrics,portfolio
from backend.services.ml_inference import normalize


def simulate(configurations,matrices,weights,threshold,trials=10000,seed=42):
    if not 100<=trials<=100000 or not 0<=seed<=2**32-1:
        raise ValueError('invalid trial count or seed')
    results={name:{'scenarios':{}} for name in configurations}
    samples={}
    for sid,t in matrices.items():
        # Scenario-specific deterministic seed: changing portfolio order cannot change its incidents.
        sid_seed=int.from_bytes(hashlib.sha256(sid.encode()).digest()[:4],'big')
        rng=np.random.default_rng(np.random.SeedSequence([seed,sid_seed]))
        probs=normalize(weights[sid])
        sampled=rng.choice(t.shape[1],size=trials,p=probs) if probs.sum() else np.array([],dtype=int)
        samples[sid]=hashlib.sha256(sampled.tobytes()).hexdigest()
        for name,selected in configurations.items():
            results[name]['scenarios'][sid]=sample_metrics(nearest_times(t,selected)[sampled],threshold)
    for result in results.values():
        result['summary']=portfolio(result['scenarios'])
    return {'seed':seed,'trials_requested':trials,'sample_hashes':samples,'configurations':results,
            'statistics':'Unconditional mean/quantiles are null when infinite; reachable_mean_s is explicitly conditional. Histogram excludes unreachable incidents.'}
