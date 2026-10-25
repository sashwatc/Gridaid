import numpy as np


def safe(value):
    return float(value) if value is not None and np.isfinite(value) else None


def nearest_times(t,selected):
    return np.min(t[selected],axis=0) if selected else np.full(t.shape[1],np.inf)


def weighted_quantile(times,weights,q):
    positive=weights>0
    if not positive.any(): return None
    values=times[positive]; weights=weights[positive]
    order=np.argsort(values,kind='stable')
    index=min(int(np.searchsorted(np.cumsum(weights[order])/weights.sum(),q,side='left')),len(values)-1)
    return safe(values[order][index])


def deterministic_metrics(t,w,selected,threshold):
    times=nearest_times(t,selected)
    total=float(w.sum())
    reachable=np.isfinite(times)
    reached=float(w[reachable].sum())
    return {'coverage':float(w[times<=threshold].sum()/total) if total else 0.,
            'total_weight':total,'no_demand':not bool(total),
            'unreachable_share':float(w[~reachable].sum()/total) if total else 0.,
            'mean_s':safe(np.dot(times[w>0],w[w>0])/total) if total else None,
            'reachable_mean_s':float(np.dot(times[reachable],w[reachable])/reached) if reached else None,
            'median_s':weighted_quantile(times,w,.5),'p90_s':weighted_quantile(times,w,.9),'p95_s':weighted_quantile(times,w,.95)}


def portfolio(metrics):
    coverages={k:v['coverage'] for k,v in metrics.items()}
    worst=min(coverages,key=coverages.get)
    return {'average_coverage':float(np.mean(list(coverages.values()))),'minimum_coverage':coverages[worst],
            'worst_scenario':worst,'resilience_score':.6*float(np.mean(list(coverages.values())))+.4*coverages[worst]}


def sample_quantile(times,q):
    if not len(times): return None
    ordered=np.sort(times)
    index=(len(times)-1)*q
    lo=int(np.floor(index)); hi=int(np.ceil(index))
    if not np.isfinite(ordered[hi]): return None
    return float(ordered[lo]+(ordered[hi]-ordered[lo])*(index-lo))


def sample_metrics(times,threshold):
    times=np.asarray(times,float)
    finite=times[np.isfinite(times)]
    n=len(times)
    counts,bins=np.histogram(finite,bins=[0,60,120,300,600,1200,3600,np.inf])
    return {'incidents':n,'coverage':float(np.mean(times<=threshold)) if n else 0.,
            'unreachable_share':float(np.mean(~np.isfinite(times))) if n else 0.,
            'mean_s':safe(np.mean(times)) if n else None,
            'median_s':sample_quantile(times,.5),'p90_s':sample_quantile(times,.9),'p95_s':sample_quantile(times,.95),
            'reachable_mean_s':float(finite.mean()) if len(finite) else None,
            'histogram':{'upper_seconds':[60,120,300,600,1200,3600,None],'counts':counts.tolist()}}
