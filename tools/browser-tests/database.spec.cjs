const {test,expect}=require('@playwright/test');
for(const mode of ['local','public'])test(`database ${mode} supports Unicode search, global sorting, paging and top horizontal scrolling`,async({page})=>{
 if(mode==='public')await page.route('**/api/database*',route=>route.fulfill({status:404,body:'not local'}));
 await page.goto('/tietokanta.html');await expect(page.locator('#database-status')).toContainText('Vain luku.');
 await page.selectOption('#database-table','athlete_stats');await page.selectOption('#database-sort','competitions-desc');
 await expect(page.locator('#database-table-scroll')).toHaveAttribute('aria-busy','false');
 await expect(page.locator('#database-rows tr')).toHaveCount(50);
 const values=await page.locator('#database-rows td[data-label="Kilpailuja"]').allTextContents();expect(Number(values[0])).toBeGreaterThan(1);expect(values.map(Number)).toEqual(values.map(Number).sort((a,b)=>b-a));
 await page.selectOption('#database-sort','wins-desc');await expect(page.locator('#database-table-scroll')).toHaveAttribute('aria-busy','false');
 const wins=await page.locator('#database-rows td[data-label="Voittoja"]').allTextContents();expect(Number(wins[0])).toBeGreaterThan(0);expect(wins.map(Number)).toEqual(wins.map(Number).sort((a,b)=>b-a));
 await page.locator('#database-next').click();await expect(page.locator('#database-page')).toContainText('Sivu 2');
 await page.locator('#database-query').fill('ömer');await expect(page.locator('#database-page')).toContainText('Sivu 1');await expect(page.locator('#database-rows')).toContainText(/Ömer/i);
 await page.locator('#database-query').fill('ÖMER');await expect(page.locator('#database-table-scroll')).toHaveAttribute('aria-busy','false');await expect(page.locator('#database-rows')).toContainText(/Ömer/i);
 await page.selectOption('#database-table','placements');await page.locator('#database-query').fill('');await expect(page.locator('#database-rows tr')).toHaveCount(50);
 await expect(page.locator('#database-right')).toBeEnabled();await page.locator('#database-right').click();await expect.poll(()=>page.locator('#database-table-scroll').evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
 const synced=await page.evaluate(()=>Math.abs(document.querySelector('#database-scroll-top').scrollLeft-document.querySelector('#database-table-scroll').scrollLeft)<2);expect(synced).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('#database-query').fill('no-such-row-981723987123');await expect(page.locator('#database-rows tr')).toHaveCount(0);await expect(page.locator('#database-prev')).toBeDisabled();await expect(page.locator('#database-next')).toBeDisabled();
});
test('random example changes the pair on every click and always shows a mutual bout',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>!!window.PAINI_PAGE_STATE);await page.locator('#nav-bouts').click();await expect(page.locator('#bouts-app')).toBeVisible();
 let previous;for(let n=0;n<5;n++){
  await page.locator('#bouts-example').click();await expect(page.locator('#bouts-results tr').first()).toBeVisible();
  const state=await page.evaluate(()=>window.PAINI_BOUTS.getState()),key=[state.a,state.b].sort().join('|');expect(state.a).not.toBe(state.b);expect(key).not.toBe(previous);expect(state.mode).toBe('pair');previous=key;
 }
});

test('archived PDF downloads as the verified original instead of unreadable text',async({page})=>{
 const zlib=require('node:zlib'),crypto=require('node:crypto'),raw=Buffer.from('%PDF-1.4\nverified source fixture\n%%EOF'),sha=crypto.createHash('sha256').update(raw).digest('hex');
 await page.route('**/tietovarasto/lahteet/'+sha+'.gz',route=>route.fulfill({status:200,contentType:'application/gzip',body:zlib.gzipSync(raw)}));
 await page.goto('/lahde.html?sha256='+sha);await expect(page.locator('#source-status')).toContainText('PDF-pöytäkirja');await expect(page.locator('#source-content')).toBeHidden();
 const pending=page.waitForEvent('download');await page.locator('#source-download').click();const download=await pending;expect(download.suggestedFilename()).toBe(sha+'.pdf');expect(require('node:fs').readFileSync(await download.path()).equals(raw)).toBe(true);
});
