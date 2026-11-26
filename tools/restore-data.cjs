'use strict';
// Usage: node tools/restore-data.cjs list|preview|apply <project-directory> [run-number]
// Run numbers are one-based positions in tietovarasto/index.json, oldest first.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),crypto=require('node:crypto'),zlib=require('node:zlib');
const Q=require('./review-core.cjs'),D=require('./review-data.cjs'),E=require('./export-bouts.cjs');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function index(root){
 const value=JSON.parse(fs.readFileSync(path.join(root,'tietovarasto/index.json'),'utf8'));
 if(value.version!==1||!Array.isArray(value.runs)||!Array.isArray(value.versions))throw Error('Tietovaraston hakemisto ei kelpaa');
 return value;
}
function list(root='.'){
 return index(root).runs.map((run,i)=>({number:i+1,at:run.at,label:run.label}));
}
function archived(root,store,run,file){
 const sha=run.refs?.[file];
 if(!/^[a-f0-9]{64}$/.test(sha||''))throw Error('Tallennuspisteestä puuttuu '+file);
 const entry=store.versions.find(v=>v.file===file&&v.sha256===sha);
 if(!entry||entry.blob!=='tietovarasto/versiot/'+sha+'.gz')throw Error('Varmuuskopion viite ei kelpaa: '+file);
 const bytes=zlib.gunzipSync(fs.readFileSync(path.join(root,entry.blob)));
 if(digest(bytes)!==sha)throw Error('Varmuuskopion tarkistussumma ei täsmää: '+file);
 return bytes;
}
function prepare(root,number){
 const store=index(root);
 if(!Number.isSafeInteger(number)||number<1||number>store.runs.length)throw Error('Valitse olemassa oleva tallennuspisteen numero');
 const run=store.runs[number-1],files=new Map(),context={window:{}};
 for(const file of ['data.js','ottelut-data.js']){
  const bytes=archived(root,store,run,file);files.set(file,bytes);
  vm.runInNewContext(bytes.toString('utf8'),context,{timeout:15000});
 }
 const registryContext={window:{}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'athlete-registry.js'),'utf8'),registryContext,{timeout:15000});
 const R=registryContext.window.PainiRegistry,data=context.window.PAINI_SHARED_DATA,bouts=context.window.PAINI_BOUTS_DATA;
 R.validate(data);
 if(!bouts||bouts.version!==2)throw Error('Tallennuspisteen otteluaineisto puuttuu tai sen versio ei kelpaa');
 D.validateBouts(data,bouts,R);
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'paini-restore-'));
 try{
  fs.writeFileSync(path.join(temp,'ottelut-data.js'),files.get('ottelut-data.js'));
  fs.writeFileSync(path.join(temp,'data.js'),files.get('data.js'));
  E.build(temp);
  for(const file of ['ottelut-public.json','ottelut-manifest.json','kattavuus.json','aineisto-manifest.json'])files.set(file,fs.readFileSync(path.join(temp,file)));
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
 return {files,summary:{number,at:run.at,label:run.label,competitions:data.competitions.length,results:R.rows(data).length,matches:bouts.matches.length,
  changedFiles:[...files].filter(([file,bytes])=>!fs.existsSync(path.join(root,file))||!fs.readFileSync(path.join(root,file)).equals(bytes)).map(([file])=>file)}};
}
function preview(root,number){return prepare(root,number).summary;}
function restore(root,number){
 // Verify the complete pair and build its public view before touching live files.
 const prepared=prepare(root,number);
 if(!prepared.summary.changedFiles.length)return {...prepared.summary,applied:false};
 const previous=new Map([...prepared.files.keys()].map(file=>[file,fs.existsSync(path.join(root,file))?fs.readFileSync(path.join(root,file)):null]));
 // Stop before replacement if the current state cannot be safely archived.
 Q.snapshot(root,'before-restore');
 const written=[];
 try{
  for(const [file,bytes]of prepared.files){Q.atomic(path.join(root,file),bytes);written.push(file);}
  Q.snapshot(root,'after-restore');
 }catch(error){
  for(const file of written.reverse()){
   const bytes=previous.get(file);
   if(bytes===null)fs.unlinkSync(path.join(root,file));else Q.atomic(path.join(root,file),bytes);
  }
  throw error;
 }
 return {...prepared.summary,applied:true};
}
if(require.main===module){
 const mode=process.argv[2],root=process.argv[3]||'.',number=Number(process.argv[4]);
 if(!['list','preview','apply'].includes(mode))throw Error('Valitse list, preview tai apply');
 const result=mode==='list'?list(root):mode==='preview'?preview(root,number):restore(root,number);
 console.log(JSON.stringify(result,null,2));
}
module.exports={list,preview,restore};
