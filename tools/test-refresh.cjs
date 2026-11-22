'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../fresh-data.js'),'utf8');
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
function page({url='https://example.test/paini/',storage=new Map(),api,blocked=false,reportAt='2026-11-21T00:00:00Z'}={}){
 const events={},scrolls=[],restored=[],link={href:'',addEventListener:(name,fn)=>events[name]=fn};
 const location={href:url,get pathname(){return new URL(this.href).pathname;},replace(address){this.href=address;}};
 const window={location,scrollX:0,scrollY:720,setTimeout,clearTimeout,addEventListener(){},dispatchEvent(){},scrollTo:p=>scrolls.push(p),PAINI_PAGE_STATE:api};
 const document={currentScript:{src:'https://example.test/paini/fresh-data.js'},querySelector:s=>s==='#refresh-data'?link:null,querySelectorAll:()=>[],createElement:()=>({remove(){}}),head:{append(script){
  const file=new URL(script.src).pathname.split('/').pop();
  if(file==='data.js')window.PAINI_SHARED_DATA={competitions:[],updatedAt:'2026-11-21T00:00:00Z'};
  if(file==='haun-tila.js')window.PAINI_STARTUP_REPORT={updatedAt:reportAt};
  queueMicrotask(()=>script.onload());
 }}};
 const sessionStorage={getItem:key=>{if(blocked)throw Error('blocked');return storage.get(key)||null;},setItem:(key,value)=>{if(blocked)throw Error('blocked');storage.set(key,value);},removeItem:key=>storage.delete(key)};
 window.history={state:null,replaceState(_s,_t,href){location.href=href;}};
 if(!api)window.PAINI_PAGE_STATE={capture:()=>({view:'bouts',bouts:{mode:'pair',a:'painija-000001',b:'painija-000002',scope:'competition'}}),restore:async state=>{restored.push(state);return true;}};
 vm.runInNewContext(source,{window,document,location,sessionStorage,URL,Date,Math,Number,JSON,Promise,Event:class{},requestAnimationFrame:fn=>queueMicrotask(fn)});
 return {window,location,link,events,storage,scrolls,restored,click:()=>events.click({button:0})};
}
test('refresh restores the selected view and wrestler IDs once, after loading the new page',async()=>{
 const storage=new Map(),first=page({storage});await settle();first.click();
 assert.equal(storage.size,1);const url=first.link.href;
 const second=page({url,storage});await settle();
 assert.equal(second.restored.length,1);assert.equal(second.restored[0].view,'bouts');
 assert.equal(second.restored[0].bouts.a,'painija-000001');assert.equal(second.restored[0].bouts.b,'painija-000002');
 assert.equal(second.restored[0].bouts.scope,'competition');assert.equal(second.restored[0].bouts.mode,'pair');
 assert.equal(second.scrolls[0].top,720);assert.equal(storage.size,0);
 const third=page({url,storage});await settle();assert.equal(third.restored.length,0);
});
test('scroll restoration waits for asynchronous bout initialization',async()=>{
 const first=page();await settle();first.click();let finish;
 const pending=new Promise(resolve=>finish=resolve);
 const second=page({url:first.link.href,storage:first.storage,api:{restore:()=>pending}});
 await settle();assert.equal(second.scrolls.length,0);assert.equal(first.storage.size,1);
 finish(true);await settle();assert.equal(second.scrolls[0].top,720);assert.equal(first.storage.size,0);
});
test('a failed lazy load retains the pending refresh for retry',async()=>{
 const first=page();await settle();first.click();
 const failed=page({url:first.link.href,storage:first.storage,api:{restore:async()=>false}});
 await settle();assert.equal(failed.scrolls.length,0);assert.equal(first.storage.size,1);
 const retry=page({url:first.link.href,storage:first.storage});await settle();assert.equal(retry.restored.length,1);
});
test('normal visits, malformed data and expired refreshes cannot reopen old selections',async()=>{
 const first=page();await settle();first.click();
 const ordinary=page({storage:first.storage});await settle();assert.equal(ordinary.restored.length,0);
 const [key,value]=[...first.storage][0];const stored=JSON.parse(value);stored.at=Date.now()-31*60*1000;
 first.storage.set(key,JSON.stringify(stored));const expired=page({url:first.link.href,storage:first.storage});await settle();assert.equal(expired.restored.length,0);
 first.storage.set(key,'{broken');const invalid=page({url:first.link.href,storage:first.storage});await settle();assert.equal(invalid.restored.length,0);
});
test('unavailable storage and modified clicks keep the normal refresh link usable',async()=>{
 const blocked=page({blocked:true});await settle();assert.doesNotThrow(()=>blocked.click());assert.ok(new URL(blocked.link.href).searchParams.has('paivitys'));
 const first=page();await settle();first.events.click({button:0,metaKey:true});assert.equal(first.storage.size,0);
});
test('an automatic startup redirect carries the manual refresh token to its destination',async()=>{
 const first=page();await settle();first.click();
 const redirect=page({url:first.link.href,storage:first.storage,reportAt:'2026-11-22T00:00:00Z'});await settle();
 assert.ok(new URL(redirect.location.href).searchParams.has('autopaivitys'));assert.equal(first.storage.size,1);
 const final=page({url:redirect.location.href,storage:first.storage,reportAt:'2026-11-22T00:00:00Z'});await settle();
 assert.equal(final.restored.length,1);assert.equal(first.storage.size,0);
});
