"""Offline comparison. Final test untouched until model selection on validation."""
import json
import hashlib
import io
import joblib
from pathlib import Path
import numpy as np
import pandas as pd
from scipy.stats import spearmanr
from sklearn.dummy import DummyRegressor
from sklearn.linear_model import PoissonRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.inspection import permutation_importance
from sklearn.pipeline import make_pipeline
from backend.services.data import digest
from ml.features import FEATURES,fixture_table,split_table,preprocessor


def metrics(y,pred):
    corr=spearmanr(y,pred).statistic if np.ptp(pred)>0 and np.ptp(np.asarray(y))>0 else np.nan
    return {'mae':float(np.mean(np.abs(np.array(y)-pred))),'rmse':float(np.sqrt(np.mean((np.array(y)-pred)**2))),
            'rank_correlation':float(corr) if np.isfinite(corr) else None}


def train(table,kind='synthetic_fixture',artifact_path=None):
    tr,va,te=split_table(table)
    models={'global_mean':make_pipeline(preprocessor(),DummyRegressor(strategy='mean')),
            'poisson':make_pipeline(preprocessor(),PoissonRegressor(alpha=.1,max_iter=500)),
            'random_forest':make_pipeline(preprocessor(),RandomForestRegressor(n_estimators=80,max_depth=6,min_samples_leaf=5,random_state=42,n_jobs=1))}
    validation={};test={}
    for name,model in models.items():
        model.fit(tr[FEATURES],tr.target_count)
        validation[name]=metrics(va.target_count,model.predict(va[FEATURES]))
    validation['previous_period']=metrics(va.target_count,va.lag_count.to_numpy())
    selected=min(validation,key=lambda k:validation[k]['mae'])
    # Selection fixed before accessing test metrics.
    for name,model in models.items():test[name]=metrics(te.target_count,model.predict(te[FEATURES]))
    test['previous_period']=metrics(te.target_count,te.lag_count.to_numpy())
    importance={}
    if selected in models:
        result=permutation_importance(models[selected],va[FEATURES],va.target_count,scoring='neg_mean_absolute_error',n_repeats=4,random_state=42,n_jobs=1)
        importance=dict(zip(FEATURES,result.importances_mean.tolist()))
    predictions=te[['segment_id','period']].copy()
    predictions['risk']=models[selected].predict(te[FEATURES]) if selected in models else te.lag_count.to_numpy()
    report={'version':'segment-month-count-v1','data_kind':kind,'available_for_iowa':False,'target':'forecast month crash count, predicted before month starts using prior-month or static inputs',
            'features':FEATURES,'splits':{k:{'rows':len(d),'start':str(d.period.min().date()),'end':str(d.period.max().date()),'segments':sorted(d.segment_id.unique().tolist())} for k,d in [('train',tr),('validation',va),('test',te)]},
            'validation':validation,'test':test,'selected_by_validation_mae':selected,'validation_permutation_importance':importance,
            'table_hash':digest(table.assign(period=table.period.astype(str),lag_period=table.lag_period.astype(str)).to_dict('records'))}
    stream=io.BytesIO()
    artifact=models[selected] if selected in models else {'rule':'previous_period','version':1}
    joblib.dump(artifact,stream,compress=3)
    report['artifact_hash']=hashlib.sha256(stream.getvalue()).hexdigest()
    if artifact_path is not None:
        artifact_path.parent.mkdir(parents=True,exist_ok=True)
        artifact_path.write_bytes(stream.getvalue())
    return report,predictions

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--table');args=parser.parse_args()
    table=pd.read_parquet(args.table) if args.table else fixture_table()
    report,risk=train(table,'unvalidated_external' if args.table else 'synthetic_fixture',Path('data/processed/ml/fixture_model.joblib'))
    out=Path('data/processed/ml');out.mkdir(parents=True,exist_ok=True)
    table.to_parquet(out/'training_table.parquet',index=False);risk.to_parquet(out/'risk.parquet',index=False)
    (out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    Path('docs/ml_fixture_metrics.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'selected':report['selected_by_validation_mae'],'test':report['test'],'hash':report['artifact_hash']},indent=2))
