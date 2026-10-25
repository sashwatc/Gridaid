import numpy as np
from backend.services.metrics import nearest_times
from backend.services.ml_inference import normalize
from backend.services.optimization import solve_static
from backend.services.scenarios import demands_for


def explain(data,scenarios,matrices,weights,selected,threshold,p,time_limit_ms=300):
    references={sid:solve_static(matrices[sid],weights[sid],p,threshold,time_limit_ms=time_limit_ms) for sid in scenarios}
    sites=[]
    normal='normal';tn=matrices[normal];wn=weights[normal]
    total=float(wn.sum());covered=tn[selected]<=threshold
    counts=covered.sum(axis=0) if selected else np.zeros(len(wn))
    before=np.zeros(len(wn),bool)
    for position,j in enumerate(selected):
        cover=covered[position]
        unique=float(wn[cover & (counts==1)].sum())
        contributions={}
        for sid in scenarios:
            t=matrices[sid];w=normalize(weights[sid])
            full=nearest_times(t,selected)<=threshold
            minus=nearest_times(t,[k for k in selected if k!=j])<=threshold
            contributions[sid]=float(w[full & ~minus].sum())
        normal_fraction=unique/total if total else 0.
        full_coverages=[float(normalize(weights[sid])[nearest_times(matrices[sid],selected)<=threshold].sum()) for sid in scenarios]
        minus_coverages=[float(normalize(weights[sid])[nearest_times(matrices[sid],[k for k in selected if k!=j])<=threshold].sum()) for sid in scenarios]
        sites.append({'site_id':data.candidates[j].id,'unique_weight':unique,'unique_fraction':normal_fraction,
            'marginal_in_order_weight':float(wn[cover & ~before].sum()),'redundant_weight':float(wn[cover & (counts>1)].sum()),
            'weak_demand_ids':[d.id for i,d in enumerate(data.demands) if cover[i] and tn[j,i]>threshold*.5],
            'normal_contribution':normal_fraction,'worst_case_contribution':min(full_coverages)-min(minus_coverages),
            'scenario_contributions':contributions,'best_scenario':max(contributions,key=contributions.get),
            'selection_stability':sum(j in r['selected'] for r in references.values())/len(references)})
        before|=cover
    return {'sites':sites,'stability_reference_status':{s:r['status'] for s,r in references.items()},'definitions':{
        'unique':'Normal weighted demand within threshold covered by this site alone in the final configuration.',
        'marginal':'Normal incremental coverage when inserting sites in reported order; order dependent, unlike unique coverage.',
        'redundancy':'Normal weighted demand covered by this site and at least one other selected site. Counts can overlap across sites.',
        'weak_areas':'Covered demand with travel above half the threshold from this site.',
        'worst_case_contribution':'Minimum portfolio coverage minus minimum coverage after removing the site; worst scenario may change.',
        'stability':'Fraction of separate scenario coverage solves selecting this site. Tie- and solver-status dependent; not physical availability or a probability.',
        'contributions':'Normalized coverage lost on removal, without replacement; no causal or operational-outcome claim.'}}
