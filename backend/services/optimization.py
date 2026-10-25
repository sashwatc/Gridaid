from time import perf_counter
import numpy as np
from ortools.linear_solver import pywraplp

STATUS={pywraplp.Solver.OPTIMAL:'optimal',pywraplp.Solver.FEASIBLE:'feasible',
        pywraplp.Solver.INFEASIBLE:'infeasible',pywraplp.Solver.UNBOUNDED:'unbounded',
        pywraplp.Solver.ABNORMAL:'abnormal',pywraplp.Solver.NOT_SOLVED:'not_solved'}


def validate_problem(matrix,weights,p):
    t=np.asarray(matrix,dtype=float); w=np.asarray(weights,dtype=float)
    if t.ndim!=2 or w.shape!=(t.shape[1],) or not 1<=p<=t.shape[0]:
        raise ValueError('infeasible resource count or matrix dimensions')
    if np.isnan(t).any() or (t<0).any() or not np.isfinite(w).all() or (w<0).any():
        raise ValueError('invalid travel or demand')
    return t,w


def coverage_value(t,w,selected,threshold):
    return float(w[np.min(t[selected],axis=0)<=threshold].sum()) if selected else 0.


def penalty_matrix(t):
    finite=t[np.isfinite(t)]
    penalty=max(86400., float(finite.max())+3600 if finite.size else 86400.)
    return np.where(np.isfinite(t),t,penalty),penalty


def baseline(t,w,p,threshold,method='deterministic',seed=42):
    t,w=validate_problem(t,w,p)
    start=perf_counter()
    if method=='deterministic': selected=list(range(p))
    elif method=='random': selected=sorted(np.random.default_rng(seed).choice(len(t),p,replace=False).tolist())
    elif method=='greedy':
        selected=[]
        for _ in range(p):
            selected.append(max((j for j in range(len(t)) if j not in selected),
                                key=lambda j:(coverage_value(t,w,[*selected,j],threshold),-j)))
    else: raise ValueError('unknown baseline')
    return dict(selected=selected,status='heuristic',objective=coverage_value(t,w,selected,threshold),
                objective_unit='weighted_covered_demand',runtime_s=perf_counter()-start,bound=None,gap=None,method=method)


def solve_static(t,w,p,threshold,objective='coverage',time_limit_ms=2000):
    t,w=validate_problem(t,w,p)
    if objective not in ('coverage','p_median') or not 1<=time_limit_ms<=10000:
        raise ValueError('unsupported objective or solver limit')
    start=perf_counter()
    solver=pywraplp.Solver.CreateSolver('SCIP')
    solver.SetNumThreads(1)
    solver.SetTimeLimit(time_limit_ms)
    x=[solver.BoolVar(f'x{j}') for j in range(len(t))]
    solver.Add(sum(x)==p)
    penalty=None
    if objective=='coverage':
        z=[solver.BoolVar(f'z{i}') for i in range(len(w))]
        for i in range(len(w)):
            solver.Add(z[i]<=sum(x[j] for j in range(len(t)) if t[j,i]<=threshold))
        solver.Maximize(sum(float(w[i])*z[i] for i in range(len(w))))
    else:
        costs,penalty=penalty_matrix(t)
        terms=[]
        for i in range(len(w)):
            y=[solver.BoolVar(f'y{j}_{i}') for j in range(len(t))]
            solver.Add(sum(y)==1)
            for j in range(len(t)):
                solver.Add(y[j]<=x[j])
                terms.append(float(w[i]*costs[j,i])*y[j])
        solver.Minimize(sum(terms))
    status=STATUS.get(solver.Solve(),'abnormal')
    return solver_result(solver,x,status,start,'static_'+objective,
                         'weighted_covered_demand' if objective=='coverage' else 'weighted_seconds_with_unreachable_penalty',penalty)


def solver_result(solver,x,status,start,method,unit,penalty=None):
    has_solution=status in ('optimal','feasible')
    value=solver.Objective().Value() if has_solution else None
    bound=solver.Objective().BestBound() if has_solution else None
    if bound is not None and not np.isfinite(bound): bound=None
    gap=abs(value-bound)/max(1.,abs(value)) if value is not None and bound is not None else None
    return dict(selected=[j for j,v in enumerate(x) if v.solution_value()>.5] if has_solution else [],
                status=status,objective=value,objective_unit=unit,runtime_s=perf_counter()-start,
                bound=bound,gap=gap,method=method,unreachable_penalty_s=penalty)
