'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../fresh-data.js'),'utf8');
const settle=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));};
function page(){
 const events={},docEvents={},intervals=[],updates=[],restores=[],scrolls=[];let rev='old',offline=false,invalid=false,focused=false,resolveBundle;
 const notice={},status={},state={view:'bouts',bouts:{a:'painija-000001',b:'painija-000002',mode:'pair',scope:'source',page:2},results:{search:'Urho'},page:3};
 const io={manifest:async()=>{if(offline)throw Error();return {revision:rev};},bundle:async()=>{if(resolveBundle)await resolveBundle;if(invalid)throw Error();return {data:{version:1,competitions:[]},coverage:{}};},previous:async()=>({revision:"old"}),remember:async()=>{},clearMemory(){},file:async()=>'{"version":3}'};
 const api={snapshot:()=>({data:{},coverage:{}}),capture:()=>structuredClone(state),busy:()=>false,validate(){},update:async bundle=>updates.push(bundle),restore:async saved=>{restores.push(saved);return true;}};
 const window={scrollX:0,scrollY:720,PAINI_DATA_IO:{create:()=>io},PAINI_BOUTS:{isReady:()=>true},PainiRegistry:{validate(){}},addEventListener:(name,fn)=>events[name]=fn,dispatchEvent(){},scrollTo:value=>scrolls.push(value)};
 const document={currentScript:{src:'https://example.test/paini/fresh-data.js'},hidden:false,get activeElement(){return {matches:()=>focused};},querySelector:s=>s==='#data-refresh-status'?notice:s==='#status'?status:null,addEventListener:(name,fn)=>docEvents[name]=fn,createElement:()=>({remove(){}}),head:{append(script){if(script.src.includes('/script.js'))window.PAINI_PAGE_STATE=api;queueMicrotask(()=>script.onload());}}};
 vm.runInNewContext(source,{window,document,URL,Event:class{},setTimeout,clearTimeout,setInterval:(fn,ms)=>intervals.push({fn,ms}),requestAnimationFrame:fn=>queueMicrotask(fn),Date,Promise,crypto:{},TextEncoder,Response});
 return {api,events,document,docEvents,state,updates,restores,scrolls,intervals,notice,setRev:value=>rev=value,setOffline:()=>offline=true,setInvalid:()=>invalid=true,setFocus:value=>focused=value,delay:promise=>resolveBundle=promise};
}
test('checks every 15 minutes, on return and online without reloading unchanged data',async()=>{
 const p=page();await settle();assert.equal(p.intervals[0].ms,900000);await p.events.online();await p.events.online();assert.equal(p.updates.length,0);assert.equal(typeof p.docEvents.visibilitychange,'function');
});
test('new revision retains view, wrestler IDs, scopes, filters, page and scroll',async()=>{
 const p=page();await settle();p.setRev('new');await p.events.online();await settle();assert.equal(p.updates.length,1);assert.deepEqual(p.restores[0],p.state);assert.equal(p.scrolls[0].top,720);
});
test('state is captured after download and concurrent checks share the same update',async()=>{
 const p=page();await settle();let done;p.delay(new Promise(resolve=>done=resolve));p.setRev('new');const first=p.events.online(),second=p.events.online();p.state.results.search='Changed while loading';done();await Promise.all([first,second]);assert.equal(p.updates.length,1);assert.equal(p.restores[0].results.search,'Changed while loading');
});
test('typing defers application until blur and uses the latest input state',async()=>{
 const p=page();await settle();p.setRev('new');p.setFocus(true);await p.events.online();assert.equal(p.updates.length,0);p.state.results.search='Typed';p.setFocus(false);p.docEvents.focusout();await new Promise(resolve=>setTimeout(resolve,5));await settle();assert.equal(p.restores[0].results.search,'Typed');
});
test('offline or invalid publication keeps previously loaded data untouched',async()=>{
 for(const failure of ['setOffline','setInvalid']){const p=page();await settle();p.setRev('new');p[failure]();await p.events.online();assert.equal(p.updates.length,0);assert.equal(p.restores.length,0);assert.match(p.notice.textContent,/Aiemmat tiedot/);}
});
test('hidden tabs do not fetch or update',async()=>{
 const p=page();await settle();p.setRev('new');p.document.hidden=true;await p.events.online();assert.equal(p.updates.length,0);
});

test('a failed UI restore rolls the dataset back and keeps the prior accepted revision',async()=>{
 const p=page();await settle();p.setRev('new');let attempts=0;p.api.restore=async()=>++attempts>1;
 await p.events.online();assert.equal(p.updates.length,2);assert.deepEqual(p.updates[1].data,{});assert.match(p.notice.textContent,/Aiemmat tiedot/);
});
test('startup can fall back to a previously verified cached manifest',async()=>{
 const p=page();p.setOffline();await settle();assert.equal(typeof p.api.capture,'function');assert.match(p.notice.textContent,/Aiemmin ladatut/);
});
