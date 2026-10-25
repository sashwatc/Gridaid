"""ASGI body/security controls and killable bounded compute processes."""
import asyncio
from collections import defaultdict,deque
import multiprocessing as mp
import queue
import threading
from time import monotonic
from starlette.responses import JSONResponse

MAX_BODY=16384
HEADERS={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
         'Permissions-Policy':'geolocation=(), camera=(), microphone=()',
         'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'"}

class Guard:
    def __init__(self,app,rate_limit=30,window=60):
        self.app=app;self.rate_limit=rate_limit;self.window=window;self.hits={}

    async def __call__(self,scope,receive,send):
        if scope['type']!='http':return await self.app(scope,receive,send)
        async def secured(message):
            if message['type']=='http.response.start':
                message['headers'] += [(k.lower().encode(),v.encode()) for k,v in HEADERS.items()]
                message['headers'].append((b'cache-control',b'no-store'))
            await send(message)
        # Read bounded body, even if content-length omitted or dishonest.
        chunks=[];size=0
        while True:
            message=await receive()
            if message['type']=='http.disconnect':return
            chunk=message.get('body',b'');size+=len(chunk)
            if size>MAX_BODY:return await JSONResponse({'detail':'Request too large'},413)(scope,receive,secured)
            chunks.append(chunk)
            if not message.get('more_body'):break
        expensive=scope['method']=='POST' or scope['path']=='/api/baseline'
        if expensive:
            now=monotonic();key=scope.get('client',('local',))[0]
            # Do not honor attacker-controlled forwarding headers. In-memory local single-worker limit.
            q=self.hits.setdefault(key,deque())
            while q and now-q[0]>=self.window:q.popleft()
            if len(q)>=self.rate_limit:return await JSONResponse({'detail':'Rate limit exceeded'},429,headers={'Retry-After':str(self.window)})(scope,receive,secured)
            q.append(now)
            if len(self.hits)>1024:
                self.hits={k:v for k,v in self.hits.items() if v and now-v[-1]<self.window}
        delivered=False
        async def body():
            nonlocal delivered
            if delivered:return await receive()
            delivered=True
            return {'type':'http.request','body':b''.join(chunks),'more_body':False}
        try:await self.app(scope,body,secured)
        except Exception:
            await JSONResponse({'detail':'Internal computation error'},500)(scope,receive,secured)


def child_entry(connection,operation,payload):
    try:
        from backend.services.engine import worker
        connection.send(('ok',worker(operation,payload)))
    except ValueError as exc:connection.send(('invalid',str(exc)))
    except Exception:connection.send(('error','Computation failed'))
    finally:connection.close()


def run_bounded(operation,payload,timeout=20,target=child_entry):
    deadline=monotonic()+timeout
    context=mp.get_context('spawn')
    parent,child=context.Pipe(duplex=False)
    process=context.Process(target=target,args=(child,operation,payload),daemon=True)
    process.start();child.close()
    received=queue.Queue(maxsize=1)
    def receive_result():
        try:received.put((True,parent.recv()))
        except (EOFError,OSError) as exc:received.put((False,exc))
    reader=threading.Thread(target=receive_result,daemon=True)
    reader.start()
    try:
        try:ok,value=received.get(timeout=max(0,deadline-monotonic()))
        except queue.Empty:raise TimeoutError('Computation deadline exceeded') from None
        if not ok:raise value
        return value
    finally:
        if process.is_alive():process.terminate()
        process.join(timeout=1)
        if process.is_alive():process.kill();process.join()
        parent.close()
        reader.join(timeout=1)

class ComputeGate:
    def __init__(self,limit=2):self.limit=limit;self.active=0;self.jobs=set()
    async def run(self,operation,payload):
        # All access occurs on the ASGI event loop; no await between check and increment.
        if self.active>=self.limit:return ('busy','Computation capacity reached')
        self.active+=1
        async def finish_work():
            try:return await asyncio.to_thread(run_bounded,operation,payload)
            except TimeoutError:return ('timeout','Computation deadline exceeded')
            except (EOFError,OSError):return ('error','Computation failed')
            finally:self.active-=1
        job=asyncio.create_task(finish_work());self.jobs.add(job)
        job.add_done_callback(self.jobs.discard)
        # Cancelling a disconnected request must not release a still-running job's slot.
        return await asyncio.shield(job)
