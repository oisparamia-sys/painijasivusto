'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const H=require('./coverage-history.cjs'),C=require('../coverage-chart.js');
const value=(extra={})=>({checkedAt:'2026-11-27T05:00:00Z',resultsVersion:'v1',total:{matches:100,points:99,methods:100,excluded:10,competitions:5,results:200,...extra}});
test('measurements preserve flat scan results, deduplicate repeated exports and reject invalid or retroactive points',()=>{
 const empty={version:1,samples:[]},a=H.append(empty,value(),'2026-11-27T06:00:00Z');
 assert.equal(empty.samples.length,0);assert.equal(H.append(a,value(),'2026-11-27T07:00:00Z'),a);
 const next={...value(),checkedAt:'2026-11-28T05:00:00Z'},b=H.append(a,next,'2026-11-28T06:00:00Z');assert.equal(b.samples.length,2);assert.deepEqual(a.samples[0].counts,b.samples[1].counts);
 assert.throws(()=>H.append(a,value({points:101}),'2026-11-28T06:00:00Z'));
 assert.throws(()=>H.append(a,value({points:98}),'2026-11-26T06:00:00Z'));
 assert.throws(()=>H.validate({version:2,samples:[]}));
});
test('series uses actual denominators and precise percentages, keeps missing values null and fits a labelled scale',()=>{
 let h=H.append({version:1,samples:[]},value(),'2026-11-27T06:00:00Z');
 h=H.append(h,value({matches:0,points:0,methods:0,excluded:0}),'2026-11-28T06:00:00Z');
 assert.equal(C.series(h,'points')[0].value,99);assert.equal(C.series(h,'points')[1].value,null);
 assert.equal(C.series(h,'accepted')[0].value,100/110*100);assert.deepEqual(C.bounds(C.series(h,'methods')),[98,100]);
 const b=C.bounds([{value:99.45},{value:99.49}]);assert.ok(b[0]<99.45&&b[1]>99.49&&b[1]-b[0]<0.2);
 assert.deepEqual(C.series(null,'points'),[]);assert.deepEqual(C.bounds([{value:null}]),[0,100]);
});
test('an unreadable history stops recording instead of silently deleting observations',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'paini-history-'));
 try{fs.writeFileSync(path.join(root,'kattavuushistoria.json'),'{"version":999}');assert.throws(()=>H.read(root));}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('the exporter records a changed measurement and publishes its verified history reference',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'paini-history-export-')),vm=require('node:vm'),ctx={window:{}};
 try{
  vm.runInNewContext(fs.readFileSync('athlete-registry.js','utf8'),ctx);
  const source='https://turniereklassisch.ringerdb.de/VT/2026/FI/Test/indexFIN.htm';
  const data=ctx.window.PainiRegistry.initialize({version:1,competitions:[{source,title:'Test',details:'1.1.2026',fileInfo:'testi',rows:[{name:'A Test',club:'A',place:1,category:'U17',weight:'50'},{name:'B Test',club:'B',place:2,category:'U17',weight:'50'}]}]});
  const rows=data.competitions[0].rows,bouts={version:2,checkedAt:'2026-11-27T05:00:00Z',competitions:[{key:source}],participants:rows.map(r=>({resultId:r.resultId,athleteId:r.athleteId,competition:source})),matches:[{id:'m1',competition:source,red:rows[0].resultId,blue:rows[1].resultId,winner:rows[0].resultId,code:'PV',points:[2,0],source:source.replace('indexFIN.htm','FIN50.htm')}],excluded:[]};
  fs.writeFileSync(path.join(root,'data.js'),ctx.window.PainiRegistry.exportSource(data));fs.writeFileSync(path.join(root,'ottelut-data.js'),'window.PAINI_BOUTS_DATA='+JSON.stringify(bouts));
  require('./export-bouts.cjs').build(root,{recordHistory:true,at:'2026-11-27T06:00:00Z'});
  const before=fs.readFileSync(path.join(root,'kattavuushistoria.json'),'utf8'),manifest=JSON.parse(fs.readFileSync(path.join(root,'aineisto-manifest.json')));
  assert.equal(manifest.files.coverageHistory.sha256,crypto.createHash('sha256').update(before).digest('hex'));assert.equal(JSON.parse(before).samples[0].counts.matches,1);
  require('./export-bouts.cjs').build(root,{recordHistory:true,at:'2026-11-27T07:00:00Z'});
  assert.equal(fs.readFileSync(path.join(root,'kattavuushistoria.json'),'utf8'),before);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('daily charts retain the last real measurement per Finnish day while labels omit year and time',()=>{
 const points=[{at:'2026-11-26T23:30:00Z',time:Date.parse('2026-11-26T23:30:00Z'),value:1},{at:'2026-11-27T05:00:00Z',time:Date.parse('2026-11-27T05:00:00Z'),value:2},{at:'2026-11-27T23:30:00Z',time:Date.parse('2026-11-27T23:30:00Z'),value:3}];
 const days=C.daily(points);assert.deepEqual(days.map(p=>p.value),[2,3]);assert.deepEqual(days.map(p=>p.day),['2026-11-27','2026-11-28']);assert.equal(C.shortDate(points[0].at),'27.11.');assert.equal(points.length,3);
});
