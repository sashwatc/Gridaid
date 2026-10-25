from itertools import combinations
import copy
import numpy as np
import networkx as nx
import pytest
from backend.services.data import Dataset, load_dataset, Edge
from backend.services.routing import dijkstra,adjacency,MatrixCache
from backend.services.scenarios import Scenario,scenario_catalog,demands_for
from backend.services.optimization import solve_static,baseline,coverage_value,penalty_matrix,STATUS
from backend.services.resilience import solve_resilient
from backend.services.metrics import deterministic_metrics,sample_metrics
from backend.services.simulation import simulate
from backend.services.ml_inference import weights_for,normalize


def test_hand_graph_parallel_one_way_disconnected_and_units():
    assert Edge(id='e',u='a',v='b',length_m=1000,speed_kph=60).time_s==60
    adj={'a':[('b',120,'slow'),('b',60,'fast'),('c',300,'direct')], 'b':[('c',30,'bc')], 'c':[], 'island':[]}
    d,p=dijkstra(adj,'a')
    assert d=={'a':0,'b':60,'c':90,'island':np.inf}
    assert p['b']==('a','fast')
    assert dijkstra(adj,'c')[0]['a']==np.inf
    closed=copy.deepcopy(adj); closed['a']=closed['a'][:1]+closed['a'][2:]
    assert dijkstra(closed,'a')[0]['c']==150
    assert adj['a'][1][2]=='fast'


def test_custom_all_pairs_matches_networkx_and_scenarios_immutable():
    data=load_dataset('fixture'); before=data.model_dump_json()
    for scenario in scenario_catalog(data).values():
        adj=adjacency(data,scenario)
        g=nx.MultiDiGraph(); g.add_nodes_from(adj)
        for u,edges in adj.items():
            for v,t,e in edges:g.add_edge(u,v,key=e,weight=t)
        for source in adj:
            custom,_=dijkstra(adj,source)
            ref=nx.single_source_dijkstra_path_length(g,source)
            for n in adj:assert custom[n]==pytest.approx(ref.get(n,np.inf))
    assert data.model_dump_json()==before


def test_cache_all_content_inputs_and_read_only():
    data=load_dataset('fixture'); catalog=scenario_catalog(data); cache=MatrixCache()
    t,key=cache.get(data,catalog['normal'])
    assert cache.get(data,catalog['normal'])[0] is t
    closure,key2=cache.get(data,catalog['closure']); assert key!=key2
    altered=data.model_copy(update={'edges':[data.edges[0].model_copy(update={'speed_kph':15}),*data.edges[1:]]})
    assert cache.get(altered,catalog['normal'])[1]!=key
    altered=data.model_copy(update={'candidates':list(reversed(data.candidates))})
    assert cache.get(altered,catalog['normal'])[1]!=key
    altered=data.model_copy(update={'demands':[data.demands[0].model_copy(update={'population':999}),*data.demands[1:]]})
    assert cache.get(altered,catalog['normal'])[1]!=key
    assert cache.get(data,catalog['winter'])[1]!=key
    assert cache.get(data,catalog['normal'],'blended',.4)[1]!=key
    with pytest.raises(ValueError):t[0,0]=9


def test_all_56_static_configurations_both_objectives():
    rng=np.random.default_rng(18)
    t=rng.integers(0,900,(8,13)).astype(float); t[:,12]=np.inf
    w=rng.integers(0,20,13).astype(float)
    configs=list(combinations(range(8),3)); assert len(configs)==56
    coverage=max(sum(w[i] for i in range(13) if min(t[j,i] for j in c)<=300) for c in configs)
    cost,penalty=penalty_matrix(t)
    median=min(sum(w[i]*min(cost[j,i] for j in c) for i in range(13)) for c in configs)
    for objective,expected in [('coverage',coverage),('p_median',median)]:
        result=solve_static(t,w,3,300,objective)
        assert result['status']=='optimal';assert len(set(result['selected']))==3
        assert result['objective']==pytest.approx(expected)
        assert result['bound']==pytest.approx(expected);assert result['gap']<1e-8
    assert solve_static(t,w,3,300,'p_median')['unreachable_penalty_s']==penalty
    for method in ('deterministic','random','greedy'):
        r=baseline(t,w,3,300,method);assert len(set(r['selected']))==3;assert r['objective']<=coverage
    assert baseline(t,w,3,300,'random')['selected']==baseline(t,w,3,300,'random')['selected']


def test_resilience_matches_bruteforce_and_demand_scale_invariant():
    rng=np.random.default_rng(9)
    matrices=[rng.integers(0,600,(8,7)).astype(float) for _ in range(3)]
    matrices[1][0]=np.inf
    weights=[rng.integers(1,30,7).astype(float) for _ in range(3)]
    def score(c,ws):
        cover=[sum(w[i] for i in range(7) if min(t[j,i] for j in c)<=180)/sum(w) for t,w in zip(matrices,ws)]
        return .6*np.mean(cover)+.4*min(cover)
    expected=max(score(c,weights) for c in combinations(range(8),3))
    for ws in (weights,[weights[0]*1000,weights[1]*.001,weights[2]]):
        r=solve_resilient(matrices,ws,3,180)
        assert r['status']=='optimal';assert r['objective']==pytest.approx(expected)
        assert score(r['selected'],ws)==pytest.approx(expected)


def test_fragile_bridge_actual_network_tradeoff():
    # A central bridge-dependent site reaches all demand in normal. A west site reaches
    # 60% under either state; the east-side candidate reaches only 40%.
    data=Dataset.model_validate(dict(id='toy',name='Bridge',version='1',provenance={},
        nodes=[dict(id=x,lat=41,lon=-90+i*.01) for i,x in enumerate(['center','west','east'])],
        edges=[dict(id='cw',u='center',v='west',length_m=100,speed_kph=36),
               dict(id='ce',u='center',v='east',length_m=100,speed_kph=36),
               dict(id='wc',u='west',v='center',length_m=1000,speed_kph=36)],
        candidates=[dict(id=x,node=x,label=x) for x in ['center','west','east']],
        demands=[dict(id='w',node='west',population=60),dict(id='e',node='east',population=40)]))
    cache=MatrixCache(); normal=Scenario(id='normal',name='Normal'); closure=Scenario(id='closure',name='Bridge closed',closed_edge_ids=['cw','ce'])
    ts=[cache.get(data,s)[0] for s in [normal,closure]];ws=[np.array([60.,40.])]*2
    static=solve_static(ts[0],ws[0],1,20);robust=solve_resilient(ts,ws,1,20)
    assert static['selected']==[0];assert robust['selected']==[1]
    assert coverage_value(ts[0],ws[0],static['selected'],20)==100
    assert coverage_value(ts[0],ws[0],robust['selected'],20)==60
    assert coverage_value(ts[1],ws[1],static['selected'],20)==0
    assert coverage_value(ts[1],ws[1],robust['selected'],20)==60


def test_failures_events_zero_unreachable_threshold_and_statistics():
    data=load_dataset('fixture');catalog=scenario_catalog(data);cache=MatrixCache()
    normal=cache.get(data,catalog['normal'])[0];fail=cache.get(data,catalog['resource_failure'])[0]
    assert np.isinf(fail[0]).all();assert np.isfinite(normal[0]).any()
    assert len(demands_for(data,catalog['event']))==len(data.demands)+1
    assert sum(weights_for(data,catalog['event']))>sum(weights_for(data,catalog['normal']))
    t=np.array([[60.,120.,np.inf]]);w=np.array([1.,1.,2.])
    m=deterministic_metrics(t,w,[0],120)
    assert m['coverage']==.5 and m['unreachable_share']==.5 and m['mean_s'] is None
    assert m['reachable_mean_s']==90
    assert deterministic_metrics(t,w,[0],119.99)['coverage']==.25
    assert deterministic_metrics(t,np.zeros(3),[0],120)['no_demand']
    samples=np.arange(1,101,dtype=float)
    s=sample_metrics(samples,60)
    assert s['mean_s']==50.5;assert s['median_s']==50.5
    assert s['p90_s']==pytest.approx(np.quantile(samples,.9));assert s['p95_s']==pytest.approx(np.quantile(samples,.95));assert s['coverage']==.6
    assert sample_metrics([0,np.inf],60)['p95_s'] is None


def test_simulation_reproducible_paired_failure_and_portfolio_order():
    matrices={'normal':np.array([[0.,60.,np.inf],[120.,np.inf,0.]]),'failure':np.array([[np.inf]*3,[120.,np.inf,0.]])}
    w={k:np.array([1.,2.,1.]) for k in matrices}
    configs={'a':[0],'same':[0],'both':[0,1]}
    result=simulate(configs,matrices,w,60)
    assert result==simulate(configs,matrices,w,60)
    assert result['configurations']['a']==result['configurations']['same']
    assert result['configurations']['a']['scenarios']['failure']['unreachable_share']==1
    assert result['configurations']['both']['scenarios']['normal']['coverage']==1
    assert result['sample_hashes']==simulate(configs,dict(reversed(list(matrices.items()))),w,60)['sample_hashes']
    zero=simulate(configs,matrices,{k:np.zeros(3) for k in matrices},60)
    assert zero['configurations']['a']['scenarios']['normal']['incidents']==0


def test_invalid_and_timeout_status():
    with pytest.raises(ValueError):solve_static(np.ones((2,3)),np.ones(3),3,60)
    with pytest.raises(ValueError):solve_resilient([np.ones((2,3))],[np.ones(3)],1,60,.7,.4)
    with pytest.raises(ValueError):solve_static(np.full((2,3),np.nan),np.ones(3),1,60)
    assert {'optimal','feasible','not_solved','infeasible'}.issubset(set(STATUS.values()))
    rng=np.random.default_rng(1)
    r=solve_static(rng.uniform(0,100,(100,200)),np.ones(200),10,10,'p_median',time_limit_ms=1)
    assert r['status'] in ('optimal','feasible','not_solved')
    if r['status']=='not_solved':assert r['objective'] is None and r['selected']==[]


def test_data_validation():
    data=load_dataset('fixture').model_dump()
    data['nodes'].append(data['nodes'][0])
    with pytest.raises(ValueError):Dataset.model_validate(data)
    with pytest.raises(ValueError):Edge(id='a',u='a',v='b',length_m=100,speed_kph=float('nan'))
    assert normalize([0,0]).tolist()==[0,0]
    with pytest.raises(ValueError):weights_for(load_dataset('fixture'),Scenario(id='n',name='N'),'ml_risk')
