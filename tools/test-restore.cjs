'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib');
const Q=require('./review-core.cjs'),D=require('./review-data.cjs'),E=require('./export-bouts.cjs'),S=require('./restore-data.cjs');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../athlete-registry.js'),'utf8'),ctx);const R=ctx.window.PainiRegistry;
const source='https://turniereklassisch.ringerdb.de/VT/2026/FI/Testi/indexFIN.htm';
const activeFiles=['data.js','ottelut-data.js','ottelut-public.json','ottelut-manifest.json','kattavuus.json','aineisto-manifest.json','muutosjono.json','hyvaksyntapaatokset.json'];
const contents=root=>Object.fromEntries(activeFiles.map(file=>[file,fs.readFileSync(path.join(root,file),'utf8')]));
function fixture(run){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'paini-restore-test-'));
 try{
  fs.copyFileSync(path.join(__dirname,'../athlete-registry.js'),path.join(root,'athlete-registry.js'));
  let data=R.initialize({version:1,competitions:[{title:'Testi',details:'Testi, 1.1.2026',fileInfo:'testi',source,rows:[{name:'A Testi',club:'Seura',category:'Pojat',weight:'30',place:1},{name:'B Testi',club:'Seura',category:'Pojat',weight:'30',place:2},{name:'A Testi',club:'Seura',category:'Juniorit',weight:'40',place:1}]}]});
  const rows=data.competitions[0].rows;
  let bouts={version:2,checkedAt:'2026-11-21T12:00:00Z',competitions:[{key:source,title:'Testi',details:'Testi, 1.1.2026',year:2026}],participants:rows.map(r=>({competition:source,resultId:r.resultId,athleteId:r.athleteId,category:r.category,weight:r.weight})),matches:[{id:'m1',competition:source,category:'Pojat',weight:'30',round:'1',red:rows[0].resultId,blue:rows[1].resultId,winner:rows[0].resultId,code:'PV',points:[4,2],source:source.replace('indexFIN.htm','FIN30beg.htm')}],excluded:[],issues:[]};
  const save=()=>{
   fs.writeFileSync(path.join(root,'data.js'),R.exportSource(data));
   fs.writeFileSync(path.join(root,'ottelut-data.js'),'window.PAINI_BOUTS_DATA = '+JSON.stringify(bouts)+';');
   E.build(root);
  };
  fs.writeFileSync(path.join(root,'muutosjono.json'),JSON.stringify({version:1,proposals:[],history:[{note:'säilytä'}]}));
  fs.writeFileSync(path.join(root,'hyvaksyntapaatokset.json'),JSON.stringify({version:1,decisions:[]}));
  save();Q.snapshot(root,'before');const older=contents(root);
  data=R.split(data,rows[0].athleteId,[rows[0].resultId],'A Testi');
  bouts=D.rebindBouts(data,bouts);bouts.matches[0].points=[5,2];
  save();Q.snapshot(root,'after');const newer=contents(root);
  run({root,older,newer});
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
test('preview lists impact without changing live files or snapshot history',()=>fixture(({root,newer})=>{
 const indexBefore=fs.readFileSync(path.join(root,'tietovarasto/index.json'),'utf8');
 assert.equal(S.list(root).length,2);
 const plan=S.preview(root,1);
 assert.equal(plan.competitions,1);assert.equal(plan.results,3);assert.equal(plan.matches,1);
 assert.deepEqual(plan.changedFiles.filter(f=>activeFiles.includes(f)),activeFiles.slice(0,6));
 assert.deepEqual(contents(root),newer);
 assert.equal(fs.readFileSync(path.join(root,'tietovarasto/index.json'),'utf8'),indexBefore);
}));
test('restore recovers identities, results and public bouts together and is itself reversible',()=>fixture(({root,older,newer})=>{
 const result=S.restore(root,1);assert.equal(result.applied,true);
 assert.deepEqual(contents(root),older);
 const state=D.load(root);state.R.validate(state.data);D.validateBouts(state.data,state.bouts,state.R);
 const packed=JSON.parse(fs.readFileSync(path.join(root,'ottelut-public.json')));
 assert.equal(packed.participants[0][1],state.bouts.participants[0].athleteId);
 const store=JSON.parse(fs.readFileSync(path.join(root,'tietovarasto/index.json')));
 assert.equal(store.runs[2].label,'before-restore');assert.equal(store.runs[3].label,'after-restore');
 S.restore(root,3);assert.deepEqual(contents(root),newer);
}));
test('restore refuses invalid or incomplete snapshot selections before any live writes',()=>fixture(({root,newer})=>{
 for(const number of [0,-1,1.5,99,NaN])assert.throws(()=>S.restore(root,number),/tallennuspisteen numero/);
 const file=path.join(root,'tietovarasto/index.json'),store=JSON.parse(fs.readFileSync(file));
 delete store.runs[0].refs['ottelut-data.js'];fs.writeFileSync(file,JSON.stringify(store));
 assert.throws(()=>S.restore(root,1),/puuttuu ottelut-data.js/);
 assert.deepEqual(contents(root),newer);
}));
test('restore refuses damaged bytes and mismatched competition/bout identities',()=>{
 for(const mode of ['checksum','missing','mixed'])fixture(({root,newer})=>{
  const file=path.join(root,'tietovarasto/index.json'),store=JSON.parse(fs.readFileSync(file));
  if(mode==='mixed'){
   store.runs[0].refs['ottelut-data.js']=store.runs[1].refs['ottelut-data.js'];
   fs.writeFileSync(file,JSON.stringify(store));
  }else{
   const version=store.versions.find(v=>v.file==='data.js'&&v.sha256===store.runs[0].refs['data.js']);
   if(mode==='missing')fs.unlinkSync(path.join(root,version.blob));
   else fs.writeFileSync(path.join(root,version.blob),zlib.gzipSync(Buffer.from('muutettu aineisto')));
  }
  const before=fs.readFileSync(file,'utf8');
  assert.throws(()=>S.restore(root,1));assert.deepEqual(contents(root),newer);
  assert.equal(fs.readFileSync(file,'utf8'),before);
 });
});
test('a failed file replacement restores the current files and leaves a recoverable safety snapshot',()=>fixture(({root,newer})=>{
 const original=fs.renameSync;let interrupted=false;
 fs.renameSync=function(from,to){
  if(!interrupted&&to===path.join(root,'ottelut-public.json')){interrupted=true;throw Error('Testin kirjoituskatkos');}
  return original.call(this,from,to);
 };
 try{assert.throws(()=>S.restore(root,1),/kirjoituskatkos/);}finally{fs.renameSync=original;}
 assert.equal(interrupted,true);assert.deepEqual(contents(root),newer);
 const store=JSON.parse(fs.readFileSync(path.join(root,'tietovarasto/index.json')));
 assert.equal(store.runs.at(-1).label,'before-restore');
}));
test('an unchanged restore is a no-op and a broken current backup stops replacement',()=>fixture(({root,newer})=>{
 const indexPath=path.join(root,'tietovarasto/index.json'),before=fs.readFileSync(indexPath,'utf8');
 assert.equal(S.restore(root,2).applied,false);
 assert.equal(fs.readFileSync(indexPath,'utf8'),before);
 const store=JSON.parse(before),version=store.versions.find(v=>v.file==='data.js'&&v.sha256===store.runs[1].refs['data.js']);
 fs.writeFileSync(path.join(root,version.blob),'rikki');
 assert.throws(()=>S.restore(root,1),/Varmuuskopion tarkistus epäonnistui/);
 assert.deepEqual(contents(root),newer);
}));

test('export refuses invalid result identifiers before changing public bouts or coverage',()=>fixture(({root})=>{
 const before=contents(root),context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'data.js'),'utf8'),context);
 context.window.PAINI_SHARED_DATA.competitions[0].rows[0].athleteId='missing-person';
 fs.writeFileSync(path.join(root,'data.js'),'window.PAINI_SHARED_DATA='+JSON.stringify(context.window.PAINI_SHARED_DATA));
 assert.throws(()=>E.build(root));
 for(const file of ['ottelut-public.json','ottelut-manifest.json','kattavuus.json','aineisto-manifest.json'])assert.equal(fs.readFileSync(path.join(root,file),'utf8'),before[file]);
}));

test('restored publication contains all result chunks referenced by its manifest',()=>fixture(({root})=>{
 S.restore(root,1);const crypto=require('node:crypto'),manifest=JSON.parse(fs.readFileSync(path.join(root,'aineisto-manifest.json'))),index=JSON.parse(fs.readFileSync(path.join(root,manifest.files.results.file)));
 for(const part of index.parts){const bytes=fs.readFileSync(path.join(root,part.file));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),part.sha256);}
}));
test('restore rebuilds the shared database and its read-only publication with the restored identities',()=>fixture(({root,older})=>{
 fs.writeFileSync(path.join(root,'tietovarasto/lahdehistoria.jsonl'),'');
 require('node:child_process').execFileSync(process.env.PAINI_PYTHON||'python3',[path.join(__dirname,'shared-database.py'),'build','--root',root]);
 S.restore(root,1);const saved=require('./shared-database.cjs').read(root);
 assert.equal(saved.bouts.matches[0].points[0],4);assert.equal(saved.data.competitions[0].rows[0].athleteId,D.load(root).data.competitions[0].rows[0].athleteId);
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'aineisto-manifest.json'))),viewer=JSON.parse(fs.readFileSync(path.join(root,'database-public-index.json')));assert.equal(manifest.databaseRevision,viewer.revision);
}));

test('restoring a dataset preserves coverage history and publishes its verified descriptor',()=>fixture(({root})=>{
 const state=D.load(root),coverage=require('../site-metrics.js').coverage(state.data,state.bouts),history=require('./coverage-history.cjs').append({version:1,samples:[]},coverage,'2026-11-27T06:00:00Z'),text=JSON.stringify(history)+'\n';fs.writeFileSync(path.join(root,'kattavuushistoria.json'),text);E.build(root);
 S.restore(root,1);
 assert.equal(fs.readFileSync(path.join(root,'kattavuushistoria.json'),'utf8'),text);
 const descriptor=JSON.parse(fs.readFileSync(path.join(root,'aineisto-manifest.json'))).files.coverageHistory;assert.equal(descriptor.sha256,require('node:crypto').createHash('sha256').update(text).digest('hex'));
}));
