"""Retrospective Iowa tract-cell × month incident forecast, offline only.

Only calendar and prior-period counts are predictors. Current road/AADT attributes
are excluded because their historical vintages are not available. Tracts are the
spatial-cell fallback to uncertain crash-to-OSM-segment matching.
"""
import hashlib
from time import perf_counter
import io
import json
from pathlib import Path
import gzip
import geopandas as gpd
import joblib
import numpy as np
import pandas as pd
from sklearn.dummy import DummyRegressor
from sklearn.linear_model import PoissonRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.inspection import permutation_importance
from sklearn.impute import SimpleImputer
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from backend.services.data import load_dataset,digest,Dataset
from scripts.ingest import acquire,RAW,OUT
from ml.train import metrics

FEATURES=['month','lag_count','lag12_count','rolling3_count']


def table_from_counts(counts,ids):
    index=pd.MultiIndex.from_product([sorted(ids),pd.date_range('2019-01-01','2023-12-01',freq='MS')],names=['cell_id','period'])
    table=counts.reindex(index,fill_value=0).rename('target_count').reset_index()
    grouped=table.groupby('cell_id',sort=False).target_count
    table['lag_count']=grouped.shift(1)
    table['lag12_count']=grouped.shift(12)
    table['rolling3_count']=grouped.transform(lambda s:s.shift(1).rolling(3).mean())
    table['month']=table.period.dt.month
    table['lag_period']=table.period-pd.offsets.MonthBegin()
    table['region']=table.cell_id.map(lambda i:'heldout' if sorted(ids).index(i)%5==0 else 'development')
    return table


def split(table):
    expected={'cell_id','period','target_count','lag_count','lag12_count','rolling3_count','month','lag_period','region'}
    if set(table.columns)!=expected:raise ValueError('unexpected real ML schema')
    if not table.region.isin(['development','heldout']).all() or (table.groupby('cell_id').region.nunique()!=1).any():raise ValueError('cell geography group must remain fixed')
    if not table.month.between(1,12).all() or not (table.month==table.period.dt.month).all():raise ValueError('invalid forecast calendar')
    if (table.target_count<0).any() or not (table.target_count%1==0).all():raise ValueError('invalid incident count')
    if (table[FEATURES].dropna()<0).any().any():raise ValueError('negative forecast feature')
    if table.duplicated(['cell_id','period']).any() or not (table.lag_period<table.period).all():raise ValueError('ML temporal/key violation')
    if not np.isfinite(table.loc[table.period>='2020-01-01',FEATURES+['target_count']].to_numpy()).all():raise ValueError('missing complete lag history')
    train=table[(table.period>='2020-01-01')&(table.period<'2022-01-01')&(table.region=='development')]
    validation=table[(table.period>='2022-01-01')&(table.period<'2023-01-01')&(table.region=='development')]
    test=table[(table.period>='2023-01-01')&(table.region=='heldout')]
    if any(t.empty for t in [train,validation,test]):raise ValueError('empty split')
    if set(train.cell_id)&set(test.cell_id):raise ValueError('geographic leakage')
    if not train.period.max()<validation.period.min()<test.period.min():raise ValueError('temporal leakage')
    return train,validation,test


def fit(table):
    train,validation,test=split(table)
    models={'global_mean':make_pipeline(SimpleImputer(strategy='median'),StandardScaler(),DummyRegressor()),
            'poisson':make_pipeline(SimpleImputer(strategy='median'),StandardScaler(),PoissonRegressor(alpha=.1,max_iter=500)),
            'random_forest':make_pipeline(SimpleImputer(strategy='median'),RandomForestRegressor(n_estimators=100,max_depth=5,min_samples_leaf=8,random_state=42,n_jobs=1))}
    validation_metrics={}
    for name,model in models.items():
        model.fit(train[FEATURES],train.target_count)
        validation_metrics[name]=metrics(validation.target_count,model.predict(validation[FEATURES]))
    validation_metrics['previous_month']=metrics(validation.target_count,validation.lag_count.to_numpy())
    validation_metrics['previous_year']=metrics(validation.target_count,validation.lag12_count.to_numpy())
    selected=min(validation_metrics,key=lambda k:validation_metrics[k]['mae'])
    final_metrics={name:metrics(test.target_count,model.predict(test[FEATURES])) for name,model in models.items()}
    final_metrics['previous_month']=metrics(test.target_count,test.lag_count.to_numpy());final_metrics['previous_year']=metrics(test.target_count,test.lag12_count.to_numpy())
    importance={}
    if selected in models:
        imp=permutation_importance(models[selected],validation[FEATURES],validation.target_count,random_state=42,n_repeats=5,scoring='neg_mean_absolute_error',n_jobs=1)
        importance=dict(zip(FEATURES,imp.importances_mean.tolist()))
    # Forecast Jan 2024 from earlier incident months in a finalized snapshot.
    # Historical reporting availability at the forecast origin remains unverified.
    forecast=[]
    for cid,group in table.groupby('cell_id'):
        lookup=group.set_index('period').target_count
        forecast.append(dict(cell_id=cid,month=1,lag_count=float(lookup.loc['2023-12-01']),lag12_count=float(lookup.loc['2023-01-01']),rolling3_count=float(lookup.loc['2023-10-01':'2023-12-01'].mean())))
    forecast=pd.DataFrame(forecast)
    inference_start=perf_counter()
    if selected in models:forecast['risk']=np.maximum(0,models[selected].predict(forecast[FEATURES]))
    else:forecast['risk']=forecast['lag_count' if selected=='previous_month' else 'lag12_count']
    inference_seconds=perf_counter()-inference_start
    artifact=models[selected] if selected in models else {'rule':selected,'version':1}
    stream=io.BytesIO();joblib.dump(artifact,stream,compress=3);artifact_bytes=stream.getvalue()
    artifact_hash=hashlib.sha256(artifact_bytes).hexdigest()
    report={'inference_seconds':inference_seconds,'inference_rows':len(forecast),'version':'iowa-tract-month-v1','data_kind':'observed_iowa_crash_counts','available_for_iowa':True,
            'prediction_unit':'2020 Census tract spatial cell × month','forecast_period':'2024-01','target':'reported transportation crash count during forecast month',
            'features':FEATURES,'selected_by_validation_mae':selected,'validation':validation_metrics,'test':final_metrics,'validation_permutation_importance':importance,
            'splits':{k:{'rows':len(t),'start':str(t.period.min().date()),'end':str(t.period.max().date()),'cells':sorted(t.cell_id.unique().tolist())} for k,t in [('train',train),('validation',validation),('test',test)]},
            'zero_target_rows':int((table.target_count==0).sum()),'table_hash':digest(json.loads(table.to_json(orient='records',date_format='iso'))),
            'artifact_hash':artifact_hash,'model_version':f'iowa-tract-month-v1-{artifact_hash[:16]}',
            'limitations':['Small regional sample and only 96 held-out cell-months; not operational validation.',
                          'Retrospective finalized crash counts can differ from counts known at the historical forecast origin; no as-of reporting-latency snapshots are available.',
                          'Tracts vary in size; forecasts are counts, not per-person probabilities or exposure-adjusted rates.',
                          'January 2024 forecast is historical, not a current alert or 2026 risk estimate.',
                          'No AADT/weather/current roadway fields used, avoiding mismatched historical vintages; ML adds only calendar and lag-count signal.',
                          'Forecasts and contributions are not causal and cannot predict every emergency.']}
    return report,forecast,artifact_bytes


def main():
    data=load_dataset('iowa');features=[];metadata=[]
    base='https://gis.iowadot.gov/agshost/rest/services/Traffic_Safety/Crash_Data/FeatureServer/0/query'
    where="COUNTY_NUMBER=82 AND CRASH_DATE >= DATE '2019-01-01' AND CRASH_DATE < DATE '2024-01-01'"
    for offset in range(0,20000,2000):
        page,meta=acquire(f'iowa_crash_{offset}',base,params={'f':'geojson','where':where,'outFields':'OBJECTID,CRASH_DATE','outSR':'4326','resultOffset':offset,'resultRecordCount':2000,'orderByFields':'OBJECTID','returnGeometry':'true'})
        features.extend(page['features']);metadata.append(meta)
        if not page.get('exceededTransferLimit',page.get('properties',{}).get('exceededTransferLimit',False)):break
    else:raise ValueError('Crash download exceeded configured 20000 row bound')
    crashes=gpd.GeoDataFrame.from_features(features,crs=4326)
    if crashes.OBJECTID.duplicated().any() or crashes.CRASH_DATE.isna().any() or not crashes.geometry.is_valid.all():raise ValueError('invalid crash input')
    tracts=gpd.GeoDataFrame.from_features(json.loads((RAW/'census2020_scott.json').read_text())['features'],crs=4326)
    joined=gpd.sjoin(crashes,tracts[['GEOID','geometry']],how='left',predicate='within')
    if joined.OBJECTID.duplicated().any():raise ValueError('ambiguous crash spatial join')
    joined['period']=pd.to_datetime(joined.CRASH_DATE,unit='ms').dt.to_period('M').dt.to_timestamp()
    ids=[d.id for d in data.demands]
    selected=joined[joined.GEOID.isin(ids)]
    counts=selected.groupby(['GEOID','period']).size();counts.index.names=['cell_id','period']
    table=table_from_counts(counts,ids)
    report,forecast,artifact=fit(table)
    report['sources']=metadata
    report['spatial_join_audit']={'downloaded_crashes':len(crashes),'unmatched_to_county_tracts':int(joined.GEOID.isna().sum()),'inside_selected_tracts':len(selected),'outside_selected_tracts':int(joined.GEOID.notna().sum()-len(selected))}
    OUT.mkdir(parents=True,exist_ok=True);(OUT/'ml').mkdir(exist_ok=True)
    table.to_parquet(OUT/'ml/iowa_training_table.parquet',index=False);forecast.to_parquet(OUT/'ml/iowa_risk.parquet',index=False)
    (OUT/'ml/iowa_model.joblib').write_bytes(artifact)
    Path('docs/ml_real_metrics.json').write_text(json.dumps(report,indent=2)+'\n')
    risk=forecast.set_index('cell_id').risk.to_dict()
    provenance={**data.provenance,'ml':{'model_version':report['model_version'],'data_kind':report['data_kind'],'forecast_period':'2024-01','sources':metadata,'limitations':report['limitations']}}
    updated=data.model_copy(update={'ml_validated':True,'model_version':report['model_version'],
                                   'demands':[d.model_copy(update={'risk':float(risk[d.id])}) for d in data.demands], 'provenance':provenance})
    updated=updated.model_copy(update={'version':digest(updated.model_dump(exclude={'version'}))[:20]})
    Dataset.model_validate(updated.model_dump())
    (OUT/'iowa.json').write_text(updated.model_dump_json())
    Path('data/public/iowa.json.gz').write_bytes(gzip.compress(updated.model_dump_json().encode(),mtime=0))
    Path('docs/iowa_manifest.json').write_text(json.dumps(provenance,indent=2)+'\n')
    print(json.dumps({'selected':report['selected_by_validation_mae'],'test':report['test'],'spatial_join':report['spatial_join_audit'],'version':report['model_version']},indent=2))
if __name__=='__main__':main()
