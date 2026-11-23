'use strict';
// Run from the project directory: node tools/benchmark-bout-search.cjs
// Compare indexed searches with a full wrestler scan; never change project data.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{performance}=require('node:perf_hooks');
const B=require('../ottelut.js'),context={window:{}};
for(const file of ['athlete-registry.js','data.js'])vm.runInNewContext(fs.readFileSync(file,'utf8'),context);
const raw=JSON.parse(fs.readFileSync('ottelut-public.json','utf8'));
let start=performance.now();
const prepared=B.prepare(context.window.PAINI_SHARED_DATA,context.window.PainiRegistry,B.unpack(raw)),index=B.createSearch(prepared.people);
const prepareMs=performance.now()-start;
const queries=['','a','al','ale','aleks','aleksi','aleksi m','aleksi mä','urho','urho s','urho su','urho susi','urho ssui','mikael','mikale','j','jo','joh','joon','joona','antti','annti','susi','suis','zzz','john smith'];
let scanMs=0,indexMs=0;
for(const query of queries){
 const tokens=B.words(query);start=performance.now();
 const expected=prepared.people.filter(person=>B.matchesName(person,tokens)).map(person=>person.id);scanMs+=performance.now()-start;
 start=performance.now();const found=index.find(tokens),actual=prepared.people.filter(person=>found.has(person.id)).map(person=>person.id);indexMs+=performance.now()-start;
 assert.deepEqual(actual,expected,'Search results differ: '+query);
}
console.log(JSON.stringify({queries:queries.length,people:prepared.people.length,bouts:prepared.matches.length,prepareMs,scanMs,indexMs,speedup:scanMs/indexMs,identicalResults:true},null,2));
