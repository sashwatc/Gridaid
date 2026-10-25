import {test,expect} from '@playwright/test';
import type {Run} from '../src/types';

const percent=(v:number)=>`${(v*100).toFixed(1)}%`;

test('one click produces an API-backed recommendation, numbered locations and real satellite imagery',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const csp:string[]=[];
 await page.exposeFunction('recordPolicyViolation',(directive:string)=>csp.push(directive));
 await page.addInitScript(()=>document.addEventListener('securitypolicyviolation',e=>(window as unknown as {recordPolicyViolation:(s:string)=>void}).recordPolicyViolation(e.violatedDirective)));
 const runs:Run[]=[];
 page.on('response',async r=>{if(['/api/baseline','/api/optimize/static','/api/optimize/resilient'].some(path=>r.url().endsWith(path))&&r.request().method()==='POST'&&r.ok())runs.push(await r.json());});
 await page.goto('/');
 await expect(page.getByRole('button',{name:'Find a plan',exact:true})).toBeEnabled({timeout:20000});
 await expect(page.getByLabel('How many resources?')).toHaveValue('4');
 await expect(page.getByLabel('Travel-time target')).toHaveValue('5');
 await expect.poll(()=>page.locator('.citizen-leaflet .leaflet-tile-loaded').count(),{timeout:20000}).toBeGreaterThan(0);
 await expect(page.getByRole('button',{name:'Satellite',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.screenshot({path:'../artifacts/simple-planner-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Find a plan',exact:true}).click();
 await expect(page.getByText('4 suggested locations.')).toBeVisible({timeout:45000});
 expect(runs).toHaveLength(3);
 const best=[...runs].reverse().sort((a,b)=>b.summary.resilience_score-a.summary.resilience_score)[0];
 await expect(page.getByTestId('recommended-normal')).toHaveText(percent(best.metrics.normal.coverage));
 await expect(page.getByTestId('recommended-worst')).toHaveText(percent(best.summary.minimum_coverage));
 const staticRun=runs.find(r=>r.kind==='static')!;
 const delta=(a:number,b:number)=>{const d=(a-b)*100;return `${Math.abs(d)<.05?'0.0':`${d>0?'+':''}${d.toFixed(1)}`} pp`;};
 if(best.selected_site_ids.every(id=>staticRun.selected_site_ids.includes(id)))await expect(page.getByTestId('plain-tradeoff')).toContainText('same locations');
 else{
  await expect(page.getByTestId('plain-tradeoff')).toContainText(delta(best.summary.minimum_coverage,staticRun.summary.minimum_coverage));
  await expect(page.getByTestId('plain-tradeoff')).toContainText(delta(best.metrics.normal.coverage,staticRun.metrics.normal.coverage));
 }
 await expect(page.locator('.suggested-locations li')).toHaveCount(4);
 await expect(page.locator('.site-number')).toHaveCount(4);
 await page.locator('.suggested-locations button').first().click();
 await expect(page.locator('.suggested-locations button').first()).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Results',exact:true}).click();
 await page.getByRole('button',{name:'Toughest tested day'}).click();
 await expect(page.getByRole('button',{name:'Toughest tested day'})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Road map',exact:true}).click();
 await expect(page.locator('.citizen-map-surface.road-map .citizen-leaflet')).toBeVisible();
 await page.getByRole('button',{name:'Satellite',exact:true}).click();
 await expect.poll(()=>page.locator('.citizen-leaflet .leaflet-tile-loaded').count(),{timeout:20000}).toBeGreaterThan(0);
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({path:`../artifacts/simple-planner-result-${width}.png`,fullPage:true});
 }
 await page.getByRole('button',{name:'Plan',exact:true}).click();
 await page.getByLabel('How many resources?').fill('3');
 await expect(page.getByTestId('recommended-normal')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Find a plan',exact:true})).toBeEnabled({timeout:20000});
 expect(errors).toEqual([]);expect(csp).toEqual([]);
});

test('a failed calculation gives a useful message and retry completes a real plan',async({page})=>{
 let failures=0;
 await page.route('**/api/optimize/static',async route=>{if(failures++===0)await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'Computation capacity reached'})});else await route.continue();});
 await page.goto('/');await page.getByRole('button',{name:'Find a plan',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('The planning service is busy',{timeout:20000});
 await expect(page.getByTestId('recommended-normal')).toHaveCount(0);
 await page.getByRole('button',{name:'Try again',exact:true}).click();
 await expect(page.getByText('4 suggested locations.')).toBeVisible({timeout:45000});
});

test('initial data failure has a working retry and unavailable imagery falls back to offline roads',async({page})=>{
 let attempts=0;
 await page.route('**/api/community-preset',async route=>{if(attempts++===0)await route.fulfill({status:502,contentType:'text/html',body:'Bad gateway'});else await route.continue();});
 await page.route('https://services.arcgisonline.com/**',route=>route.abort());
 await page.goto('/');await expect(page.getByRole('alert')).toContainText('unexpected response');
 await page.getByRole('button',{name:'Retry loading'}).click();
 await expect(page.getByRole('button',{name:'Find a plan',exact:true})).toBeEnabled({timeout:20000});
 await expect(page.getByText(/Satellite imagery is unavailable/)).toBeVisible({timeout:15000});
 await expect(page.locator('.citizen-map-surface.road-map .citizen-leaflet')).toBeVisible();
 await expect(page.locator('.citizen-leaflet .leaflet-overlay-pane canvas')).toBeVisible();
 await page.getByRole('button',{name:'Retry satellite'}).click();
 await expect(page.getByText(/Satellite imagery is unavailable/)).toBeVisible({timeout:15000});
});

test('invalid inputs do not calculate, and changed inputs cannot revive an older response',async({page})=>{
 await page.route('https://services.arcgisonline.com/**',route=>route.abort());
 let posts=0;page.on('request',r=>{if(r.method()==='POST')posts++;});
 await page.goto('/');await expect(page.getByRole('button',{name:'Find a plan',exact:true})).toBeEnabled({timeout:20000});
 await page.getByLabel('How many resources?').fill('0');
 await expect(page.getByRole('alert')).toContainText('whole number');
 await expect(page.getByRole('button',{name:'Find a plan',exact:true})).toBeDisabled();
 await page.getByLabel('How many resources?').fill('4');await page.getByLabel('Travel-time target').fill('');
 await expect(page.getByRole('alert')).toContainText('1 to 60');expect(posts).toBe(0);
 await page.getByLabel('Travel-time target').fill('5');
 let release!:()=>void;const held=new Promise<void>(r=>{release=r;});
 let announce!:()=>void;const received=new Promise<void>(r=>{announce=r;});
 let finish!:()=>void;const finished=new Promise<void>(r=>{finish=r;});
 await page.route('**/api/baseline',async route=>{const response=await route.fetch();announce();await held;try{await route.fulfill({response});}catch{/* The edit cancels this response. */}finally{finish();}});
 await page.getByRole('button',{name:'Find a plan',exact:true}).click();await received;
 await page.getByLabel('How many resources?').fill('3');release();await finished;
 await expect(page.getByText('4 suggested locations.')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Find a plan',exact:true})).toBeEnabled({timeout:20000});
 expect(posts).toBe(1);
});

test('rate limits and disconnected services leave a recoverable screen',async({page})=>{
 await page.route('https://services.arcgisonline.com/**',route=>route.abort());
 await page.route('**/api/baseline',route=>route.fulfill({status:429,headers:{'Retry-After':'8'},contentType:'application/json',body:JSON.stringify({detail:'Rate limit exceeded'})}));
 await page.goto('/');await page.getByRole('button',{name:'Find a plan',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('wait 8 seconds');
 await expect(page.getByRole('button',{name:'Try again',exact:true})).toBeEnabled();
 await page.unroute('**/api/baseline');await page.route('**/api/baseline',route=>route.abort());
 await page.getByRole('button',{name:'Try again',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Cannot reach the planning service');
 await expect(page.getByRole('button',{name:'Try again',exact:true})).toBeEnabled();
});

test('a stalled request times out and an incomplete solver result is never presented as a plan',async({page})=>{
 await page.route('https://services.arcgisonline.com/**',route=>route.abort());
 await page.goto('/');await expect(page.getByRole('button',{name:'Find a plan',exact:true})).toBeEnabled({timeout:20000});
 await page.evaluate(()=>{const original=AbortSignal.timeout.bind(AbortSignal);(window as unknown as {normalTimeout:typeof AbortSignal.timeout}).normalTimeout=original;AbortSignal.timeout=()=>original(150);});
 let release!:()=>void;const held=new Promise<void>(r=>{release=r;});
 await page.route('**/api/baseline',async route=>{await held;try{await route.fulfill({status:504,contentType:'application/json',body:'{}'});}catch{/* Request already timed out. */}});
 await page.getByRole('button',{name:'Find a plan',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('took too long to respond');release();
 await page.evaluate(()=>{AbortSignal.timeout=(window as unknown as {normalTimeout:typeof AbortSignal.timeout}).normalTimeout;});
 await page.unroute('**/api/baseline');
 await page.route('**/api/baseline',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({solver:{status:'not_solved'},selected_site_ids:[]})}));
 await page.getByRole('button',{name:'Try again',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('A complete plan could not be found');
 await expect(page.getByTestId('recommended-normal')).toHaveCount(0);
});
