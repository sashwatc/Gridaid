from __future__ import annotations
from pydantic import Field
from backend.services.data import Record, Dataset, Demand


class Scenario(Record):
    id: str
    name: str
    multiplier: float = Field(default=1, ge=1, le=5)
    closed_edge_ids: list[str] = Field(default_factory=list)
    edge_multipliers: dict[str, float] = Field(default_factory=dict)
    disabled_site_ids: list[str] = Field(default_factory=list)
    temporary_demand: list[Demand] = Field(default_factory=list)
    provenance: str = 'synthetic_demo_assumption'
    description: str = ''


def scenario_catalog(data: Dataset,winter_multiplier=1.6,closure_profile='central') -> dict[str, Scenario]:
    if not 1<=winter_multiplier<=3 or closure_profile not in ('central','east'):raise ValueError('unsupported road/weather assumptions')
    nodes={n.id:n for n in data.nodes}
    # Deterministically choose a central corridor; no claim that it is an actual closure.
    if data.id == 'fixture':
        closures=[e.id for e in data.edges if {e.u,e.v} == {'2-1','3-1'}]
    else:
        arterial=[e for e in data.edges if e.road_class.split('_')[0] in ('primary','secondary','trunk')]
        center,south,north=(-90.574,41.52,41.56) if closure_profile=='central' else (-90.53,41.535,41.575)
        corridor=[e for e in arterial if abs((nodes[e.u].lon+nodes[e.v].lon)/2-center)<.004 and south<(nodes[e.u].lat+nodes[e.v].lat)/2<north]
        ranked=sorted(arterial or data.edges,key=lambda e:(abs(nodes[e.u].lat-41.54)+abs(nodes[e.u].lon+90.57),e.id))
        pairs={(e.u,e.v) for e in (corridor or ranked[:20])}
        closures=[e.id for e in data.edges if (e.u,e.v) in pairs or (e.v,e.u) in pairs]
    failed=[data.candidates[0].id]
    box=data.provenance.get('study_bbox_south_west_north_east')
    event_nodes=[n for n in data.nodes if not box or (box[0]<=n.lat<=box[2] and box[1]<=n.lon<=box[3])]
    event_node=max(event_nodes,key=lambda n:(n.lat,n.lon)).id
    event=[Demand(id='temporary-event',node=event_node,population=max(1,sum(d.population for d in data.demands)*.5),risk=sum(d.risk or 0 for d in data.demands)*.5 if data.ml_validated else None)]
    return {s.id:s for s in [
        Scenario(id='normal',name='Normal',description='Unmodified network and demand.'),
        Scenario(id='winter',name='Winter slowdown',multiplier=winter_multiplier,description=f'Assumed {winter_multiplier:g}× travel time on every road and access connector.'),
        Scenario(id='closure',name='Major corridor closure',closed_edge_ids=closures,description='Prepared corridor edges removed in both directions where present.'),
        Scenario(id='resource_failure',name='Resource unavailable',disabled_site_ids=failed,description=f'Fixed location outage: {failed[0]}; no replacement resource.'),
        Scenario(id='event',name='Temporary event',temporary_demand=event,description='Assumed added demand equal to 50% of base total, at a northern network node.'),
        Scenario(id='winter_closure',name='Winter + closure',multiplier=winter_multiplier,closed_edge_ids=closures,description=f'Assumed {winter_multiplier:g}× winter times plus the {closure_profile} arterial closure; no resource outage or event.'),
        Scenario(id='combined',name='Combined stress',multiplier=winter_multiplier,closed_edge_ids=closures,disabled_site_ids=failed,temporary_demand=event,description='Winter, corridor closure, fixed outage and event demand together.')
    ]}


def demands_for(data: Dataset, scenario: Scenario):
    return [*data.demands,*scenario.temporary_demand]
