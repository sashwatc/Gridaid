from time import perf_counter
from ortools.linear_solver import pywraplp
from backend.services.optimization import validate_problem, solver_result, STATUS
from backend.services.ml_inference import normalize


def solve_resilient(matrices,weights,p,threshold,average_weight=.6,worst_case_weight=.4,time_limit_ms=2000):
    if not matrices or len(matrices)!=len(weights) or abs(average_weight+worst_case_weight-1)>1e-8 or min(average_weight,worst_case_weight)<0:
        raise ValueError('invalid scenario portfolio or weights')
    for t,w in zip(matrices,weights): validate_problem(t,w,p)
    if len({t.shape[0] for t in matrices})!=1 or not 1<=time_limit_ms<=10000:
        raise ValueError('inconsistent candidates or time limit')
    start=perf_counter()
    solver=pywraplp.Solver.CreateSolver('SCIP'); solver.SetNumThreads(1); solver.SetTimeLimit(time_limit_ms)
    x=[solver.BoolVar(f'x{j}') for j in range(len(matrices[0]))]
    solver.Add(sum(x)==p)
    worst=solver.NumVar(0,1,'worst')
    coverages=[]
    for s,(t,w) in enumerate(zip(matrices,weights)):
        w=normalize(w)
        z=[solver.BoolVar(f'z{s}_{i}') for i in range(len(w))]
        for i in range(len(w)):
            solver.Add(z[i]<=sum(x[j] for j in range(len(x)) if t[j,i]<=threshold))
        coverage=sum(float(w[i])*z[i] for i in range(len(w)))
        solver.Add(worst<=coverage)
        coverages.append(coverage)
    solver.Maximize(average_weight/len(matrices)*sum(coverages)+worst_case_weight*worst)
    status=STATUS.get(solver.Solve(),'abnormal')
    return solver_result(solver,x,status,start,'shared_resilient','normalized_coverage_score')
