'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {build,project}=require('./export-results.cjs'),{create}=require('../data-access.js');
const hash=async text=>crypto.createHash('sha256').update(text).digest('hex');
test('sharded public results preserve every row and stable identity while excluding undo payloads',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'paini-shards-'));
 try{
 const data={version:1,updatedAt:'v1',competitions:[{title:'Test',details:'2020',rows:Array.from({length:701},(_,i)=>({resultId:'tulos-'+i,athleteId:'painija-1',place:i+1}))}],athleteRegistry:{version:1,nextAthlete:2,nextResult:702,history:[{private:'undo copy'}],revertedHistory:[{private:'undone'}],athletes:[{id:'painija-1',name:'Test',status:'unreviewed',privateNote:'do not export'}]}};
 const entry=build(data,root),metrics=JSON.stringify({resultsVersion:'v1',total:{competitions:1}});fs.writeFileSync(path.join(root,'kattavuus.json'),metrics);
 const manifest={version:2,revision:'b'.repeat(64),files:{results:entry,coverage:{file:'kattavuus.json',sha256:await hash(metrics)},bouts:{file:'ottelut-public.json',sha256:'c'.repeat(64)}}},store=new Map();let offline=false;
 const io=create({base:'https://test/',hash,cache:{get:async k=>store.get(k),put:async(k,v)=>store.set(k,v)},fetch:async url=>{if(offline)throw Error('offline');return {ok:true,text:async()=>fs.readFileSync(path.join(root,new URL(url).pathname),'utf8')};}});
 assert.deepEqual((await io.bundle(manifest)).data,project(data));await io.remember(manifest);io.clearMemory();offline=true;assert.deepEqual((await io.bundle(await io.previous())).data,project(data));
 const index=JSON.parse(fs.readFileSync(path.join(root,'tulokset/index.json')));index.parts[0].file='../data.js';const text=JSON.stringify(index);fs.writeFileSync(path.join(root,'tulokset/index.json'),text);manifest.files.results.sha256=await hash(text);offline=false;await assert.rejects(()=>io.bundle(manifest),/osaviite/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('repeated exports keep the last distinct publication available',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'paini-previous-parts-'));
 try{const data={version:1,updatedAt:'v1',competitions:[{title:'Test',details:'2020',rows:[{resultId:'tulos-1',athleteId:'painija-1',place:1}]}],athleteRegistry:{version:1,nextAthlete:2,nextResult:2,history:[],athletes:[{id:'painija-1',name:'Test'}]}};
 build(data,root);const before=JSON.parse(fs.readFileSync(path.join(root,'tulokset/index.json')));data.updatedAt='v2';data.competitions[0].rows[0].place=2;build(data,root);build(data,root);
 const previous=JSON.parse(fs.readFileSync(path.join(root,'tulokset/previous-index.json')));assert.deepEqual(previous,before);for(const p of before.parts)assert.ok(fs.existsSync(path.join(root,p.file)));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
