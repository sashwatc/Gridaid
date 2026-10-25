import {test,expect} from '@playwright/test';
import type {PointRouteResult,Run,Study} from '../src/types';

test.use({actionTimeout:15000});

test('city selection and a dragged, movable area change the actual planning inputs and population',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://services.arcgisonline.com/**',route=>route.abort());
 const study:Study=await (await page.request.get('/api/study-area?dataset_id=quad_cities')).json();
 await page.goto('/');
 await expect(page.getByRole('button',{name:'Find a plan',exact:true})).toBeEnabled();
 await page.getByLabel('Add a city').selectOption({label:'Moline, IL'});
 await expect(page.getByTestId('area-preview')).toContainText('12 census points');
 await expect(page.getByRole('button',{name:'Remove Moline'})).toBeVisible();
 await page.getByLabel('Add a city').selectOption({label:'Rock Island, IL'});
 await expect(page.getByTestId('area-preview')).toContainText('24 census points');
 await expect(page.getByRole('button',{name:'Remove Rock Island'})).toBeVisible();
 await page.getByRole('button',{name:'Whole Quad Cities',exact:true}).click();
 await expect(page.getByTestId('area-preview')).toContainText('82 census points');
 await page.getByRole('button',{name:'Draw an area',exact:true}).click();
 const map=page.locator('.citizen-leaflet');await map.scrollIntoViewIfNeeded();const box=(await map.boundingBox())!;
 await page.mouse.move(box.x+box.width*.18,box.y+box.height*.13);await page.mouse.down();
 await page.mouse.move(box.x+box.width*.86,box.y+box.height*.87,{steps:12});await page.mouse.up();
 await expect(page.getByText(/Custom area · drag the center/)).toBeVisible();
 await expect(page.locator('.area-corner')).toHaveCount(4);
 const corner=page.getByTitle('Resize area corner 3',{exact:true});const cornerBox=(await corner.boundingBox())!;
 await page.mouse.move(cornerBox.x+8,cornerBox.y+8);await page.mouse.down();await page.mouse.move(cornerBox.x-7,cornerBox.y+20,{steps:8});await page.mouse.up();
 const move=page.getByTitle('Move selected area',{exact:true});const handle=(await move.boundingBox())!;
 await page.mouse.move(handle.x+15,handle.y+15);await page.mouse.down();await page.mouse.move(handle.x+35,handle.y+20,{steps:8});await page.mouse.up();
 await expect(page.getByRole('button',{name:'Find a plan',exact:true})).toBeEnabled();
 const response=page.waitForResponse(r=>r.url().endsWith('/api/baseline')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Find a plan',exact:true}).click();const baseline:Run=await (await response).json();
 const bounds=baseline.configuration.focus_bounds!;expect(bounds).toHaveLength(4);expect(baseline.configuration.focus_city_ids).toEqual([]);
 const selected=study.dataset.demands.filter(d=>d.origin_lat!>=bounds[0]&&d.origin_lat!<=bounds[2]&&d.origin_lon!>=bounds[1]&&d.origin_lon!<=bounds[3]);
 expect(baseline.metrics.normal.total_weight).toBe(selected.reduce((sum,d)=>sum+d.population,0));
 expect(selected.length).toBeLessThan(study.dataset.demands.length);
 await expect(page.getByText('4 suggested locations.')).toBeVisible({timeout:60000});
 await page.getByRole('button',{name:'Check the largest population coverage gap →'}).click();
 await expect(page.getByLabel('Travel direction')).toHaveValue('from_resource');
 await expect(page.getByTestId('point-time')).toBeVisible({timeout:25000});
 await expect(page.getByTestId('point-impact')).toBeVisible();
 await page.screenshot({path:'../artifacts/quad-area-route-desktop.png',fullPage:true});
 await page.getByLabel('Add a city').selectOption({label:'Bettendorf, IA'});
 await expect(page.getByTestId('recommended-normal')).toHaveCount(0);
 await expect(page.getByLabel('Travel direction')).toHaveCount(0);
 expect(errors).toEqual([]);
});

test('clicking the Illinois map shows API-matched nearest location, backup, distance and reverse travel',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.getByRole('button',{name:'Find a plan',exact:true})).toBeEnabled();
 await page.getByLabel('Add a city').selectOption({label:'Moline, IL'});
 const map=page.locator('.citizen-leaflet');await map.scrollIntoViewIfNeeded();
 const box=(await map.boundingBox())!;
 const response=page.waitForResponse(r=>r.url().endsWith('/api/route/point')&&r.request().method()==='POST');
 await map.click({position:{x:box.width*.48,y:box.height*.52}});
 const res=await response;expect(res.status()).toBe(200);const result:PointRouteResult=await res.json();
 expect(result.scope).toBe('mapped_facilities');const best=result.conditions.at(-1)!.routes[0];expect(best).toBeTruthy();
 await expect(page.getByTestId('point-time')).toHaveText(`${(best.time_s/60).toFixed(1)} min`);
 await expect(page.getByTestId('point-distance')).toContainText(best.distance_m<160.9344?`${Math.round(best.distance_m/.3048).toLocaleString()} ft`:`${(best.distance_m/1609.344).toFixed(2)} mi`);
 await expect(page.getByTestId('point-nearest')).toHaveText(best.label);
 expect(best.community).toBe('Moline city');expect(best.source_url).toContain('openstreetmap.org');
 if(result.conditions.at(-1)!.routes[1])await expect(page.getByTestId('point-backup')).toBeVisible();
 await expect(page.locator('.point-map-summary')).toContainText(best.label);
 const reverse=page.waitForResponse(r=>r.url().endsWith('/api/route/point')&&r.request().method()==='POST');
 await page.getByLabel('Travel direction').selectOption('from_resource');
 const reverseRes=await reverse;expect(reverseRes.status()).toBe(200);const backwards:PointRouteResult=await reverseRes.json();
 const incoming=backwards.conditions.at(-1)!.routes[0];
 await expect(page.getByTestId('point-time')).toHaveText(`${(incoming.time_s/60).toFixed(1)} min`);
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({path:`../artifacts/quad-point-${width}.png`,fullPage:true});
 }
 await page.getByRole('button',{name:'Clear checked point'}).click();await expect(page.getByTestId('point-time')).toHaveCount(0);
 expect(errors).toEqual([]);
});
