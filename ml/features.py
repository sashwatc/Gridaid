"""Frozen segment-month future-count task. No post-outcome fields or IDs as features."""
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

NUMERIC=['aadt','speed_kph','length_m','lag_count','month']
CATEGORICAL=['road_class']
FEATURES=NUMERIC+CATEGORICAL
REQUIRED=FEATURES+['segment_id','region','period','target_count','lag_period']


def validate_table(table):
    if set(table.columns)!=set(REQUIRED): raise ValueError('unexpected ML schema; target/feature schema frozen')
    df=table.copy()
    if df[['segment_id','period','target_count','lag_period','region','road_class']].isna().any().any():
        raise ValueError('missing identifiers, target or period')
    if df.duplicated(['segment_id','period']).any():raise ValueError('duplicate segment-period')
    df['period']=pd.to_datetime(df.period);df['lag_period']=pd.to_datetime(df.lag_period)
    if not (df.lag_period<df.period).all():raise ValueError('future or same-period leakage')
    for key in NUMERIC+['target_count']:
        values=pd.to_numeric(df[key],errors='raise')
        if np.isinf(values).any() or (values.dropna()<0).any():raise ValueError('invalid numeric feature')
        df[key]=values
    if not df.month.between(1,12).all() or not (df.month==df.period.dt.month).all():raise ValueError('invalid month')
    if not (df.target_count%1==0).all():raise ValueError('count target must be integral')
    if not df.speed_kph.dropna().between(1,160).all():raise ValueError('invalid speed')
    return df


def split_table(table):
    df=validate_table(table)
    # Train and validation on earlier years, final future holdout ALSO unseen region.
    train=df[(df.period<'2022-01-01') & (df.region!='heldout')]
    validation=df[(df.period>='2022-01-01') & (df.period<'2023-01-01') & (df.region!='heldout')]
    test=df[(df.period>='2023-01-01') & (df.region=='heldout')]
    if any(x.empty for x in (train,validation,test)):raise ValueError('missing split')
    if train.period.max()>=validation.period.min() or validation.period.max()>=test.period.min():raise ValueError('temporal overlap')
    if set(train.segment_id)&set(test.segment_id):raise ValueError('geographic segment overlap')
    return train,validation,test


def preprocessor():
    return ColumnTransformer([
        ('numeric',make_pipeline(SimpleImputer(strategy='median'),StandardScaler()),NUMERIC),
        ('class',make_pipeline(SimpleImputer(strategy='most_frequent'),OneHotEncoder(handle_unknown='ignore',sparse_output=False)),CATEGORICAL)
    ])


def fixture_table(seed=42):
    rng=np.random.default_rng(seed);rows=[]
    for segment in range(36):
        aadt=float(rng.integers(100,15000));speed=float(rng.choice([30,50,80]));length=float(rng.integers(100,3000));lag=0
        for period in pd.date_range('2020-01-01','2023-12-01',freq='MS'):
            count=int(rng.poisson(aadt*length/2e7*(1+.2*np.cos(period.month/12*2*np.pi))))
            rows.append(dict(segment_id=f'S{segment}',region='heldout' if segment>=28 else 'development',period=period,
                             target_count=count,lag_period=period-pd.offsets.MonthBegin(),aadt=aadt,speed_kph=speed,length_m=length,
                             lag_count=lag,month=period.month,road_class='rural' if speed==80 else 'urban'))
            lag=count
    return pd.DataFrame(rows)[REQUIRED]
