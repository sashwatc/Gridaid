import {test,expect} from '@playwright/test';

test('the map fills the window, panels scroll internally, and fullscreen and map controls work',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.getByRole('button',{name:'Find a plan',exact:true})).toBeEnabled({timeout:20000});
 for(const viewport of [{width:1440,height:1000},{width:1024,height:768},{width:390,height:844},{width:320,height:640}]){
  await page.setViewportSize(viewport);
  await expect.poll(()=>page.locator('.citizen-leaflet').evaluate(e=>Math.round(e.getBoundingClientRect().height))).toBe(viewport.height-(viewport.width<=900?78:82));
  expect(await page.locator('.citizen-leaflet').evaluate(e=>e.getBoundingClientRect().width)).toBe(viewport.width);
  const sizes=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,panelWidth:document.querySelector('.workspace-panel-body')!.clientWidth,panelContent:document.querySelector('.workspace-panel-body')!.scrollWidth}));
  expect(sizes.width).toBe(viewport.width);expect(sizes.height).toBe(viewport.height);expect(sizes.panelContent).toBeLessThanOrEqual(sizes.panelWidth);
  await page.getByRole('button',{name:'Find a plan',exact:true}).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button',{name:'Find a plan',exact:true})).toBeInViewport();
  await page.getByRole('button',{name:'Data and methodology',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Data & methodology'})).toBeVisible();
  await page.getByRole('button',{name:'Plan',exact:true}).click();
  await expect(page.getByLabel('How many resources?')).toBeVisible();
  await page.getByRole('button',{name:'Hide panel'}).click();
  await expect(page.getByRole('complementary',{name:'Planning controls'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Open panel'})).toBeInViewport();
  await page.getByRole('button',{name:'Show whole area'}).click();
  await page.getByRole('link',{name:'Skip to controls'}).focus();
  await page.getByRole('link',{name:'Skip to controls'}).press('Enter');
  await expect(page.getByRole('complementary',{name:'Planning controls'})).toBeFocused();
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('button',{name:'Road map',exact:true}).click();
 await expect(page.getByRole('checkbox',{name:'Road lines'})).toHaveCount(0);
 await page.getByRole('button',{name:'Satellite',exact:true}).click();
 await expect(page.getByRole('checkbox',{name:'Road lines'})).toBeChecked();
 await page.getByRole('checkbox',{name:'Road lines'}).uncheck();
 await expect(page.getByRole('checkbox',{name:'Road lines'})).not.toBeChecked();
 await page.getByRole('button',{name:'Enter fullscreen'}).click();
 await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(true);
 await expect(page.getByRole('button',{name:'Exit fullscreen'})).toBeVisible();
 await page.getByRole('button',{name:'Exit fullscreen'}).click();
 await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(false);
 expect(errors).toEqual([]);
});

test('denser road traces stop on cancel and drawing remains usable with the panel hidden',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.getByRole('button',{name:'Find a plan',exact:true})).toBeEnabled({timeout:20000});
 let release!:()=>void;const held=new Promise<void>(r=>{release=r;});
 let finish!:()=>void;const finished=new Promise<void>(r=>{finish=r;});
 let announce!:()=>void;const fetched=new Promise<void>(r=>{announce=r;});
 await page.route('**/api/baseline',async route=>{try{const response=await route.fetch();announce();await held;await route.fulfill({response});}catch{/* Cancel discards this held response. */}finally{finish();}});
 try{
  await page.getByRole('button',{name:'Find a plan',exact:true}).click();
  await expect(page.getByTestId('map-activity')).toBeVisible();await fetched;
  const path=await page.locator('.calculation-road-line').getAttribute('d');
  expect((path?.match(/M/g)??[]).length).toBeGreaterThan(32);
  await expect(page.locator('.calculation-road-base')).toHaveCount(1);
  expect(await page.locator('.calculation-road-line').evaluate(e=>getComputedStyle(e).pointerEvents)).toBe('none');
  await page.screenshot({path:'../artifacts/workspace-road-activity.png'});
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByTestId('map-activity')).toHaveCount(0);
  await expect(page.locator('.calculation-road-line')).toHaveCount(0);
 }finally{release();}
 await finished;
 await page.getByRole('button',{name:'Draw an area',exact:true}).click();
 await expect(page.getByRole('button',{name:'Open panel'})).toBeVisible();
 await page.getByRole('button',{name:'Cancel selection'}).click();
 await page.getByRole('button',{name:'Open panel'}).click();
 await expect(page.getByLabel('How many resources?')).toBeVisible();
 expect(errors).toEqual([]);
});
