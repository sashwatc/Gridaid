"""Validated, immutable-by-convention study snapshots. All public IDs are strings."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import networkx as nx
from pydantic import BaseModel, ConfigDict, Field, model_validator

ROOT = Path(__file__).resolve().parents[2]


def digest(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()


class Record(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False, frozen=True)


class Node(Record):
    id: str
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class Edge(Record):
    id: str
    u: str
    v: str
    length_m: float = Field(gt=0, le=1_000_000)
    speed_kph: float = Field(gt=0, le=160)
    road_class: str = 'residential'
    speed_source: str = 'modeled_assumption'
    geometry: list[list[float]] = Field(default_factory=list)

    @property
    def time_s(self):
        return self.length_m * 3.6 / self.speed_kph


class EdgeAccess(Record):
    edge_id: str
    fraction: float = Field(ge=0, le=1)


class Demand(Record):
    id: str
    node: str
    population: float = Field(ge=0)
    snap_m: float = Field(default=0, ge=0, le=2000)
    risk: float | None = Field(default=None, ge=0)
    origin_lat: float | None = Field(default=None, ge=-90, le=90)
    origin_lon: float | None = Field(default=None, ge=-180, le=180)
    snap_lat: float | None = Field(default=None, ge=-90, le=90)
    snap_lon: float | None = Field(default=None, ge=-180, le=180)
    community: str | None = None
    road_access: list[EdgeAccess] = Field(default_factory=list, max_length=32)
    legacy_node: str | None = None
    legacy_snap_m: float | None = Field(default=None, ge=0, le=2000)


class Site(Record):
    id: str
    node: str
    label: str
    snap_m: float = Field(default=0, ge=0, le=2000)
    community: str | None = None


class Dataset(Record):
    id: str
    name: str
    version: str
    provenance: dict
    nodes: list[Node] = Field(min_length=2, max_length=100000)
    edges: list[Edge] = Field(min_length=1, max_length=300000)
    demands: list[Demand] = Field(min_length=1, max_length=2000)
    candidates: list[Site] = Field(min_length=1, max_length=150)
    ml_validated: bool = False
    model_version: str | None = None

    @model_validator(mode='after')
    def check_integrity(self):
        for records in (self.nodes, self.edges, self.demands, self.candidates):
            ids = [x.id for x in records]
            if len(ids) != len(set(ids)):
                raise ValueError('duplicate IDs')
        nodes = {n.id for n in self.nodes}
        if any(e.u not in nodes or e.v not in nodes for e in self.edges):
            raise ValueError('unknown edge endpoint')
        if any(x.node not in nodes for x in [*self.demands, *self.candidates]):
            raise ValueError('unknown snapped node')
        edges = {e.id for e in self.edges}
        for d in self.demands:
            if any(a.edge_id not in edges for a in d.road_access):
                raise ValueError('unknown demand access edge')
            for lat, lon in ((d.origin_lat, d.origin_lon), (d.snap_lat, d.snap_lon)):
                if (lat is None) != (lon is None):
                    raise ValueError('coordinate pair must be complete')
        from shapely.geometry import LineString
        if any(e.geometry and (len(e.geometry) < 2 or not LineString(e.geometry).is_valid
                               or any(len(p) != 2 or not -180 <= p[0] <= 180 or not -90 <= p[1] <= 90 for p in e.geometry)) for e in self.edges):
            raise ValueError('invalid WGS84 geometry')
        return self

    def quality(self):
        g = nx.MultiDiGraph()
        g.add_nodes_from(n.id for n in self.nodes)
        g.add_edges_from((e.u, e.v) for e in self.edges)
        return {'nodes': len(self.nodes), 'directed_edges': len(self.edges),
                'weak_components': nx.number_weakly_connected_components(g),
                'strong_components': nx.number_strongly_connected_components(g),
                'max_demand_snap_m': max(d.snap_m for d in self.demands),
                'max_candidate_snap_m': max(c.snap_m for c in self.candidates),
                'population_total': sum(d.population for d in self.demands),
                'speed_assumptions': sum(e.speed_source == 'modeled_assumption' for e in self.edges)}


def load_dataset(dataset_id: str) -> Dataset:
    if dataset_id not in ('fixture', 'iowa','quad_cities'):
        raise ValueError('unknown dataset')
    path = ROOT / ('data/demo/fixture.json' if dataset_id == 'fixture' else f'data/processed/{dataset_id}.json')
    if not path.exists():
        import gzip
        snapshot=ROOT/f'data/public/{dataset_id}.json.gz'
        if dataset_id in ('iowa','quad_cities') and snapshot.exists():
            return Dataset.model_validate_json(gzip.decompress(snapshot.read_bytes()))
        raise ValueError('Public Iowa dataset unavailable; run scripts/ingest.py')
    return Dataset.model_validate_json(path.read_text())
