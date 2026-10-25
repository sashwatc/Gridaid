import {test,expect} from '@playwright/test';
import type {Run} from '../src/types';
import {distance,feet,kphToMph,mphToKph} from '../src/units';

test('dark mode persists, road activity follows real requests, and selected locations display imperial distances',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({colorScheme:'light'});
 await page.goto('/');await expect(page.getByRole('button',{name:'Find a plan',exact:true})).toBeEnabled({timeout:20000});
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.getByRole('button',{name:'Switch to dark mode'}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.reload();await expect(page.getByRole('button',{name:'Find a plan',exact:true})).toBeEnabled({timeout:20000});
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await expect(page.getByTestId('calculation-model')).toHaveAttribute('data-ml-active','false');
 await expect(page.getByTestId('calculation-model')).toContainText('Census population model');
 let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});
 let submitted:Record<string,unknown>|undefined;
 await page.route('**/api/baseline',async route=>{submitted=route.request().postDataJSON();const response=await route.fetch();await held;try{await route.fulfill({response});}catch{/* A cancelled page can discard the response. */}});
 try{
  await page.getByRole('button',{name:'Find a plan',exact:true}).click();
  await expect(page.getByTestId('map-activity')).toBeVisible();
  await expect(page.locator('.calculation-road-line')).toHaveCount(1);
  await expect(page.getByTestId('calculation-phase')).toContainText('1 of 3');
  await expect(page.getByTestId('calculation-model')).toHaveAttribute('data-ml-active','false');
  expect(await page.locator('.calculation-road-line').evaluate(e=>getComputedStyle(e).animationName)).toBe('road-flow');
  await expect.poll(()=>submitted?.access_speed_kph).toBe(20);
  await page.locator('.citizen-map').screenshot({path:'../artifacts/appearance-dark-calculating.png'});
 }finally{release();}
 await expect(page.getByText('4 suggested locations.')).toBeVisible({timeout:45000});
 await expect(page.getByTestId('map-activity')).toHaveCount(0);
 await expect(page.locator('.calculation-road-line')).toHaveCount(0);
 await page.locator('.suggested-locations button').first().click();
 await expect(page.getByTestId('point-distance')).toContainText('0 ft',{timeout:20000});
 await expect(page.locator('.leaflet-control-scale-line')).toContainText(/mi|ft/);
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.getByRole('button',{name:'Switch to light mode'}).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button',{name:'Switch to light mode'})).toBeInViewport();
  await page.screenshot({path:`../artifacts/appearance-dark-${width}.png`,fullPage:true});
 }
 await page.getByRole('button',{name:'Switch to light mode'}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 expect(errors).toEqual([]);
});

test('Iowa forecast activity matches the real model and mph controls convert back to API units',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({colorScheme:'dark'});
 await page.goto('/?view=advanced&dataset=iowa&demand=blended');
 await expect(page.getByText('19,205 nodes · 32 candidate sites')).toBeVisible({timeout:20000});
 await expect(page.getByTestId('calculation-model')).toHaveAttribute('data-ml-active','true');
 await expect(page.getByTestId('calculation-model')).toContainText('Random forest + population');
 await expect(page.getByTestId('calculation-model')).toContainText('50.0% population + 50.0% predicted incident weight');
 await expect(page.getByTestId('calculation-model')).toContainText('precomputed predictions');
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.getByRole('button',{name:/Advanced assumptions/}).click();
 await expect(page.getByLabel('Access speed',{exact:true})).toHaveValue('12.43');
 await page.getByLabel('Access speed',{exact:true}).fill('5');
 let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});
 let result:Run|undefined;let finished!:()=>void;const completed=new Promise<void>(resolve=>{finished=resolve;});
 await page.route('**/api/baseline',async route=>{const response=await route.fetch();result=await response.json();await held;try{await route.fulfill({response});}finally{finished();}});
 try{
  await page.getByRole('button',{name:/Load baseline/}).click();
  await expect(page.getByTestId('calculation-phase')).toContainText('Calculating baseline');
  await expect(page.getByTestId('map-activity')).toBeVisible();
  await expect(page.getByTestId('calculation-model')).toHaveAttribute('data-ml-active','true');
  await page.getByTestId('calculation-model').screenshot({path:'../artifacts/appearance-ml-status.png'});
 }finally{release();}
 await completed;await expect(page.getByTestId('baseline-normal')).not.toHaveText('—');
 expect(result!.configuration.access_speed_kph).toBeCloseTo(8.04672,8);
 expect(result!.configuration.demand_model).toBe('blended');
 expect(result!.model_version).toBeTruthy();
 await expect(page.getByTestId('map-activity')).toHaveCount(0);
 await page.getByLabel('Population blend',{exact:true}).focus();await page.getByLabel('Population blend',{exact:true}).press('End');
 await expect(page.getByTestId('calculation-model')).toHaveAttribute('data-ml-active','false');
 await expect(page.getByTestId('calculation-model')).toContainText('zero weight');
 expect(errors).toEqual([]);
});

test('reduced motion and map teardown remain safe during an in-flight calculation',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'reduce',colorScheme:'dark'});
 await page.goto('/?view=advanced');await expect(page.getByText('30 nodes · 8 candidate sites')).toBeVisible();
 await expect(page.getByTestId('calculation-model')).toContainText('Synthetic population model');
 let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});
 let announce!:()=>void;const fetched=new Promise<void>(resolve=>{announce=resolve;});
 let finish!:()=>void;const completed=new Promise<void>(resolve=>{finish=resolve;});
 await page.route('**/api/baseline',async route=>{try{const response=await route.fetch();announce();await held;await route.fulfill({response});}catch{/* The control change cancels the held response. */}finally{finish();}});
 try{
  await page.getByRole('button',{name:/Load baseline/}).click();
  await expect(page.getByTestId('map-activity')).toBeVisible();
  expect(await page.locator('.calculation-road-line').evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
  await fetched;
  await page.getByRole('button',{name:'Methodology & trust'}).click();
  await expect(page.locator('.calculation-road-line')).toHaveCount(0);
  await page.getByRole('button',{name:'Planning workspace'}).click();
  await expect(page.getByTestId('map-activity')).toBeVisible();
  await page.getByLabel('Threshold minutes').fill('6');
  await expect(page.getByTestId('map-activity')).toHaveCount(0);
 }finally{release();}
 await completed;
 expect(errors).toEqual([]);
});

test('imperial conversion respects physical mile/foot/speed definitions',()=>{
 expect(distance(1609.344)).toBe('1.00 mi');
 expect(feet(1609.344)).toBe('5,280 ft');
 expect(distance(.3048)).toBe('1 ft');
 expect(mphToKph(60)).toBeCloseTo(96.56064,8);
 expect(kphToMph(96.56064)).toBeCloseTo(60,8);
});
