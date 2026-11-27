'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function page(saved='current',url='https://test/index.html',blocked=false){
 const store=new Map([['paini-appearance-v1',saved],['paini-theme','light'],['paini-home-v1','favorites-preserved']]),select={value:'',addEventListener:(event,fn)=>select.change=fn},theme={disabled:false},note={hidden:true},root={dataset:{}},location={href:url,search:new URL(url).search},events=[];
 const document={documentElement:root,readyState:'complete',getElementById:id=>({appearance:select,theme,'appearance-note':note}[id])};
 vm.runInNewContext(fs.readFileSync('appearance.js','utf8'),{URL,URLSearchParams,Event:class{},location,document,window:{dispatchEvent:e=>events.push(e)},history:{replaceState:(_,__,href)=>location.href=href},localStorage:{getItem:k=>{if(blocked)throw Error();return store.get(k)},setItem:(k,v)=>{if(blocked)throw Error();store.set(k,v)}}});
 return {store,select,theme,note,root,location,choose(value){select.change({target:{value}})}};
}
test('current design remains default and explicit comparison links override saved preference without overwriting it',()=>{
 assert.equal(page().root.dataset.appearance,'current');
 const a=page('arena','https://test/index.html?ilme=nykyinen');assert.equal(a.root.dataset.appearance,'current');assert.equal(a.store.get('paini-appearance-v1'),'arena');
 assert.equal(page('current','https://test/index.html?ilme=sinikulta').root.dataset.appearance,'arena');
});
test('switching versions keeps view, favorites and the original lightness setting and persists only its own preference',()=>{
 const p=page('current','https://test/index.html#nakyma=clubs');p.choose('arena');assert.equal(p.theme.disabled,true);assert.equal(p.note.hidden,false);assert.equal(p.store.get('paini-theme'),'light');assert.equal(p.store.get('paini-home-v1'),'favorites-preserved');assert.match(p.location.href,/\?ilme=sinikulta#nakyma=clubs$/);
 p.choose('current');assert.equal(p.theme.disabled,false);assert.equal(p.note.hidden,true);assert.equal(p.store.get('paini-appearance-v1'),'current');
});
test('invalid selections and unavailable storage do not break the default or comparison design',()=>{
 assert.equal(page('current','https://test/index.html?ilme=constructor').root.dataset.appearance,'current');
 const p=page('invalid','https://test/index.html',true);assert.equal(p.root.dataset.appearance,'current');p.choose('unknown');assert.equal(p.root.dataset.appearance,'current');p.choose('arena');assert.equal(p.root.dataset.appearance,'arena');
});
test('the privacy clear action removes the design preference while keeping unrelated storage',async()=>{
 const storage=new Map([['paini-appearance-v1','arena'],['unrelated','keep']]),status={};let clear;
 vm.runInNewContext(fs.readFileSync('storage-settings.js','utf8'),{document:{getElementById:id=>id==='clear-local'?{addEventListener:(_,fn)=>clear=fn}:status},localStorage:{removeItem:k=>storage.delete(k)},caches:{delete:async()=>true}});
 await clear();assert.equal(storage.has('paini-appearance-v1'),false);assert.equal(storage.get('unrelated'),'keep');
});

test('both additional styles honor direct links and saved choices without replacing the original theme',()=>{
 for(const [slug,choice] of [['kuulas','clarity'],['kupari','copper']]){
  const direct=page('current','https://test/index.html?ilme='+slug);assert.equal(direct.root.dataset.appearance,choice);assert.equal(direct.theme.disabled,true);assert.equal(direct.store.get('paini-theme'),'light');
  const saved=page(choice);assert.equal(saved.root.dataset.appearance,choice);
  const changed=page();changed.choose(choice);assert.equal(changed.store.get('paini-appearance-v1'),choice);assert.equal(new URL(changed.location.href).searchParams.get('ilme'),slug);changed.choose('current');assert.equal(changed.theme.disabled,false);
 }
});
test('a visible settings menu closes and returns focus when a visual design is chosen',()=>{
 let change,focused=false;const toggle={focus:()=>focused=true},panel={open:true,querySelector:()=>toggle},root={dataset:{}};
 vm.runInNewContext(fs.readFileSync('appearance.js','utf8'),{URL,URLSearchParams,Event:class{},location:{href:'https://test/',search:''},history:{replaceState(){}},document:{documentElement:root,readyState:'complete',getElementById:id=>id==='site-settings'?panel:id==='appearance'?{addEventListener:(_,fn)=>change=fn}:null},localStorage:{getItem(){},setItem(){}},window:{dispatchEvent(){}},getComputedStyle:()=>({display:'block'})});
 change({target:{value:'clarity'}});assert.equal(panel.open,false);assert.equal(focused,true);
});
