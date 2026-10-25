"""Reapply deterministic original-point/road attachment audit without retraining ML."""
import gzip
import json
from pathlib import Path
from backend.services.data import load_dataset,Dataset
from backend.services.geography import attach_points
from scripts.ingest import acquire


def prepare_geography(data):
    census,_=acquire('census2020_scott','https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/6/query',params={'where':"STATE='19' AND COUNTY='163'",'outFields':'GEOID,POP100,INTPTLAT,INTPTLON','outSR':'4326','f':'geojson','returnGeometry':'true'})
    places,meta=acquire('census2020_study_places_expanded','https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/26/query',params={'where':"STATE='19'",'geometry':'-90.75,41.45,-90.47,41.64','geometryType':'esriGeometryEnvelope','inSR':'4326','outSR':'4326','spatialRel':'esriSpatialRelIntersects','outFields':'NAME,GEOID','f':'geojson','returnGeometry':'true'})
    updated,report=attach_points(data,census,places)
    report['places_source']=meta
    coords=[p for e in data.edges for p in e.geometry]
    report['routing_graph_geometry_bounds_west_south_east_north']=[min(p[0] for p in coords),min(p[1] for p in coords),max(p[0] for p in coords),max(p[1] for p in coords)]
    Dataset.model_validate(updated.model_dump())
    Path('docs/geography_audit.json').write_text(json.dumps(report,indent=2)+'\n')
    return updated

if __name__=='__main__':
    data=prepare_geography(load_dataset('iowa'))
    Path('data/processed/iowa.json').write_text(data.model_dump_json())
    Path('data/public/iowa.json.gz').write_bytes(gzip.compress(data.model_dump_json().encode(),mtime=0))
    Path('docs/iowa_manifest.json').write_text(json.dumps(data.provenance,indent=2)+'\n')
    Path('docs/iowa_quality.json').write_text(json.dumps(data.quality(),indent=2)+'\n')
    print(json.dumps(data.provenance['geography'],indent=2))
