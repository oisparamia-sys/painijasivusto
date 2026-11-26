'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),N=require('../notifications.js');
const fav=[{id:'painija-000001'}];
const fixture=()=>({athleteRegistry:{athletes:[{id:'painija-000001'},{id:'painija-000002'}]},competitions:[{title:'Test',rows:[{resultId:'tulos-000001',athleteId:'painija-000001'}]}]});
test('first visit, adding a favorite, disabling and re-enabling do not announce historical results',()=>{
 const d=fixture();let s=N.advance(N.empty(),d,[]);s=N.advance(s,d,fav);assert.equal(s.items.length,0);s.enabled=false;d.competitions[0].rows.push({resultId:'tulos-000002',athleteId:fav[0].id});s=N.advance(s,d,fav);s.enabled=true;s=N.advance(s,d,fav);assert.equal(s.items.length,0);
});
test('a new published result appears exactly once and survives reload with read state',()=>{
 const d=fixture();let s=N.advance(N.empty(),d,fav);d.competitions[0].rows.push({resultId:'tulos-000002',athleteId:fav[0].id});s=N.advance(s,d,fav);assert.equal(N.visible(s,d,fav).length,1);s.items[0].read=true;s=N.advance(JSON.parse(JSON.stringify(s)),d,fav);assert.deepEqual(s.items,[{resultId:'tulos-000002',read:true,watch:['painija-000001']}]);
});
test('separations and registry merges never announce old reassignments or match by name',()=>{
 const d=fixture();let s=N.advance(N.empty(),d,fav);d.competitions[0].rows[0].athleteId='painija-000002';s=N.advance(s,d,fav);assert.equal(s.items.length,0);d.competitions[0].rows.push({resultId:'tulos-000002',athleteId:'painija-000002'});s=N.advance(s,d,fav);assert.equal(s.items.length,0);
 d.athleteRegistry.athletes[0].mergedInto='painija-000002';d.competitions[0].rows.push({resultId:'tulos-000003',athleteId:'painija-000002'});s=N.advance(s,d,fav);assert.equal(N.visible(s,d,fav).length,1);
 delete d.athleteRegistry.athletes[0].mergedInto;assert.equal(N.visible(s,d,fav).length,0);
});
test('removing and re-adding favorites does not create notifications, and corrupt storage is safe',()=>{
 const d=fixture();let s=N.advance(N.empty(),d,fav);s=N.advance(s,d,[]);d.competitions[0].rows.push({resultId:'tulos-000002',athleteId:fav[0].id});s=N.advance(s,d,fav);assert.equal(s.items.length,0);assert.deepEqual(N.read({getItem(){throw Error();}}),N.empty());assert.deepEqual(N.normalize({version:1,items:[null,{}]}).items,[]);
});
test('older offline snapshots do not move the cursor backwards',()=>{
 const d=fixture();const s=N.advance({...N.empty(),cursor:100},d,fav);assert.equal(s.cursor,100);
});

test('a newly followed different person never inherits a prior favorite notification after a split',()=>{
 const d=fixture();let s=N.advance(N.empty(),d,fav);const fresh={resultId:'tulos-000002',athleteId:fav[0].id};d.competitions[0].rows.push(fresh);s=N.advance(s,d,fav);assert.equal(N.visible(s,d,fav).length,1);fresh.athleteId='painija-000002';const next=[{id:'painija-000002'}];s=N.advance(s,d,next);assert.equal(N.visible(s,d,next).length,0);
});
