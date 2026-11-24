'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function page(saved,blocked=false){const events={},storage=new Map(saved?[['paini-theme',saved]]:[]),select={value:'',addEventListener:(event,fn)=>events[event]=fn},root={dataset:{},style:{}},media={matches:false,addEventListener:(_,fn)=>events.system=fn};const document={documentElement:root,readyState:'complete',getElementById:()=>select};vm.runInNewContext(fs.readFileSync('theme.js','utf8'),{window:{matchMedia:()=>media},document,localStorage:{getItem:key=>{if(blocked)throw Error();return storage.get(key);},setItem:(key,value)=>{if(blocked)throw Error();storage.set(key,value);}}});return{root,select,media,storage,events,choose(value){select.value=value;events.change({target:select});}};}
test('theme selection persists and follows the system only when requested',()=>{
 const p=page();assert.equal(p.root.dataset.theme,'light');p.choose('dark');assert.equal(p.root.dataset.theme,'dark');assert.equal(page(p.storage.get('paini-theme')).root.dataset.theme,'dark');
 p.media.matches=false;p.events.system();assert.equal(p.root.dataset.theme,'dark');p.choose('system');assert.equal(p.root.dataset.theme,'light');p.media.matches=true;p.events.system();assert.equal(p.root.dataset.theme,'dark');
});
test('unavailable storage and invalid stored themes do not prevent rendering or switching',()=>{const p=page('invalid',true);assert.equal(p.root.dataset.theme,'light');assert.doesNotThrow(()=>p.choose('dark'));assert.equal(p.root.dataset.theme,'dark');});
