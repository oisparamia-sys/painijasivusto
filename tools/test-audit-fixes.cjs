'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Q=require('./review-core.cjs'),A=require('../admin-export.js'),U=require('../site-utils.js');
test('a failed approval file replacement rolls back every already written file',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'paini-transaction-test-')),files=['data.js','muutosjono.json','hyvaksyntapaatokset.json'];
 try{
  for(const file of files)fs.writeFileSync(path.join(root,file),'before '+file);
  const rename=fs.renameSync;let failed=false;
  fs.renameSync=(from,to)=>{if(to===path.join(root,'muutosjono.json')&&!failed){failed=true;throw Error('disk failure');}return rename(from,to);};
  try{assert.throws(()=>Q.transaction(root,new Map(files.map(f=>[f,'after']))),/disk failure/);}finally{fs.renameSync=rename;}
  for(const file of files)assert.equal(fs.readFileSync(path.join(root,file),'utf8'),'before '+file);
  // An interrupted process leaves an undo journal, recovered before any reuse.
  fs.writeFileSync(path.join(root,'.paini-transaction.json'),JSON.stringify([['data.js',Buffer.from('recover').toString('base64')]]));
  Q.recover(root);assert.equal(fs.readFileSync(path.join(root,'data.js'),'utf8'),'recover');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('admin export keeps later automatic imports and refuses conflicting IDs',()=>{
 const base={competitions:[{source:'one',title:'One',rows:[{resultId:'r1',place:1}]}],athleteRegistry:{nextAthlete:2,nextResult:2,athletes:[{id:'a1',name:'A'}],history:[]}};
 const ours=structuredClone(base);ours.competitions[0].rows[0].place=2;
 const latest=structuredClone(base);latest.competitions.push({source:'two',title:'New automatic import',rows:[]});latest.athleteRegistry.nextResult=3;
 const saved=A.merge(base,ours,latest);assert.equal(saved.competitions.length,2);assert.equal(saved.competitions[0].rows[0].place,2);assert.equal(saved.athleteRegistry.nextResult,3);
 latest.competitions[0].rows[0].place=3;assert.throws(()=>A.merge(base,ours,latest),/Vienti keskeytettiin/);
 const a=structuredClone(base),b=structuredClone(base);a.athleteRegistry.athletes.push({id:'a2',name:'Maija'});b.athleteRegistry.athletes.push({id:'a2',name:'Ville'});assert.throws(()=>A.merge(base,a,b),/Vienti keskeytettiin/);
});
test('indexed fuzzy search preserves exact dates and the existing search semantics',()=>{
 const texts=['Helsingin Paini-Miehet, 3.8.2025','Turun Voimamiehet, 8.3.2025','Äänekoski, 3.–4.8.2025'];
 for(const query of ['helsngin','3.8','8.3','3.8.2025','voimamihet','4.8','aänekoski']){
  const matcher=U.compileCompetitionQuery(query);for(const text of texts)assert.equal(matcher(U.prepareCompetitionText(text)),U.matchesCompetitionQuery(text,query));
 }
 assert.equal(U.compileCompetitionQuery('3.8')(U.prepareCompetitionText(texts[1])),false);
});

test('random examples include every distinct pair and never repeat immediately',()=>{
 const pick=require('../ottelut.js').randomExample;
 const m=(a,b)=>({red:{id:a},blue:{id:b}}),matches=[m('a','b'),m('b','a'),m('b','c'),m('a','c'),m('a','a')];
 const keys=[0,.4,.99].map(n=>pick(matches,null,()=>n).key);assert.equal(new Set(keys).size,3);
 const first=pick(matches,null,()=>0),second=pick(matches,first.key,()=>0);assert.notEqual(first.key,second.key);
 assert.equal(pick([],null),null);assert.equal(pick([m('a','a')]),null);assert.equal(pick([m('a','b')]).onlyPair,true);
});

test('source identity survives a changed event title and refuses a title collision',()=>{
 const vm=require('node:vm'),ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../athlete-registry.js'),'utf8'),ctx);const R=ctx.window.PainiRegistry;
 const competition=(source,title)=>({source,title,details:'Helsinki, 1.1.2026',fileInfo:'Testi',rows:[{place:1,name:source,club:'Seura',category:'Pojat',weight:'30'}]});
 const base=R.initialize({version:1,competitions:[competition('source-one','First'),competition('source-two','Second')]}),id=base.competitions[0].rows[0].resultId;
 const renamed=R.importCompetitions(base,[competition('source-one','Renamed')],{matchBySource:true});assert.equal(renamed.competitions.length,2);assert.equal(renamed.competitions.find(c=>c.source==='source-one').rows[0].resultId,id);
 assert.throws(()=>R.importCompetitions(base,[competition('source-one','Second')],{matchBySource:true}),/törmää/);
});
