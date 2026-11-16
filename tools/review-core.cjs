'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const copy=x=>JSON.parse(JSON.stringify(x));
function stable(x){if(Array.isArray(x))return x.map(stable);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).filter(k=>!['checkedAt','fileInfo','updatedAt','exportedAt'].includes(k)).sort().map(k=>[k,stable(x[k])]));return x;}
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(stable(x))).digest('hex');
function readQueue(file='muutosjono.json'){if(!fs.existsSync(file))return{version:1,updatedAt:null,proposals:[],history:[]};const q=JSON.parse(fs.readFileSync(file));if(q.version!==1||!Array.isArray(q.proposals)||!Array.isArray(q.history)||new Set(q.proposals.map(p=>p.id)).size!==q.proposals.length)throw Error('Muutosjonon muoto ei kelpaa');return q;}
function atomic(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',text);fs.renameSync(file+'.tmp',file);}
function saveQueue(q,file='muutosjono.json'){q.updatedAt=new Date().toISOString();atomic(file,JSON.stringify(q,null,2)+'\n');}
function withdraw(q,kind,target){for(const p of q.proposals)if(p.kind===kind&&p.target===target&&p.status==='pending')p.status='withdrawn';}
function propose(q,kind,target,before,after,reason){
 const beforeHash=hash(before),afterHash=hash(after),id=hash({kind,target,beforeHash,afterHash});
 for(const p of q.proposals)if(p.kind===kind&&p.target===target&&p.id!==id&&p.status==='pending')p.status='superseded';
 const existing=q.proposals.find(p=>p.id===id);
 if(existing){existing.lastSeen=new Date().toISOString();if(['withdrawn','superseded'].includes(existing.status))existing.status='pending';return existing;}
 const p={id,kind,target,beforeHash,afterHash,status:'pending',createdAt:new Date().toISOString(),lastSeen:new Date().toISOString(),reason,before:copy(before),after:copy(after)};q.proposals.push(p);return p;
}
function snapshot(root='.',label='manual'){
 const indexPath=path.join(root,'tietovarasto/index.json');
 const index=fs.existsSync(indexPath)?JSON.parse(fs.readFileSync(indexPath)):{version:1,versions:[],runs:[]};
 if(index.version!==1)throw Error('Tietovaraston versio ei kelpaa');
 const refs={};
 for(const file of ['data.js','ottelut-data.js']){
  const full=path.join(root,file);if(!fs.existsSync(full))continue;
  const bytes=fs.readFileSync(full),text=bytes.toString('utf8'),marker=file==='data.js'?'window.PAINI_SHARED_DATA = ':'window.PAINI_BOUTS_DATA = ';
  const vm=require('node:vm'),ctx={window:{}};vm.runInNewContext(text,ctx,{timeout:15000});const value=ctx.window[file==='data.js'?'PAINI_SHARED_DATA':'PAINI_BOUTS_DATA'];
  const semanticValue=file==='ottelut-data.js'?{version:value.version,competitions:value.competitions.map(c=>({key:c.key,title:c.title,details:c.details,year:c.year})),participants:value.participants,matches:value.matches}:value;
  const semanticHash=hash(semanticValue),existing=index.versions.find(v=>v.file===file&&v.semanticHash===semanticHash);
  if(existing){refs[file]=existing.sha256;continue;}
  const sha256=crypto.createHash('sha256').update(bytes).digest('hex'),blob='tietovarasto/versiot/'+sha256+'.gz';
  atomic(path.join(root,blob),zlib.gzipSync(bytes,{level:9}));
  index.versions.push({file,semanticHash,sha256,blob,createdAt:new Date().toISOString(),bytes:bytes.length});refs[file]=sha256;
 }
 index.runs.push({at:new Date().toISOString(),label,run:process.env.GITHUB_RUN_ID||null,refs});
 atomic(indexPath,JSON.stringify(index,null,2)+'\n');return refs;
}
module.exports={copy,hash,stable,readQueue,saveQueue,atomic,propose,withdraw,snapshot};
