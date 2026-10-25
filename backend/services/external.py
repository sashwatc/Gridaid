"""Offline ingestion only. No user-controlled fetch endpoint or redirect following."""
from datetime import datetime, timezone, timedelta
import json
from pathlib import Path
from urllib.parse import urlsplit
import httpx
from pydantic import BaseModel, ConfigDict, Field, AwareDatetime

HOSTS=frozenset({'overpass-api.de','api.census.gov','www2.census.gov','tigerweb.geo.census.gov','services.arcgis.com','iowadot.gov','data.iowadot.gov','gis.iowadot.gov','download.geofabrik.de'})
MAX_BYTES=30_000_000


def fetch_bytes(url,*,params=None,body=None,timeout=45,max_bytes=MAX_BYTES,transport=None):
    parsed=urlsplit(url)
    if parsed.scheme!='https' or parsed.hostname not in HOSTS or parsed.port not in (None,443) or parsed.username or parsed.password:
        raise ValueError('external host not allowed')
    with httpx.Client(timeout=timeout,follow_redirects=False,transport=transport) as client:
        method='POST' if body else 'GET'
        with client.stream(method,url,params=params,data=body) as response:
            response.raise_for_status()
            if response.is_redirect: raise ValueError('redirect rejected')
            raw=bytearray()
            for chunk in response.iter_bytes():
                raw.extend(chunk)
                if len(raw)>max_bytes: raise ValueError('external data exceeds size limit')
            return bytes(raw)


class FeedEvent(BaseModel):
    model_config=ConfigDict(extra='forbid',allow_inf_nan=False)
    id:str=Field(min_length=1,max_length=128)
    kind:str=Field(pattern='^(closure|slowdown|event)$')
    edge_ids:list[str]=Field(default_factory=list,max_length=200)
    multiplier:float=Field(default=1,ge=1,le=5)

class FeedSnapshot(BaseModel):
    model_config=ConfigDict(extra='forbid',allow_inf_nan=False)
    source_timestamp: AwareDatetime
    records: list[FeedEvent] = Field(max_length=10000)


def validated_feed(url,cache_path:Path,transport=None,now=None):
    """Adapter contract for normalized official snapshots; not an Iowa 511 XML parser."""
    now=now or datetime.now(timezone.utc)
    try:
        payload=FeedSnapshot.model_validate_json(fetch_bytes(url,transport=transport))
        if payload.source_timestamp>now+timedelta(minutes=5) or now-payload.source_timestamp>timedelta(hours=24):
            raise ValueError('stale or future source timestamp')
        cache_path.parent.mkdir(parents=True,exist_ok=True)
        cache_path.write_text(payload.model_dump_json())
        return {'snapshot':payload.model_dump(mode='json'),'cached_fallback':False,'stale':False}
    except (httpx.HTTPError, ValueError):
        if not cache_path.exists(): raise ValueError('External source unavailable; no validated cache') from None
        payload=FeedSnapshot.model_validate_json(cache_path.read_bytes())
        return {'snapshot':payload.model_dump(mode='json'),'cached_fallback':True,
                'stale':now-payload.source_timestamp>timedelta(hours=24)}
