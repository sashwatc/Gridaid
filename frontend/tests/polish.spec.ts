import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import type {Metric,Run,Study,Simulation} from '../src/types';
import {travel} from '../src/presentation';

test.use({actionTimeout:10000});

const percent=(v:number)=>`${(v*100).toFixed(1)}%`;
const delta=(a:number,b:number)=>`${a>b?'+':''}${((a-b)*100).toFixed(1)} pp`;
const steps=[['Load baseline','/api/baseline'],['Static optimize','/api/optimize/static'],['Resilience optimize','/api/optimize/resilient']] as const;
async function calculate(page:Page){
 const runs:Run[]=[];
 for(const [name,path] of steps){
  const response=page.waitForResponse(r=>r.url().endsWith(path)&&r.request().method()==='POST');
  await page.getByRole('button',{name:new RegExp(name)}).click();
  const res=await response;expect(res.status()).toBe(200);const run:Run=await res.json();runs.push(run);
  await expect(page.getByTestId(`${run.kind}-minimum`)).toHaveText(percent(run.summary.minimum_coverage));
 }
 return runs;
}

test('preset tradeoffs, charts and placement switching agree with actual API results, with offline context',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://tile.openstreetmap.org/**',route=>route.abort());
 await page.goto('/');await expect(page.getByText('30 nodes · 8 candidate sites')).toBeVisible();
 await page.getByRole('button',{name:'Load real-data demo preset →'}).click();
 await expect(page.getByText('19,205 nodes · 32 candidate sites')).toBeVisible();
 const study:Study=await (await page.request.get('/api/study-area?dataset_id=iowa')).json();
 await expect(page.locator('.place-label').getByText('Davenport',{exact:true})).toBeVisible();
 await expect(page.locator('.place-label').getByText('Bettendorf',{exact:true})).toBeVisible();
 await expect(page.getByTestId('map-context')).toContainText('dashed selection rectangle');
 await expect(page.locator('.leaflet-control-scale')).toBeVisible();
 await expect(page.getByLabel('North is up')).toBeVisible();
 const runs=await calculate(page);
 // Independently retain the documented preset's normal/minimum result values.
 expect(runs[1].metrics.normal.coverage).toBeCloseTo(.78220,5);
 expect(runs[2].summary.minimum_coverage).toBeCloseTo(.38799,5);
 for(let i=1;i<runs.length;i++){
  const a=runs[i],b=runs[i-1],summary=page.getByTestId(`${a.kind}-tradeoff`);
  await expect(summary).toContainText(`Normal coverage ${delta(a.metrics.normal.coverage,b.metrics.normal.coverage)}`);
  await expect(summary).toContainText(`scenario average ${delta(a.summary.average_coverage,b.summary.average_coverage)}`);
  await expect(summary).toContainText(`minimum coverage ${delta(a.summary.minimum_coverage,b.summary.minimum_coverage)}`);
 }
 for(const r of runs){
  await expect(page.getByTestId(`${r.kind}-worst`)).toHaveText(study.scenarios.find(s=>s.id===r.summary.worst_scenario)!.name);
  for(const sid of r.configuration.scenario_ids)await expect(page.getByTestId(`chart-${r.kind}-${sid}`)).toHaveText(percent(r.metrics[sid].coverage));
 }
 let calculations=0;page.on('request',r=>{if(r.method()==='POST')calculations++});
 await page.getByLabel('Stress-test view').selectOption('winter_closure');
 for(const run of runs){
  await page.getByRole('group',{name:'Map placement',exact:true}).getByRole('button',{name:run.kind[0].toUpperCase()+run.kind.slice(1),exact:true}).click();
  await expect(page.getByTestId('map-placement')).toHaveText(`${run.kind[0].toUpperCase()+run.kind.slice(1)} · ${run.selected_site_ids.length} selected sites`);
  const m=run.metrics.winter_closure;
  await expect(page.getByTestId('active-coverage')).toHaveText(percent(m.coverage));
  await expect(page.getByTestId('active-unreachable')).toHaveText(percent(m.unreachable_share));
  const expected=m.mean_s===null?'Unbounded (unreachable demand)':`${(m.mean_s/60).toFixed(2)} min`;
  await expect(page.getByTestId('active-mean')).toHaveText(expected);
  for(const [field,testId] of [['median_s','active-median'],['p90_s','active-p90'],['p95_s','active-p95']] as const){
   const value=m[field];await expect(page.getByTestId(testId)).toHaveText(value===null?'Unbounded (unreachable demand)':`${(value/60).toFixed(2)} min`);
  }
  await expect(page.getByTestId('active-reachable-mean')).toHaveText(m.reachable_mean_s===null?'No reachable demand':`${(m.reachable_mean_s/60).toFixed(2)} min`);
  if(m.unreachable_share>0)await expect(page.getByTestId('unreachable-explanation')).toContainText(`${percent(m.unreachable_share)} of weighted demand has no route`);
  const site=run.explanation.sites[0];
  await expect(page.getByLabel('Selected site')).toHaveValue('');
  await page.getByLabel('Selected site').selectOption(site.site_id);
  await expect(page.getByTestId('site-unique')).toHaveText(percent(site.unique_fraction));
  await expect(page.getByTestId('site-best-scenario')).toHaveText(study.scenarios.find(s=>s.id===site.best_scenario)!.name);
 }
 await page.getByRole('group',{name:'Map placement',exact:true}).getByRole('button',{name:'Latest',exact:true}).click();
 await expect(page.getByTestId('map-placement')).toContainText('Resilient');
 expect(calculations).toBe(0);
 await page.getByRole('button',{name:'View baseline on map ↑'}).click();
 await expect(page.getByRole('button',{name:'Baseline',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Fit study area'}).click();
 await page.screenshot({path:'../artifacts/polish-desktop.png',fullPage:true});
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:'../artifacts/polish-preset-viewport.png'});
 await page.locator('.chart').screenshot({path:'../artifacts/polish-preset-chart.png'});
 const fs=await import('node:fs');
 fs.writeFileSync('../artifacts/polish-api-evidence.json',JSON.stringify({runs:runs.map(r=>({kind:r.kind,run_id:r.run_id,selected_site_ids:r.selected_site_ids,metrics:r.metrics,summary:r.summary})),placementSwitchPostRequests:calculations},null,2));
 const label=page.getByTestId('chart-static-normal');
 expect(await label.evaluate(e=>Number.parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(12);
 await page.getByLabel('Threshold minutes').fill('6');
 await expect(page.getByTestId('map-placement')).toContainText('Stale');
 await expect(page.getByTestId('resilient-tradeoff')).toContainText('pp');
 expect(errors).toEqual([]);
});

test('populated mobile, tablet and desktop layouts keep actions visible, charts legible and content inside the viewport',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await expect(page.getByText('30 nodes · 8 candidate sites')).toBeVisible();
 const settings=page.getByRole('button',{name:/Edit planning assumptions/});
 await settings.focus();await page.keyboard.press('Enter');
 await expect(page.getByLabel('Study area')).toBeVisible();
 await page.getByRole('button',{name:/Advanced assumptions/}).click();
 await expect(page.getByLabel('Simulation trials')).toBeVisible();
 await page.getByRole('button',{name:/Hide planning assumptions/}).click();
 const runs=await calculate(page);
 await page.getByLabel('Stress-test view').selectOption('combined');
 const response=page.waitForResponse(r=>r.url().endsWith('/api/simulate'));
 await page.getByRole('button',{name:/Simulate & compare/}).click();
 const sim:Simulation=await (await response).json();
 await expect(page.getByText('10,000 sampled incidents per scenario')).toBeVisible();
 for(const [index,run] of runs.entries()){
  const m=sim.configurations[run.run_id].scenarios.combined;
  await expect(page.getByTestId(`${run.kind}-sampled`)).toHaveText(percent(m.coverage));
  const cells=page.locator('.simulation tbody tr').nth(index).locator('td');
  for(const [field,column] of [['mean_s',1],['median_s',2],['p90_s',3],['p95_s',4]] as const){
   const value=m[field];await expect(cells.nth(column)).toHaveText(value===null?'Unbounded (unreachable demand)':`${(value/60).toFixed(2)} min`);
  }
  for(const [i,count] of m.histogram.counts.entries())await expect(page.locator('.histogram section').nth(index).locator('.hist-row strong').nth(i)).toHaveText(count.toLocaleString());
 }
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  const workflow=page.getByRole('region',{name:'Planning workflow'});
  await expect(workflow).toBeInViewport();
  for(const [name] of steps)await expect(page.getByRole('button',{name:new RegExp(name)})).toBeInViewport();
  await expect(page.getByRole('button',{name:/Simulate & compare/})).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const ticks=await page.locator('.chart-scale span:visible').evaluateAll(elements=>elements.map(e=>({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})));
  for(let i=1;i<ticks.length;i++)expect(ticks[i].left).toBeGreaterThanOrEqual(ticks[i-1].right);
  const box=await page.getByRole('button',{name:/Resilience optimize/}).boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(64);expect(box!.y+box!.height).toBeLessThan(190);
  await page.screenshot({path:`../artifacts/polish-populated-${width}.png`,fullPage:true});
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:`../artifacts/polish-viewport-${width}.png`});
  await page.locator('.chart').screenshot({path:`../artifacts/polish-chart-${width}.png`});
  await page.locator('.chart').evaluate(e=>e.scrollIntoView({block:'start'}));
  await page.screenshot({path:`../artifacts/polish-chart-viewport-${width}.png`});
 }
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:/Edit planning assumptions/}).click();
 await expect(page.getByLabel('Access speed',{exact:true})).toBeVisible();
 await page.getByLabel('Access speed',{exact:true}).fill('10');
 await expect(page.getByText(/Results below are stale/)).toBeVisible();
 await expect(page.getByRole('button',{name:/Simulate & compare/})).toBeDisabled();
 expect(errors).toEqual([]);
});

test('equal site sets are reported honestly for actual greedy baseline and static runs',async({page})=>{
 await page.goto('/');await expect(page.getByText('30 nodes · 8 candidate sites')).toBeVisible();
 await page.getByRole('button',{name:/Advanced assumptions/}).click();
 await page.getByRole('combobox',{name:'Baseline',exact:true}).selectOption('greedy');
 await page.getByRole('combobox',{name:'Static solver',exact:true}).selectOption('greedy');
 const runs:Run[]=[];
 for(const [name,path] of steps.slice(0,2)){
  const response=page.waitForResponse(r=>r.url().endsWith(path)&&r.request().method()==='POST');
  await page.getByRole('button',{name:new RegExp(name)}).click();runs.push(await (await response).json());
  await expect(page.getByTestId(`${runs.at(-1)!.kind}-minimum`)).not.toHaveText('—');
 }
 expect([...runs[0].selected_site_ids].sort()).toEqual([...runs[1].selected_site_ids].sort());
 await expect(page.getByTestId('static-tradeoff')).toContainText('Both runs selected the same set of sites.');
 await expect(page.getByTestId('static-tradeoff')).toContainText('Normal coverage 0.0 pp');
});

test('travel labels distinguish absent demand, unreachable statistics and finite conditional statistics',()=>{
 const m:Metric={coverage:0,mean_s:null,median_s:null,p90_s:null,p95_s:null,reachable_mean_s:null,unreachable_share:0,total_weight:0,no_demand:true};
 expect(travel(null,m)).toBe('No demand');
 expect(travel(null,{...m,no_demand:false,total_weight:100,unreachable_share:.3})).toBe('Unbounded (unreachable demand)');
 expect(travel(120,{...m,no_demand:false,total_weight:100,unreachable_share:.3},true)).toBe('2.00 min');
 expect(travel(null,{...m,no_demand:false,total_weight:100,unreachable_share:1},true)).toBe('No reachable demand');
});
