const {test,expect}=require('@playwright/test');
async function ready(page){await page.goto('/');await page.waitForFunction(()=>!!window.PAINI_PAGE_STATE);}
test('home overview and navigation work while full results are still loading',async({page})=>{
 let release;const blocked=new Promise(resolve=>release=resolve);
 await page.route('**/tulokset/competitions-*.json*',async route=>{await blocked;await route.continue();});
 await page.goto('/');await expect(page.locator('#home-latest article')).toHaveCount(6);
 expect(await page.evaluate(()=>!!window.PAINI_PAGE_STATE)).toBe(false);
 await page.locator('#home-latest button').first().click();await expect(page.locator('#search-view')).toBeVisible();
 release();await page.waitForFunction(()=>!!window.PAINI_PAGE_STATE);await expect(page.locator('#competition')).not.toHaveValue('');
});
test('a failed application initialization is not reported as a successful load',async({page})=>{
 await page.route('**/script.js?*',route=>route.fulfill({contentType:'text/javascript',body:'/* simulated failed initialization */'}));
 await page.goto('/');await expect(page.locator('#status')).toContainText('Sivua ei voitu käynnistää');await expect(page.locator('#status')).toBeVisible();
 expect(await page.evaluate(()=>!!window.PAINI_PAGE_STATE)).toBe(false);
});
test('home year survives a prior single competition selection',async({page})=>{
 await ready(page);await page.locator('#nav-results').click();
 await page.evaluate(()=>{const select=document.querySelector('#competition');const option=[...select.options].find(o=>o.textContent.includes('.2020'));select.value=option.value;select.dispatchEvent(new Event('change'));});
 await page.locator('#nav-home').click();await page.locator('#home-filters summary').click();await page.selectOption('#home-year','2026');await page.locator('#home-search-form button[type=submit]').click();
 await expect(page.locator('#result-year')).toHaveValue('2026');
});
test('browser Back restores result scroll and data refresh keeps focus visible',async({page})=>{
 await ready(page);await page.locator('#nav-results').click();await page.evaluate(()=>scrollTo(0,1000));
 const before=await page.evaluate(()=>scrollY);await page.locator('#results .name-button').nth(15).evaluate(el=>el.click());await expect(page.locator('#wrestler-view')).toBeVisible();
 await page.goBack();await expect(page.locator('#search-view')).toBeVisible();await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(before-10);
 await page.locator('#nav-clubs').click();await page.locator('#club-list button').first().click();await page.locator('#nav-results').click();await page.locator('#search').focus();
 expect(await page.evaluate(async()=>{const api=window.PAINI_PAGE_STATE,state=api.capture();api.update(api.snapshot());await api.restore(state);return document.activeElement.id==='search'&&!document.activeElement.closest('[hidden]');})).toBe(true);
});
test('club details keep the selected wrestling style',async({page})=>{
 await ready(page);await page.locator('#nav-clubs').click();await page.locator('#club-filters summary').click();await page.selectOption('#club-list-style','freestyle');
 const card=page.locator('#club-list article').filter({has:page.getByRole('heading',{name:'Helsingin Paini-Miehet',exact:true})}).first();
 const summary=await card.locator('p').first().textContent(),count=Number(summary.match(/(\d+) kilpailua/)[1]);await card.locator('button').click();
 await expect(page.locator('#club-competitions > li')).toHaveCount(count);
});
test('resetting the home layout preserves favorite athletes',async({page})=>{
 await ready(page);await page.locator('#nav-results').click();await page.locator('#results .name-button').first().click();await page.locator('#favorite-athlete').click();
 const before=await page.evaluate(()=>localStorage.getItem('paini-home-v1'));await page.locator('#nav-home').click();await page.locator('#home-customize summary').first().click();await page.locator('#home-reset').click();
 const after=await page.evaluate(()=>localStorage.getItem('paini-home-v1'));expect(before).not.toBeNull();expect(JSON.parse(after).athletes).toEqual(JSON.parse(before).athletes);
});
test('search suggestion ArrowUp starts at the last option',async({page})=>{
 await ready(page);await page.locator('#home-search').fill('hels');const options=page.locator('#home-search-suggestions [role=option]');await expect(options.first()).toBeVisible();
 const last=await options.last().getAttribute('id');await page.locator('#home-search').press('ArrowUp');await expect(page.locator('#home-search')).toHaveAttribute('aria-activedescendant',last);
});
test('reinitializing bouts does not retain previous document click listeners',async({page})=>{
 await ready(page);await page.locator('#nav-bouts').click();await expect(page.locator('#bouts-app')).toBeVisible();
 const counts=await page.evaluate(async()=>{
  let active=0;const original=document.addEventListener.bind(document);document.addEventListener=(type,fn,options)=>{if(type==='click'&&options?.signal){active++;options.signal.addEventListener('abort',()=>active--,{once:true});}return original(type,fn,options);};
  const counts=[],api=window.PAINI_BOUTS,packed=api.snapshot();for(let n=0;n<3;n++){api.reset(packed);await api.init(window.PAINI_SHARED_DATA,window.PainiRegistry);counts.push(active);}return counts;
 });expect(counts).toEqual([2,2,2]);
});
