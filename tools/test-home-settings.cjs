'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),H=require('../home-settings.js');
const ctx={};vm.runInNewContext(fs.readFileSync('athlete-registry.js','utf8'),ctx);const R=ctx.PainiRegistry;
test('damaged or unavailable local storage uses defaults and cannot overwrite unrelated settings',()=>{
 const storage={getItem:()=>'{broken',setItem(){throw Error('blocked');}};assert.deepEqual(H.read(storage),H.defaults());assert.equal(H.write(storage,H.defaults()),false);assert.deepEqual(H.read(null),H.defaults());
 const calls=[];H.write({setItem:(...args)=>calls.push(args)},H.defaults());assert.equal(calls[0][0],'paini-home-v1');
});
test('section order and visibility survive persistence; malformed and duplicate entries are ignored',()=>{
 const state=H.normalize({version:1,sections:[{id:'latest',visible:false},{id:'latest'},{id:'unknown'},{id:'coverage'}],athletes:[{id:'evil',label:'bad'},{id:'painija-000001',label:'A'},{id:'painija-000001',label:'duplicate'}],clubs:[{id:'helsinki',label:'Helsinki'},{id:'helsingin painijat',label:'Helsingin Painijat'}]});
 assert.deepEqual(state.sections.map(s=>s.id),['latest','coverage','stats','favorites']);assert.equal(state.sections[0].visible,false);assert.equal(state.athletes.length,1);assert.equal(state.clubs.length,2);
 const store=new Map(),storage={getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)};assert.equal(H.write(storage,state),true);assert.deepEqual(H.read(storage),state);assert.equal(H.defaults().athletes.length,0);
});
test('moving an item preserves its visibility and favorites and respects list boundaries',()=>{
 const state=H.defaults();state.sections[1].visible=false;state.athletes=[{id:'painija-000001',label:'A'}];const moved=H.move(state,'favorites',-1);assert.equal(moved.sections[0].id,'favorites');assert.equal(moved.sections[0].visible,false);assert.deepEqual(moved.athletes,state.athletes);assert.deepEqual(H.move(moved,'favorites',-1),moved);assert.equal(state.sections[0].id,'stats');
});
test('favorite identity survives merging and undo without changing stored IDs or guessing from names',()=>{
 const competition=(title,club)=>({title,details:'Helsinki, 1.1.2026',fileInfo:'test',source:'https://example.test/'+title,rows:[{name:'Eino Laine',club,category:'Pojat',weight:'36',place:1}]});
 const data=R.initialize({version:1,competitions:[competition('A','Seura A'),competition('B','Seura B')]}),a=data.competitions[0].rows[0].athleteId,b=data.competitions[1].rows[0].athleteId;
 const state=H.defaults();state.athletes=[{id:b,label:'Eino Laine'}];const merged=R.merge(data,b,a),before=JSON.stringify(state);
 const resolve=H.resolver(merged);assert.equal(resolve(b),R.resolve(merged,b));assert.equal(H.resolvedAthletes(state,merged,R)[0].id,a);assert.equal(H.resolvedAthletes(state,R.undo(merged),R)[0].id,b);assert.equal(JSON.stringify(state),before);
 const both=H.defaults();both.athletes=[{id:a,label:'Eino Laine'},{id:b,label:'Eino Laine'}];assert.equal(H.resolvedAthletes(both,data,R).length,2);assert.equal(H.resolvedAthletes(both,merged,R).length,1);
});
test('an unavailable favorite remains removable without losing the other saved identities',()=>{
 const state=H.defaults();state.athletes=[{id:'painija-999999',label:'Aiempi suosikki'}];const before=JSON.stringify(state),data={athleteRegistry:{athletes:[]}};
 assert.deepEqual(H.resolvedAthletes(state,data,R),[{id:'painija-999999',name:'Aiempi suosikki',missing:true}]);assert.equal(JSON.stringify(state),before);
});
