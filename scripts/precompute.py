from backend.services.data import load_dataset
from backend.services.routing import MatrixCache
from backend.services.scenarios import scenario_catalog

if __name__=='__main__':
    for name in ['fixture','iowa']:
        data=load_dataset(name);cache=MatrixCache(disk=True)
        for sid,s in scenario_catalog(data).items():
            t,key=cache.get(data,s)
            print(name,sid,t.shape,key[:16],flush=True)
