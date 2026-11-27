const {test,expect}=require('@playwright/test');
async function ready(page){await page.goto('/');await page.waitForFunction(()=>!!window.PAINI_PAGE_STATE);}
async function tab(page,name){await page.locator('#nav-'+name).click();await expect(page.locator('#'+({results:'search',competitions:'competition'}[name]||name)+'-view')).toBeVisible();}
async function brandReload(page){await Promise.all([page.waitForEvent('load'),page.locator('#brand-home').click()]);await page.waitForFunction(()=>!!window.PAINI_PAGE_STATE);}
async function noOverflow(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}
test('navigation starts each section at the top and fits a narrow phone',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);
 await page.locator('#home-filters summary').click();await page.selectOption('#home-year','2020');await page.locator('#home-search-form button[type=submit]').click();await expect(page.locator('#result-year')).toHaveValue('2020');await page.locator('#reset-filters').click();
 for(const name of ['results','clubs','home']){await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));await tab(page,name);expect(await page.evaluate(()=>scrollY)).toBeLessThan(5);await noOverflow(page);}
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
test('profile leads with year and summary and new favorite notifications appear only once',async({page})=>{
 await ready(page);await tab(page,'results');await page.locator('#results .name-button').first().click();await expect(page.locator('#profile-information')).not.toHaveAttribute('open','');
 expect((await page.locator('#wrestler-year').boundingBox()).height).toBeGreaterThanOrEqual(44);
 const summary=await page.locator('#wrestler-summary').boundingBox(),info=await page.locator('#profile-information').boundingBox();expect(summary.y).toBeLessThan(info.y);await page.locator('#favorite-athlete').click();await tab(page,'home');await page.locator('#notifications-details summary').click();await expect(page.locator('#notifications-list li')).toHaveCount(0);
 await page.evaluate(()=>{const selected=JSON.parse(localStorage.getItem('paini-home-v1')).athletes,data=structuredClone(window.PAINI_SHARED_DATA),id=selected[0].id;const existing=data.competitions.flatMap(c=>c.rows).find(r=>r.athleteId===id);const row={...existing,resultId:'tulos-'+String(data.athleteRegistry.nextResult++).padStart(6,'0')};data.competitions[0].rows.push(row);window.PAINI_NOTIFICATIONS.update(data,selected);window.PAINI_NOTIFICATIONS.update(data,selected);});
 await expect(page.locator('#notifications-list li')).toHaveCount(1);await expect(page.locator('#notifications-count')).toHaveText('1');await page.locator('#notifications-read').click();await expect(page.locator('#notifications-count')).toBeHidden();await page.locator('#notifications-clear').click();await expect(page.locator('#notifications-list li')).toHaveCount(0);await noOverflow(page);
});
test('database browser is read-only and can inspect bout points and source records',async({page})=>{
 await page.route('**/api/database',route=>route.fulfill({status:404,body:'Not available'}));await page.goto('/tietokanta.html');await expect(page.locator('#database-status')).toContainText('Vain luku.');await expect(page.locator('#database-rows tr')).toHaveCount(50);await page.selectOption('#database-table','matches');await expect(page.locator('#database-count')).toContainText('56');await expect(page.locator('#database-columns')).toContainText('Pisteet');await page.locator('#database-query').fill('2020');await expect(page.locator('#database-rows tr').first()).toContainText('2020');expect(await page.locator('button:not(#database-download)').allTextContents()).toEqual(['← Edellinen','Seuraava →']);await page.locator('#database-query').fill('');await page.selectOption('#database-table','source_versions');await expect(page.locator('#database-columns')).toContainText('Tarkistussumma');await expect(page.locator('#database-rows td').first()).toHaveAttribute('data-label','Tunnus');
});
test('database opens separately and its source and result references are actual links',async({page,context})=>{
 await context.route('https://turniereklassisch.ringerdb.de/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<h1>Official source test</h1>'}));
 await page.goto('/yllapito.html');const popupPromise=context.waitForEvent('page');await page.locator('#database-open').click();const inspector=await popupPromise;await inspector.waitForLoadState();await expect(page).toHaveURL(/yllapito.html/);await expect(inspector.locator('#database-status')).toContainText('Vain luku.');
 const source=inspector.locator('#database-rows a[href^="https://turniereklassisch.ringerdb.de/"]').first(),href=await source.getAttribute('href'),sourcePromise=context.waitForEvent('page');await source.click();const opened=await sourcePromise;await opened.waitForLoadState();expect(opened.url()).toBe(href);await opened.close();
 await inspector.selectOption('#database-table','matches');const result=inspector.locator('#database-rows a[href^="#table=placements"]').first(),id=await result.textContent();await result.click();await expect(inspector.locator('#database-table')).toHaveValue('placements');await expect(inspector.locator('#database-query')).toHaveValue(id);await expect(inspector.locator('#database-rows tr')).toHaveCount(1);const profilePromise=context.waitForEvent('page');await inspector.locator('#database-rows a[href*="index.html#painija="]').first().click();const profile=await profilePromise;await expect(profile.locator('#wrestler-title')).toBeVisible();expect(profile.url()).toContain('#painija=');await profile.close();await inspector.close();
});
test('database can be downloaded as an uncompressed SQLite file',async({page})=>{
 const {execFileSync}=require('node:child_process'),zlib=require('node:zlib'),fs=require('node:fs');
 const sqlite=execFileSync('python3',['-c',"import tempfile,pathlib,sqlite3,sys\nwith tempfile.TemporaryDirectory() as d:\n p=pathlib.Path(d)/'fixture.sqlite'\n c=sqlite3.connect(p);c.execute('create table test(id integer)');c.commit();c.close()\n sys.stdout.buffer.write(p.read_bytes())"]);
 await page.route('**/tietokanta.sqlite.gz',route=>route.fulfill({status:200,contentType:'application/gzip',body:zlib.gzipSync(sqlite)}));
 await page.goto('/tietokanta.html');const promise=page.waitForEvent('download');await page.locator('#database-download').click();const download=await promise;expect(download.suggestedFilename()).toBe('painijasivusto.sqlite');expect(fs.readFileSync(await download.path()).equals(sqlite)).toBeTruthy();await expect(page.locator('#database-file-status')).toContainText('valmis');
});
test('an archived source opens as verified text without executing its HTML',async({page,context})=>{
 const zlib=require('node:zlib'),crypto=require('node:crypto'),raw=Buffer.from('<html><script>window.archiveExecuted=true</script><p>Archived source</p></html>'),sha=crypto.createHash('sha256').update(raw).digest('hex');
 await context.route('**/tietovarasto/lahteet/'+sha+'.gz',route=>route.fulfill({status:200,contentType:'application/gzip',body:zlib.gzipSync(raw)}));
 await page.goto('/lahde.html?sha256='+sha);await expect(page.locator('#source-status')).toContainText('tarkistettu');await expect(page.locator('#source-content')).toContainText('Archived source');expect(await page.evaluate(()=>window.archiveExecuted)).toBeUndefined();
});

test('tapping Home again closes its panels and suggestions while preserving selections',async({page})=>{
 await ready(page);
 for(const id of ['site-settings','home-customize','home-filters','notifications-details'])await page.locator('#'+id+' > summary').click();
 await page.selectOption('#home-year','2020');await page.locator('#home-search').fill('Tahir');await expect(page.locator('#home-search-suggestions')).toBeVisible();
 await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));await page.locator('#nav-home').click();
 await expect(page.locator('#site-settings[open], #home-view details[open]')).toHaveCount(0);await expect(page.locator('#home-search-suggestions')).toBeHidden();expect(await page.evaluate(()=>scrollY)).toBeLessThan(5);
 await expect(page.locator('#home-search')).toHaveValue('Tahir');await expect(page.locator('#home-year')).toHaveValue('2020');
 await page.locator('#site-settings > summary').click();await expect(page.locator('#theme')).toBeVisible();
});

test('competition directory belongs to administration and its result links still work',async({page,context})=>{
 await ready(page);await expect(page.locator('.view-nav button')).toHaveCount(4);await expect(page.locator('#nav-competitions, #competition-view')).toHaveCount(0);
 await page.goto('/index.html#nakyma=competitions');await page.waitForFunction(()=>!!window.PAINI_PAGE_STATE);await expect(page.locator('#search-view')).toBeVisible();
 await page.goto('/kilpailut.html');await expect(page.locator('#admin-competition-count')).toContainText('347 kilpailua');await page.locator('#admin-competition-query').fill('tamperen');await expect(page.locator('#admin-competition-options')).toBeVisible();await page.selectOption('#admin-competition-year','2020');
 const link=page.locator('#admin-competition-list a').filter({hasText:'Näytä tulokset'}).first(),href=await link.getAttribute('href'),identity=new URLSearchParams(new URL(href).hash.slice(1)).get('kilpailu');const opened=context.waitForEvent('page');await link.click();const results=await opened;await expect(results.locator('#search-view')).toBeVisible();await expect(results.locator('#competition')).toHaveValue(identity);await expect(results.locator('#results tr').first()).toBeVisible();await results.close();
});

test('redesigned hero preserves typed search, contrast, shortcuts and the brand Home action',async({page})=>{
 await ready(page);
 await expect(page.locator('.hero-picture img')).toBeVisible();
 expect(await page.locator('.hero-picture img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBeTruthy();
 for(const theme of ['light','dark']){
  await page.locator('#site-settings summary').click();await page.selectOption('#theme',theme);await page.locator('#site-settings summary').click();
  await page.locator('#home-search').fill('Tahir');await expect(page.locator('#home-search-suggestions')).toBeVisible();
  const colors=await page.locator('#home-search').evaluate(el=>{const s=getComputedStyle(el);return [s.color,s.backgroundColor,s.webkitTextFillColor];});
  expect(colors).toEqual(['rgb(25, 28, 36)','rgb(255, 255, 255)','rgb(25, 28, 36)']);await page.locator('#home-search').press('Escape');await expect(page.locator('#home-search')).toHaveValue('Tahir');await noOverflow(page);
 }
 await page.locator('#home-search-form button[type=submit]').click();await expect(page.locator('#search')).toHaveValue('Tahir');await expect(page.locator('#results tr').first()).toBeVisible();
 await brandReload(page);await expect(page.locator('#home-view')).toBeVisible();await page.locator('#home-customize>summary').click();await brandReload(page);await expect(page.locator('#home-customize')).not.toHaveAttribute('open','');
 await page.locator('.hero-shortcuts [data-open-view="bouts"]').click();await expect(page.locator('#bouts-view')).toBeVisible();await noOverflow(page);
});

test('home coverage is a compact text summary without charts or a measurement table',async({page,context})=>{
 await ready(page);const box=page.locator('#home-coverage');await expect(box).toContainText('Tuonnin kattavuusvaroituksia sisältäviä kilpailuja:');await expect(box.locator('svg,meter,table')).toHaveCount(0);await noOverflow(page);
 await page.locator('#site-settings summary').click();await page.selectOption('#theme','dark');await page.locator('#site-settings summary').click();await noOverflow(page);
 await context.setOffline(true);await tab(page,'results');await tab(page,'home');await expect(box.locator('svg,meter,table')).toHaveCount(0);await context.setOffline(false);
});

test('reload always starts at the top and the top Home brand performs a full home reload',async({page})=>{
 await ready(page);
 for(let attempt=0;attempt<2;attempt++){
  await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(100);
  await page.reload();await page.waitForFunction(()=>!!window.PAINI_PAGE_STATE);expect(await page.evaluate(()=>scrollY)).toBeLessThan(5);
  await page.waitForTimeout(250);expect(await page.evaluate(()=>scrollY)).toBeLessThan(5);
 }
 await tab(page,'results');await page.evaluate(()=>{window.reloadMarker='must disappear';localStorage.setItem('paini-scroll-test','preserve');});
 await brandReload(page);await expect(page.locator('#home-view')).toBeVisible();expect(await page.evaluate(()=>scrollY)).toBeLessThan(5);
 expect(await page.evaluate(()=>window.reloadMarker)).toBeUndefined();expect(await page.evaluate(()=>localStorage.getItem('paini-scroll-test'))).toBe('preserve');
 expect(new URL(page.url()).hash).toBe('');
});

test('blue and gold comparison preserves fuzzy searches, favorites, theme preference and the selected view',async({page})=>{
 await ready(page);await page.locator('#site-settings summary').click();await page.selectOption('#theme','light');await page.selectOption('#appearance','arena');
 await expect(page.locator('html')).toHaveAttribute('data-appearance','arena');await expect(page.locator('#theme')).toBeDisabled();await expect(page.locator('#site-settings')).not.toHaveAttribute('open','');await noOverflow(page);
 await tab(page,'results');await page.locator('#search').fill('Tahir');await expect(page.locator('#search-suggestions')).toBeVisible();await page.locator('#search').press('Escape');await page.locator('#results .name-button').first().click();await page.locator('#favorite-athlete').click();await expect(page.locator('#favorite-athlete')).toHaveAttribute('aria-pressed','true');
 await page.locator('#site-settings summary').click();await page.selectOption('#appearance','current');await expect(page.locator('#theme')).toBeEnabled();await expect(page.locator('#theme')).toHaveValue('light');await expect(page.locator('#site-settings')).not.toHaveAttribute('open','');await expect(page.locator('#favorite-athlete')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#wrestler-view')).toBeVisible();await noOverflow(page);
 await page.goto('/index.html?ilme=sinikulta');await page.waitForFunction(()=>!!window.PAINI_PAGE_STATE);await expect(page.locator('html')).toHaveAttribute('data-appearance','arena');await expect(page.locator('#home-selected-favorites')).toContainText('Tahir');await tab(page,'home');
 await expect(page.locator('#home-coverage svg')).toHaveCount(0);
 await page.locator('.hero-shortcuts [data-open-view=bouts]').click();await expect(page.locator('#bouts-view')).toBeVisible();await page.locator('#bouts-example').click();await expect(page.locator('#bouts-results tr').first()).toBeVisible();await noOverflow(page);
});
test('comparison page opens both real designs independently',async({page})=>{
 await page.goto('/ulkoasuvertailu.html');await noOverflow(page);
 const current=page.locator('iframe').nth(0),arena=page.locator('iframe').nth(1);await current.scrollIntoViewIfNeeded();await expect(current.contentFrame().locator('html')).toHaveAttribute('data-appearance','current');
 await arena.scrollIntoViewIfNeeded();await expect(arena.contentFrame().locator('html')).toHaveAttribute('data-appearance','arena');await expect(arena.contentFrame().locator('#home-heading')).toBeVisible();await noOverflow(page);
});

test('Kuulas and Kupari keep queries and original theme while selection closes mobile settings',async({page})=>{
 await ready(page);await page.locator('#site-settings summary').click();await page.selectOption('#theme','dark');await page.locator('#site-settings summary').click();
 for(const [slug,appearance,note] of [['kuulas','clarity','Kuulas on vaalea ulkoasu.'],['kupari','copper','Kupari on tumma ulkoasu.']]){
  await page.goto('/index.html?ilme='+slug);await page.waitForFunction(()=>!!window.PAINI_PAGE_STATE);await expect(page.locator('html')).toHaveAttribute('data-appearance',appearance);await noOverflow(page);
  await page.locator('#nav-results').click();await page.locator('#search').fill('Tahir');await expect(page.locator('#search-suggestions')).toBeVisible();await page.locator('#search').press('Escape');
  await page.locator('#site-settings summary').click();await expect(page.locator('#appearance-note')).toHaveText(note);await expect(page.locator('#theme')).toBeDisabled();await page.selectOption('#appearance','current');await expect(page.locator('#site-settings')).not.toHaveAttribute('open','');await expect(page.locator('#search')).toHaveValue('Tahir');
  await page.locator('#site-settings summary').click();await expect(page.locator('#theme')).toHaveValue('dark');await page.selectOption('#appearance',appearance);await expect(page.locator('#site-settings')).not.toHaveAttribute('open','');await expect(page.locator('#search')).toHaveValue('Tahir');await expect(page.locator('#search-view')).toBeVisible();await noOverflow(page);
  await page.locator('#results .name-button').first().click();await expect(page.locator('#wrestler-title')).toBeVisible();await page.locator('#nav-clubs').click();await page.locator('#club-search').fill('helsngin');await expect(page.locator('#club-list')).toContainText('Helsingin');await noOverflow(page);
  await page.locator('#nav-bouts').click();await page.locator('#bouts-example').click();await expect(page.locator('#bouts-results tr').first()).toBeVisible();await noOverflow(page);
 }
});
test('all four designs are available as independent comparison previews',async({page})=>{
 await page.goto('/ulkoasuvertailu.html');await expect(page.locator('iframe')).toHaveCount(4);
 for(const [i,appearance] of [[0,'current'],[1,'arena'],[2,'clarity'],[3,'copper']]){
  const iframe=page.locator('iframe').nth(i);await iframe.scrollIntoViewIfNeeded();await expect(iframe.contentFrame().locator('html')).toHaveAttribute('data-appearance',appearance);
 }
 await noOverflow(page);
});
