"""Directed multigraph Dijkstra and content-addressed matrices, seconds throughout."""
from collections import OrderedDict
from heapq import heappop, heappush
from math import inf
import hashlib
import io
import json
from pathlib import Path
from uuid import uuid4
import numpy as np
from backend.services.data import Dataset, digest, ROOT
from backend.services.scenarios import Scenario, demands_for


def adjacency(data: Dataset, scenario: Scenario):
    closed=set(scenario.closed_edge_ids)
    unknown=closed-{e.id for e in data.edges}
    if unknown or set(scenario.disabled_site_ids)-{c.id for c in data.candidates}:
        raise ValueError('unknown scenario edge or site')
    adj={n.id:[] for n in data.nodes}
    for e in data.edges:
        factor=scenario.edge_multipliers.get(e.id,1)
        if not np.isfinite(factor) or factor < 1 or factor > 5:
            raise ValueError('invalid edge multiplier')
        if e.id not in closed:
            adj[e.u].append((e.v,e.time_s*scenario.multiplier*factor,e.id))
    if set(scenario.edge_multipliers)-{e.id for e in data.edges}:
        raise ValueError('unknown multiplier edge')
    return adj


def dijkstra(adj, source):
    if source not in adj:
        raise ValueError('unknown source')
    distances={n:inf for n in adj}
    distances[source]=0.0
    predecessor={}
    queue=[(0.,source)]
    while queue:
        cost,u=heappop(queue)
        if cost != distances[u]:
            continue
        for v,weight,edge_id in adj[u]:
            if not np.isfinite(weight) or weight < 0:
                raise ValueError('Dijkstra needs finite nonnegative weights')
            alt=cost+weight
            if alt < distances[v]:
                distances[v]=alt
                predecessor[v]=(u,edge_id)
                heappush(queue,(alt,v))
    return distances,predecessor


class MatrixCache:
    def __init__(self, capacity=32, disk=False):
        self.disk=disk
        self.directory=ROOT/'data/processed/matrices'
        self.capacity=capacity
        self.values=OrderedDict()

    def key(self,data,scenario,mode='population',blend=.5,access_mode='connector',access_speed_kph=20):
        # Full contents, including order, geometry, weights and model; never trust a version label alone.
        return digest({'dataset':data.model_dump(),'scenario':scenario.model_dump(),
                       'mode':mode,'blend':blend,'access_mode':access_mode,
                       'access_speed_kph':float(access_speed_kph),'algorithm':'directed-terminal-access-v2'})

    def get(self,data,scenario,mode='population',blend=.5,access_mode='connector',access_speed_kph=20):
        if access_mode not in ('connector','node_only') or not 1<=access_speed_kph<=60:
            raise ValueError('invalid access assumption')
        key=self.key(data,scenario,mode,blend,access_mode,access_speed_kph)
        if key in self.values:
            self.values.move_to_end(key)
            return self.values[key],key
        disk_path=self.directory/f'{key}.npy'
        manifest=self.directory/f'{key}.json'
        if self.disk and disk_path.exists() and manifest.exists():
            try:
                raw=disk_path.read_bytes()
                metadata=json.loads(manifest.read_text())
                if metadata.get('sha256')!=hashlib.sha256(raw).hexdigest():raise ValueError('cache hash mismatch')
                matrix=np.load(io.BytesIO(raw),allow_pickle=False)
                if matrix.shape!=(len(data.candidates),len(demands_for(data,scenario))) or np.isnan(matrix).any() or (matrix<0).any():raise ValueError('invalid cached matrix')
                matrix.setflags(write=False)
                self.values[key]=matrix
                if len(self.values)>self.capacity:self.values.popitem(last=False)
                return matrix,key
            except (ValueError,OSError):
                pass # Corrupt cache is rebuilt from validated input, never trusted.
        adj=adjacency(data,scenario)
        demand=demands_for(data,scenario)
        edges={e.id:e for e in data.edges}
        closed=set(scenario.closed_edge_ids)
        matrix=np.full((len(data.candidates),len(demand)),np.inf)
        for j,c in enumerate(data.candidates):
            if c.id in scenario.disabled_site_ids:
                continue
            distances,_=dijkstra(adj,c.node)
            for i,d in enumerate(demand):
                if d.road_access:
                    # A terminal point on a directed road is reached from its legal upstream
                    # endpoint, plus the traversed fraction. It does not create a through-road.
                    travel=min((distances[edges[a.edge_id].u]+edges[a.edge_id].time_s*a.fraction*
                                scenario.multiplier*scenario.edge_multipliers.get(a.edge_id,1)
                                for a in d.road_access if a.edge_id not in closed),default=inf)
                else:
                    travel=distances[d.node]
                connector=(c.snap_m+d.snap_m)*3.6/access_speed_kph*scenario.multiplier if access_mode=='connector' else 0.
                matrix[j,i]=travel+connector
        matrix.setflags(write=False)
        if self.disk:
            self.directory.mkdir(parents=True,exist_ok=True)
            temporary=self.directory/f'{key}.{uuid4().hex}.tmp'
            with temporary.open('wb') as stream:np.save(stream,matrix,allow_pickle=False)
            metadata={'key':key,'sha256':hashlib.sha256(temporary.read_bytes()).hexdigest()}
            temporary.replace(disk_path)
            temporary.write_text(json.dumps(metadata));temporary.replace(manifest)
            entries=[]
            for path in self.directory.glob('*.npy'):
                try:entries.append((path.stat().st_mtime,path))
                except FileNotFoundError:continue
            for _,old in sorted(entries)[:-64]:
                old.unlink(missing_ok=True);old.with_suffix('.json').unlink(missing_ok=True)
        self.values[key]=matrix
        if len(self.values)>self.capacity:
            self.values.popitem(last=False)
        return matrix,key
