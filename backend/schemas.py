from enum import StrEnum
from typing import Annotated,Literal
from pydantic import BaseModel,ConfigDict,Field,model_validator
from backend.services.data import Dataset
from backend.services.scenarios import Scenario

class Strict(BaseModel):
    model_config=ConfigDict(extra='forbid',allow_inf_nan=False,strict=True)

class DatasetID(StrEnum):
    fixture='fixture'
    iowa='iowa'
    quad_cities='quad_cities'

ScenarioID=Literal['normal','winter','closure','resource_failure','event','combined','winter_closure']
class PlanRequest(Strict):
    dataset: Literal['fixture','iowa','quad_cities']='fixture'
    resource_count: int=Field(default=3,ge=1,le=25)
    threshold_minutes: float=Field(default=5,ge=1,le=60)
    objective: Literal['coverage','p_median']='coverage'
    method: Literal['exact','greedy']='exact'
    demand_model: Literal['population','ml_risk','blended']='population'
    blend: float=Field(default=.5,ge=0,le=1)
    scenario_ids: list[ScenarioID]=Field(default_factory=lambda:['normal','winter','closure','resource_failure','event','combined'],min_length=1,max_length=7)
    average_weight: float=Field(default=.6,ge=0,le=1)
    worst_case_weight: float=Field(default=.4,ge=0,le=1)
    seed: int=Field(default=42,ge=0,le=2**32-1)
    solver_limit_ms: int=Field(default=2000,ge=1,le=5000)
    baseline_method: Literal['deterministic','random','greedy']='deterministic'
    winter_multiplier: float=Field(default=1.6,ge=1,le=3)
    closure_profile: Literal['central','east']='central'
    access_mode: Literal['connector','node_only']='connector'
    access_speed_kph: float=Field(default=20.0,ge=1,le=60)
    focus_bounds: list[float]|None=Field(default=None,min_length=4,max_length=4)
    focus_city_ids: list[str]=Field(default_factory=list,max_length=5)

    @model_validator(mode='after')
    def valid(self):
        if self.focus_bounds:
            s,w,n,e=self.focus_bounds
            if not(-90<=s<n<=90 and -180<=w<e<=180):raise ValueError('Invalid area bounds')
        if len(set(self.focus_city_ids))!=len(self.focus_city_ids):raise ValueError('Duplicate city selection')
        if len(set(self.scenario_ids))!=len(self.scenario_ids):raise ValueError('duplicate scenario IDs')
        if abs(self.average_weight+self.worst_case_weight-1)>1e-8:raise ValueError('resilience weights must sum to one')
        if self.objective=='p_median' and self.method=='greedy':raise ValueError('greedy supports coverage only')
        return self

class CompareRequest(Strict):
    run_ids:list[Annotated[str,Field(pattern=r'^[0-9a-f]{32}$')]]=Field(min_length=1,max_length=3)
    @model_validator(mode='after')
    def unique(self):
        if len(set(self.run_ids))!=len(self.run_ids):raise ValueError('duplicate run IDs')
        return self

class SimulationRequest(CompareRequest):
    trials:int=Field(default=10000,ge=100,le=100000)
    seed:int=Field(default=42,ge=0,le=2**32-1)

class SolverInfo(Strict):
    selected:list[int]
    status:Literal['optimal','feasible','heuristic','infeasible','unbounded','abnormal','not_solved']
    objective:float|None
    objective_unit:str
    runtime_s:float
    bound:float|None
    gap:float|None
    method:str
    unreachable_penalty_s:float|None=None

class Metric(Strict):
    coverage:float
    total_weight:float
    no_demand:bool
    unreachable_share:float
    mean_s:float|None
    reachable_mean_s:float|None
    median_s:float|None
    p90_s:float|None
    p95_s:float|None

class Summary(Strict):
    average_coverage:float
    minimum_coverage:float
    worst_scenario:str
    resilience_score:float

class SiteExplanation(Strict):
    site_id:str
    unique_weight:float
    unique_fraction:float
    marginal_in_order_weight:float
    redundant_weight:float
    weak_demand_ids:list[str]
    normal_contribution:float
    worst_case_contribution:float
    best_scenario:str
    scenario_contributions:dict[str,float]
    selection_stability:float

class Explanation(Strict):
    definitions:dict[str,str]
    sites:list[SiteExplanation]
    stability_reference_status:dict[str,str]

class DemandAccess(Strict):
    demand_id:str
    time_s:float|None
    covered:bool
    weight:float

class Run(Strict):
    run_id:str
    created_at:str
    kind:Literal['baseline','static','resilient']
    configuration:PlanRequest
    dataset_version:str
    model_version:str|None
    selected_site_ids:list[str]
    solver:SolverInfo
    demand_access:dict[str,list[DemandAccess]]
    metrics:dict[str,Metric]
    summary:Summary
    scenario_definitions:dict[str,Scenario]
    matrix_keys:dict[str,str]
    explanation:Explanation

class Comparison(Strict):
    runs:list[Run]

class Histogram(Strict):
    upper_seconds:list[float|None]
    counts:list[int]

class SampleMetric(Strict):
    incidents:int
    coverage:float
    unreachable_share:float
    mean_s:float|None
    median_s:float|None
    p90_s:float|None
    p95_s:float|None
    reachable_mean_s:float|None
    histogram:Histogram

class SimConfiguration(Strict):
    scenarios:dict[str,SampleMetric]
    summary:Summary

class Simulation(Strict):
    seed:int
    trials_requested:int
    sample_hashes:dict[str,str]
    configurations:dict[str,SimConfiguration]
    statistics:str
    runs:list[Run]
    simulation_id:str

class Study(Strict):
    dataset:Dataset
    scenarios:list[Scenario]
    quality:dict[str,int|float]
    available_datasets:list[str]

class Health(Strict):
    status:str
    version:str

class DemandLayer(Strict):
    id:str
    available:bool
    reason:str|None=None

class DemandLayers(Strict):
    layers:list[DemandLayer]

class MLCard(Strict):
    available_for_iowa:bool
    status:str
    model_version:str|None
    reason:str
    evaluation:dict|None
    fixture_report:dict|None

class RiskPoint(Strict):
    demand_id:str
    predicted_count:float
    normalized_risk:float

class RiskLayer(Strict):
    available:bool
    model_version:str|None
    forecast_period:str|None
    reason:str
    values:list[RiskPoint]

class DemoPreset(Strict):
    id:str
    label:str
    dataset_version:str
    description:str
    configuration:PlanRequest

class PointRouteRequest(Strict):
    dataset:Literal['fixture','iowa','quad_cities']='quad_cities'
    run_id:Annotated[str,Field(pattern=r'^[0-9a-f]{32}$')]|None=None
    lat:float=Field(ge=-90,le=90)
    lon:float=Field(ge=-180,le=180)
    scenario_id:ScenarioID='normal'
    direction:Literal['to_resource','from_resource']='to_resource'
    focus_bounds:list[float]|None=Field(default=None,min_length=4,max_length=4)
    focus_city_ids:list[str]=Field(default_factory=list,max_length=5)
