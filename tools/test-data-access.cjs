'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{create,parseResults,validateManifest}=require('../data-access.js');
const hash=async text=>crypto.createHash('sha256').update(text).digest('hex');
async function fixture(){
 const data={version:1,updatedAt:'v1',competitions:[]},files={'data.js':'"use strict";\nwindow.PAINI_SHARED_DATA = '+JSON.stringify(data)+';\n','kattavuus.json':JSON.stringify({resultsVersion:'v1',total:{competitions:0}}),'ottelut-public.json':'{"version":3}'};
 const descriptors={};for(const [key,file]of Object.entries({results:'data.js',coverage:'kattavuus.json',bouts:'ottelut-public.json'}))descriptors[key]={file,sha256:await hash(files[file])};
 const manifest={version:1,revision:'a'.repeat(64),files:descriptors},store=new Map(),requests=[];let offline=false,broken=false;
 const io=create({base:'https://example.test/paini/',hash,cache:{get:async key=>store.get(key),put:async(key,text)=>store.set(key,text)},fetch:async url=>{requests.push(String(url));if(offline)throw Error('offline');const name=new URL(url).pathname.split('/').pop();return {ok:true,text:async()=>broken?'corrupt':files[name],json:async()=>manifest};}});
 return {io,manifest,data,store,requests,setOffline:()=>offline=true,setBroken:()=>broken=true};
}
test('verified data is reused offline and an unchanged revision never downloads the large result file twice',async()=>{
 const f=await fixture();await f.io.bundle(await f.io.manifest());await f.io.remember(f.manifest);f.io.clearMemory();f.setOffline();
 assert.deepEqual((await f.io.bundle(await f.io.previous())).data,f.data);assert.equal(f.requests.filter(url=>url.includes('data.js')).length,1);
});
test('mismatched publication, unsafe file paths and corrupt cached data cannot replace accepted data',async()=>{
 const f=await fixture();f.setBroken();await assert.rejects(()=>f.io.bundle(f.manifest),/täsmää/);assert.equal(f.store.size,0);
 const bad=structuredClone(f.manifest);bad.files.results.file='https://evil.test/data.js';assert.throws(()=>validateManifest(bad));
});
test('data source is parsed as JSON without executing JavaScript',()=>{
 assert.equal(parseResults('window.PAINI_SHARED_DATA={"version":1};').version,1);
 assert.throws(()=>parseResults('window.PAINI_SHARED_DATA={}; alert("bad");'));
});
test('failed private storage never prevents loading verified data',async()=>{
 const f=await fixture();const io=create({base:'https://example.test/',hash,cache:{get:()=>{throw Error();},put:()=>{throw Error();}},fetch:async url=>({ok:true,text:async()=>new URL(url).pathname==='/data.js'?'"use strict";\nwindow.PAINI_SHARED_DATA = '+JSON.stringify(f.data)+';\n':JSON.stringify({resultsVersion:'v1',total:{competitions:0}})})});
 assert.deepEqual((await io.bundle(f.manifest)).data,f.data);
});

test('coverage history is hash-verified, cached offline and rejects unsafe history references',async()=>{
 const f=await fixture(),history={version:1,samples:[]},text=JSON.stringify(history),cache=new Map();let offline=false;
 const manifest=structuredClone(f.manifest);manifest.files.coverageHistory={file:'kattavuushistoria.json',sha256:await hash(text)};
 const contents={'data.js':'window.PAINI_SHARED_DATA='+JSON.stringify(f.data),'kattavuus.json':JSON.stringify({resultsVersion:'v1',total:{competitions:0}}),'kattavuushistoria.json':text};
 manifest.files.results.sha256=await hash(contents['data.js']);
 const io=create({base:'https://test/',hash,cache:{get:async k=>cache.get(k),put:async(k,v)=>cache.set(k,v)},fetch:async url=>{if(offline)throw Error('offline');return {ok:true,text:async()=>contents[new URL(url).pathname.slice(1)]};}});
 assert.deepEqual((await io.bundle(manifest)).coverage.history,history);io.clearMemory();offline=true;assert.deepEqual((await io.bundle(manifest)).coverage.history,history);
 const bad=structuredClone(manifest);bad.files.coverageHistory.file='../history.json';assert.throws(()=>validateManifest(bad));
});
