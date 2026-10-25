import {test,expect} from '@playwright/test';
import type {Run} from '../src/types';

test('baseline → static → disruption → resilience → paired simulation; numbers, stale state and errors',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});
 await page.goto('/');await expect(page.getByText('30 nodes · 8 candidate sites')).toBeVisible();
 const metrics:Record<string,Run>={};
 for(const [label,path,kind] of [['Load baseline','/api/baseline','baseline'],['Static optimize','/api/optimize/static','static']] as const){
  const response=page.waitForResponse(r=>r.url().endsWith(path)&&r.request().method()==='POST');
  await page.getByRole('button',{name:new RegExp(label)}).first().click();
  metrics[kind]=await (await response).json();
  await expect(page.getByTestId(`${kind}-normal`)).toHaveText(`${(metrics[kind].metrics.normal.coverage*100).toFixed(1)}%`);
 }
 await page.getByLabel('Stress-test view').selectOption('closure');
 await expect(page.getByText('Prepared corridor edges removed in both directions where present.')).toBeVisible();
 const response=page.waitForResponse(r=>r.url().endsWith('/api/optimize/resilient'));
 await page.getByRole('button',{name:/Resilience optimize/}).click();metrics.resilient=await (await response).json();
 await expect(page.getByTestId('resilient-minimum')).toHaveText(`${(metrics.resilient.summary.minimum_coverage*100).toFixed(1)}%`);
 await page.getByLabel('Selected site').selectOption(metrics.resilient.selected_site_ids[0]);
 await expect(page.getByText('Unique normal coverage')).toBeVisible();
 const simResponse=page.waitForResponse(r=>r.url().endsWith('/api/simulate'));
 await page.getByRole('button',{name:/Simulate & compare/}).click();const sim=await (await simResponse).json();
 await expect(page.getByText('10,000 sampled incidents per scenario')).toBeVisible();
 for(const kind of ['baseline','static','resilient']){
  const m=sim.configurations[metrics[kind].run_id].scenarios.closure;
  await expect(page.getByTestId(`${kind}-sampled`)).toHaveText(`${(m.coverage*100).toFixed(1)}%`);
 }
 await page.screenshot({path:'../artifacts/workflow-desktop.png',fullPage:true});
 await page.getByLabel('Threshold minutes').fill('6');
 await expect(page.getByText(/Results below are stale/)).toBeVisible();
 await expect(page.getByRole('button',{name:/Resilience optimize/})).toBeDisabled();
 await expect(page.getByText('10,000 sampled incidents per scenario')).not.toBeVisible();
 await page.getByLabel('Resources',{exact:true}).fill('25');
 await page.getByRole('button',{name:/Load baseline/}).first().click();
 await expect(page.getByRole('alert')).toHaveText('Resource count exceeds available candidates');
 await page.getByRole('button',{name:'Methodology & trust'}).click();
 await expect(page.getByText('Know what the model measures.')).toBeVisible();
 // Browser logs contain the expected deliberately rejected 422 network request only.
 expect(errors.filter(e=>!e.includes('422'))).toEqual([]);
});

test('mobile layout stays within viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await expect(page.getByText('30 nodes · 8 candidate sites')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.screenshot({path:'../artifacts/workflow-mobile.png',fullPage:true});
});

test('map layers survive repeated planner and methodology navigation',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.stack??e.message));
 await page.goto('/');await expect(page.getByText('30 nodes · 8 candidate sites')).toBeVisible();
 await page.getByLabel('Study area').selectOption('iowa');
 await expect(page.getByText('19,205 nodes · 32 candidate sites')).toBeVisible();
 for(let i=0;i<4;i++){
  // Change vector layers before teardown, including after a previous remount.
  await page.getByRole('checkbox',{name:'access',exact:true}).setChecked(i%2===0);
  await page.locator('.leaflet-control-zoom-in').click();
  await page.getByRole('button',{name:'Methodology & trust'}).click();
  await expect(page.getByText('Know what the model measures.')).toBeVisible();
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  await page.getByRole('button',{name:'Planning workspace'}).click();
  await expect(page.locator('.map')).toBeVisible();
  await expect(page.locator('.map .leaflet-overlay-pane > canvas, .map .leaflet-overlay-pane > svg')).toBeVisible();
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 }
 expect(errors).toEqual([]);
});

test('observed Iowa data, retrospective ML, blended full workflow and browser timing',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('/');await page.getByLabel('Study area').selectOption('iowa');
 await expect(page.getByText('19,205 nodes · 32 candidate sites')).toBeVisible({timeout:20000});
 await page.getByLabel('Demand model').selectOption('blended');
 await expect(page.getByText(/ML: retrospective Jan 2024/)).toBeVisible();
 let latest:Run|undefined;
 for(const [label,path] of [['Load baseline','/api/baseline'],['Static optimize','/api/optimize/static'],['Resilience optimize','/api/optimize/resilient']] as const){
  const response=page.waitForResponse(r=>r.url().endsWith(path)&&r.request().method()==='POST',{timeout:30000});
  await page.getByRole('button',{name:new RegExp(label)}).first().click();const r=await response;
  expect(r.status()).toBe(200);latest=await r.json();
  await expect(page.getByTestId(`${latest!.kind}-normal`)).toHaveText(`${(latest!.metrics.normal.coverage*100).toFixed(1)}%`);
 }
 await page.getByLabel('Stress-test view').selectOption('combined');
 const sr=page.waitForResponse(r=>r.url().endsWith('/api/simulate'),{timeout:30000});
 await page.getByRole('button',{name:/Simulate & compare/}).click();expect((await sr).status()).toBe(200);
 await expect(page.getByText('10,000 sampled incidents per scenario')).toBeVisible();
 await page.getByRole('checkbox',{name:'ML risk · Jan 2024'}).check();
 await page.screenshot({path:'../artifacts/workflow-iowa.png',fullPage:true});
 await page.getByRole('button',{name:'Methodology & trust'}).click();
 await expect(page.getByRole('cell',{name:'1.775',exact:true})).toBeVisible();
 const perf=await page.evaluate(()=>({navigation:(performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).toJSON(),dataReadyText:document.body.innerText.match(/Browser data-ready time: [^.]+/)?.[0],mapMeasures:performance.getEntriesByName('gridaid-map-commit-and-frame').map(x=>x.toJSON())}));
 const fs=await import('node:fs');fs.writeFileSync('../artifacts/browser-performance.json',JSON.stringify(perf,null,2));
 expect(errors).toEqual([]);
});

test('real demo preset, all comparison metrics, access layers, explanations and in-flight trial change',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('/');await expect(page.getByText('30 nodes · 8 candidate sites')).toBeVisible();
 await page.getByRole('button',{name:'Load real-data demo preset →'}).click();
 await expect(page.getByText('19,205 nodes · 32 candidate sites')).toBeVisible();
 await expect(page.getByLabel('Resources',{exact:true})).toHaveValue('4');
 await expect(page.getByLabel('Access speed',{exact:true})).toHaveValue('20');
 const runs:Run[]=[];
 for(const [label,path] of [['Load baseline','/api/baseline'],['Static optimize','/api/optimize/static'],['Resilience optimize','/api/optimize/resilient']] as const){
  const response=page.waitForResponse(r=>r.url().endsWith(path)&&r.request().method()==='POST',{timeout:30000});
  await page.getByRole('button',{name:new RegExp(label)}).first().click();
  await expect(page.getByRole('status')).toContainText(/Calculating/);
  const result=await response;expect(result.status()).toBe(200);const r:Run=await result.json();runs.push(r);
  await expect(page.getByTestId(`${r.kind}-normal`)).toHaveText(`${(r.metrics.normal.coverage*100).toFixed(1)}%`);
  await expect(page.getByTestId(`${r.kind}-minimum`)).toHaveText(`${(r.summary.minimum_coverage*100).toFixed(1)}%`);
 }
 expect(runs[2].metrics.normal.coverage).toBeLessThan(runs[1].metrics.normal.coverage);
 expect(runs[2].summary.minimum_coverage).toBeGreaterThan(runs[1].summary.minimum_coverage);
 const comparison=await page.request.post('/api/scenarios/evaluate',{data:{run_ids:runs.map(r=>r.run_id)}});
 expect(comparison.status()).toBe(200);expect((await comparison.json()).runs.map((r:Run)=>r.summary)).toEqual(runs.map(r=>r.summary));
 await page.getByLabel('Stress-test view').selectOption('winter_closure');
 await expect(page.getByText(/no resource outage or event/)).toBeVisible();
 const site=runs[2].explanation.sites[0];await page.getByLabel('Selected site').selectOption(site.site_id);
 await expect(page.getByTestId('site-unique')).toHaveText(`${(site.unique_fraction*100).toFixed(1)}%`);
 await expect(page.getByTestId('site-marginal')).toHaveText(site.marginal_in_order_weight.toFixed(1));
 for(const layer of ['roads','coverage','candidates','disruptions']){
  const box=page.getByRole('checkbox',{name:layer,exact:true});await box.uncheck();await expect(box).not.toBeChecked();await box.check();
 }
 const before=await page.locator('.map').screenshot();
 await page.getByRole('checkbox',{name:'access',exact:true}).check();
 await expect(page.getByText('Assumed access · unverified path')).toBeVisible();
 expect((await page.locator('.map').screenshot()).equals(before)).toBe(false);
 await page.getByRole('checkbox',{name:'improvement',exact:true}).check();await expect(page.getByText('New coverage vs baseline')).toBeVisible();
 // Delay an actual backend response: edits must not revive old sampled results.
 let complete!:()=>void;const completed=new Promise<void>(r=>{complete=r});let release!:()=>void;const held=new Promise<void>(r=>{release=r});let announce!:()=>void;const fetched=new Promise<void>(r=>{announce=r});
 await page.route('**/api/simulate',async route=>{const response=await route.fetch();announce();await held;try{await route.fulfill({response})}catch{/* Browser can cancel the pending request. */}finally{complete()}});
 await page.getByRole('button',{name:/Simulate & compare/}).click();await fetched;
 await page.getByLabel('Simulation trials',{exact:true}).fill('20000');release();await completed;await page.waitForTimeout(100);
 await expect(page.getByText('10,000 sampled incidents per scenario')).not.toBeVisible();
 await page.unroute('**/api/simulate');
 const simResponse=page.waitForResponse(r=>r.url().endsWith('/api/simulate'));
 await page.getByRole('button',{name:/Simulate & compare/}).click();const sim=await (await simResponse).json();
 await expect(page.getByText('20,000 sampled incidents per scenario')).toBeVisible();
 for(const r of runs){const m=sim.configurations[r.run_id].scenarios.winter_closure;await expect(page.getByTestId(`${r.kind}-sampled`)).toHaveText(`${(m.coverage*100).toFixed(1)}%`)}
 await page.screenshot({path:'../artifacts/workflow-real-preset.png',fullPage:true});
 await page.getByLabel('Access speed',{exact:true}).fill('5');await expect(page.getByText(/Results below are stale/)).toBeVisible();
 await expect(page.getByRole('button',{name:/Simulate & compare/})).toBeDisabled();
 expect(errors).toEqual([]);
});
