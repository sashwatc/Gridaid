"""Rebuild the clearly synthetic two-corridor fixture, no downloads."""
from pathlib import Path
from backend.services.data import Dataset, digest


def build():
    nodes = [{'id': f'{x}-{y}', 'lat': 41.51 + y*.012, 'lon': -90.64 + x*.016} for x in range(6) for y in range(5)]
    edges = []
    for x in range(6):
        for y in range(5):
            for dx,dy in ((1,0),(0,1)):
                a,b=f'{x}-{y}',f'{x+dx}-{y+dy}'
                if x+dx >= 6 or y+dy >= 5 or (x == 2 and dx and y not in (1,4)):
                    continue
                for u,v in ((a,b),(b,a)):
                    edges.append({'id':f'{u}>{v}', 'u':u,'v':v,'length_m':1000,'speed_kph':30})
    # A parallel slower edge and one-way shortcut exercise directed multigraph behavior.
    edges += [{'id':'slow_parallel','u':'0-0','v':'1-0','length_m':1500,'speed_kph':20},
              {'id':'one_way','u':'0-0','v':'0-2','length_m':1600,'speed_kph':40}]
    candidates=[{'id':f'C{i+1}','node':node,'label':f'Assumed site {i+1}'} for i,node in enumerate(['0-0','1-1','2-3','2-1','3-1','4-3','5-0','5-4'])]
    demands=[{'id':f'D{i+1}','node':n['id'],'population':float(10+(i*17)%80)} for i,n in enumerate(nodes)]
    data=dict(id='fixture',name='Davenport-shaped synthetic corridor laboratory',version='fixture-v1',
              provenance={'kind':'synthetic_fixture','source':'scripts/make_fixture.py','license':'project fixture; no observed population or roads',
                          'crs':'EPSG:4326','assumptions':'All roads, population, sites and disruptions are invented; coordinates locate the demonstration only.'},
              nodes=nodes,edges=edges,demands=demands,candidates=candidates)
    data['version']=digest(data)[:16]
    return Dataset.model_validate(data)

if __name__ == '__main__':
    Path('data/demo/fixture.json').write_text(build().model_dump_json(indent=2)+'\n')
