const {test,expect}=require('@playwright/test');
async function ready(page){await page.goto('/');await page.waitForFunction(()=>!!window.PAINI_PAGE_STATE);}
async function tab(page,name){await page.locator('#nav-'+name).click();await expect(page.locator('#'+({results:'search',competitions:'competition'}[name]||name)+'-view')).toBeVisible();}
async function noOverflow(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}
test('navigation starts each section at the top and fits a narrow phone',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);
 await page.locator('#home-filters summary').click();await page.selectOption('#home-year','2020');await page.locator('#home-search-form button[type=submit]').click();await expect(page.locator('#result-year')).toHaveValue('2020');await page.locator('#reset-filters').click();
 for(const name of ['results','competitions','clubs','home']){await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));await tab(page,name);expect(await page.evaluate(()=>scrollY)).toBeLessThan(5);await noOverflow(page);}
 await page.locator('#site-settings summary').click();await page.selectOption('#theme','dark');await page.locator('#site-settings summary').click();await tab(page,'results');await expect(page.locator('#results tr').first()).toBeVisible();await noOverflow(page);expect(errors).toEqual([]);
});
test('fuzzy suggestions, club filters and favorite star work and persist',async({page})=>{
 await ready(page);await tab(page,'clubs');await page.locator('#club-search').fill('helsngin');await expect(page.locator('#club-search-suggestions')).toBeVisible();await expect(page.locator('#club-list')).toContainText('Helsingin');
 await page.locator('#club-filters summary').click();await page.selectOption('#club-list-year','2021');await page.selectOption('#club-list-kind','club');await noOverflow(page);
 await tab(page,'results');await page.locator('#search').fill('Tahir');await expect(page.locator('#search-suggestions')).toBeVisible();await page.locator('#search').press('Escape');await page.locator('#results .name-button').first().click();const star=page.locator('#favorite-athlete');await expect(star).toBeVisible();await expect(star).toHaveAttribute('aria-pressed','false');await star.click();await expect(star).toHaveAttribute('aria-pressed','true');await expect(page.locator('#favorite-notice')).toHaveText('Painija valittu suosikiksi.');await page.reload();await page.waitForFunction(()=>!!window.PAINI_PAGE_STATE);await expect(star).toHaveAttribute('aria-pressed','true');await star.click();await expect(star).toHaveAttribute('aria-pressed','false');
});
test('bouts opens immediately during slow startup and retries a failed download',async({page})=>{
 let failed=false;await page.route('**/ottelut-public.json*',async route=>{if(!failed){failed=true;await route.abort();}else await route.continue();});
 await page.route('**/tulokset/*.json*',async route=>{await new Promise(r=>setTimeout(r,100));await route.continue();});
 await page.goto('/');await tab(page,'bouts');await expect(page.locator('#bouts-heading')).toBeVisible();await page.waitForFunction(()=>!!window.PAINI_PAGE_STATE);await expect(page.locator('#bouts-retry')).toBeVisible();await page.locator('#bouts-retry').click();await expect(page.locator('#bouts-app')).toBeVisible();await expect(page.locator('#bout-search-a')).toBeEnabled();await page.locator('#bout-search-a').fill('Tahir');await expect(page.locator('#bout-options-a')).toBeVisible();await page.reload();await expect(page.locator('#bouts-view')).toBeVisible();await expect(page.locator('#bouts-app')).toBeVisible();await noOverflow(page);
});
test('previously verified data and favorites remain usable offline',async({page,context})=>{
 await ready(page);await page.waitForFunction(async()=>!!await (await caches.open('paini-data-v1')).match(new URL('paini-last-manifest',location.href)));
 await context.setOffline(true);await tab(page,'results');await page.locator('#search').fill('Tahir');await expect(page.locator('#results tr').first()).toBeVisible();await tab(page,'clubs');await expect(page.locator('#club-list article').first()).toBeVisible();await context.setOffline(false);
});
