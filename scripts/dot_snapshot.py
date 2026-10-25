"""Download an audited current roadway/traffic snapshot; never use it as historical ML features."""
import json
from datetime import datetime,timezone
from pathlib import Path
import geopandas as gpd
import pandas as pd
from scripts.ingest import acquire,OUT,BBOX

if __name__=='__main__':
    south,west,north,east=BBOX
    url='https://gis.iowadot.gov/agshost/rest/services/RAMS/Road_Network/FeatureServer/0/query'
    features=[];sources=[]
    for offset in range(0,20000,2000):
        page,meta=acquire(f'dot_traffic_{offset}',url,params={'f':'geojson','where':'COUNTY_NUMBER=82','geometry':f'{west},{south},{east},{north}','geometryType':'esriGeometryEnvelope','inSR':'4326','spatialRel':'esriSpatialRelIntersects','outFields':'OBJECTID,ROUTEID,AADT,AADT_YEAR,TRUCK_AADT,TRUCK_AADT_YEAR,SPEED_LIMIT,LANE_DIRECTION_1,LANE_DIRECTION_2,ROAD_STATUS','outSR':'4326','returnGeometry':'true','resultOffset':offset,'resultRecordCount':2000,'orderByFields':'OBJECTID'})
        features.extend(page['features']);sources.append(meta)
        if not page.get('exceededTransferLimit',page.get('properties',{}).get('exceededTransferLimit',False)):break
    else:raise ValueError('traffic snapshot exceeds 20000-row cap')
    df=gpd.GeoDataFrame.from_features(features,crs=4326)
    if df.OBJECTID.duplicated().any() or not df.geometry.is_valid.all():raise ValueError('invalid road/traffic snapshot')
    for name in ['AADT','TRUCK_AADT','SPEED_LIMIT']:
        if (pd.to_numeric(df[name]).dropna()<0).any():raise ValueError('invalid traffic values')
    invalid_years={}
    for name in ['AADT_YEAR','TRUCK_AADT_YEAR']:
        invalid=df[name].notna() & ~df[name].between(1900,datetime.now(timezone.utc).year)
        invalid_years[name]=int(invalid.sum());df.loc[invalid,name]=float('nan')
    invalid_speed=df.SPEED_LIMIT.notna() & ~df.SPEED_LIMIT.between(1,100)
    invalid_speed_count=int(invalid_speed.sum());df.loc[invalid_speed,'SPEED_LIMIT']=float('nan')
    report={'invalid_year_values_treated_as_missing':invalid_years,'invalid_speed_values_treated_as_missing':invalid_speed_count,'lane_direction_values_observed_not_used_for_routing':sorted(df.LANE_DIRECTION_1.dropna().unique().tolist()),'kind':'observed_current_iowa_dot_traffic','sources':sources,'rows':len(df),'crs':'EPSG:4326','attribution':'Iowa Department of Transportation - Research & Analytics',
            'missing':{key:int(df[key].isna().sum()) for key in ['AADT','AADT_YEAR','TRUCK_AADT','SPEED_LIMIT','LANE_DIRECTION_1']},
            'aadt_years':sorted(df.AADT_YEAR.dropna().unique().tolist()),'training_use':'Excluded: current network and mixed AADT vintage cannot stand in for attributes known before 2020–2023 forecasts.'}
    OUT.mkdir(exist_ok=True,parents=True);df.to_parquet(OUT/'dot_traffic.parquet')
    Path('docs/dot_traffic_manifest.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='sources'},indent=2))
