"""Demand layer gating; no runtime model deserialization."""
import numpy as np
from backend.services.scenarios import demands_for


def normalize(values):
    a=np.asarray(values,dtype=float)
    if not np.all(np.isfinite(a)) or np.any(a<0):
        raise ValueError('Demand must be finite and nonnegative')
    return a/a.sum() if a.sum()>0 else np.zeros_like(a)


def weights_for(data,scenario,mode='population',blend=.5):
    demands=demands_for(data,scenario)
    population=np.array([d.population for d in demands],dtype=float)
    if mode=='population':
        return population
    if mode not in ('ml_risk','blended') or not 0<=blend<=1:
        raise ValueError('unsupported demand mode or blend')
    if not data.ml_validated or not data.model_version or any(d.risk is None for d in demands):
        raise ValueError('ML unavailable: no validated Iowa incident-risk layer (including event risk)')
    risk=normalize([d.risk for d in demands])
    return risk if mode=='ml_risk' else blend*normalize(population)+(1-blend)*risk
