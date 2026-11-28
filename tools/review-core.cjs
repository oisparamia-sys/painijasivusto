'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const copy=x=>JSON.parse(JSON.stringify(x));
function stable(x){if(Array.isArray(x))return x.map(stable);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).filter(k=>!['checkedAt','fileInfo','updatedAt','exportedAt'].includes(k)).sort().map(k=>[k,stable(x[k])]));return x;}
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(stable(x))).digest('hex');
function readQueue(file='muutosjono.json'){recover(path.dirname(file));if(!fs.existsSync(file))return{version:1,updatedAt:null,proposals:[],history:[]};const q=JSON.parse(fs.readFileSync(file));if(q.version!==1||!Array.isArray(q.proposals)||!Array.isArray(q.history)||new Set(q.proposals.map(p=>p.id)).size!==q.proposals.length)throw Error('Muutosjonon muoto ei kelpaa');return q;}
function atomic(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.tmp',fd=fs.openSync(temp,'w');try{fs.writeFileSync(fd,text);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(temp,file);const directory=fs.openSync(path.dirname(file),'r');try{fs.fsyncSync(directory);}finally{fs.closeSync(directory);}}
function saveQueue(q,file='muutosjono.json'){q.updatedAt=new Date().toISOString();atomic(file,JSON.stringify(q,null,2)+'\n');}
function withdraw(q,kind,target){for(const p of q.proposals)if(p.kind===kind&&p.target===target&&p.status==='pending')p.status='withdrawn';}
function propose(q,kind,target,before,after,reason){
 const beforeHash=hash(before),afterHash=hash(after),id=hash({kind,target,beforeHash,afterHash});
 for(const p of q.proposals)if(p.kind===kind&&p.target===target&&p.id!==id&&p.status==='pending')p.status='superseded';
 const existing=q.proposals.find(p=>p.id===id);
 if(existing){existing.lastSeen=new Date().toISOString();if(['withdrawn','superseded'].includes(existing.status))existing.status='pending';return existing;}
 const p={id,kind,target,beforeHash,afterHash,status:'pending',createdAt:new Date().toISOString(),lastSeen:new Date().toISOString(),reason,before:copy(before),after:copy(after)};q.proposals.push(p);return p;
}
function verifyBackup(root,version){
 try{
  const bytes=zlib.gunzipSync(fs.readFileSync(path.join(root,version.blob)));
  if(crypto.createHash('sha256').update(bytes).digest('hex')!==version.sha256)throw Error('Tarkistussumma ei täsmää');
 }catch(error){throw Error('Varmuuskopion tarkistus epäonnistui ('+version.file+'): '+error.message);}
}
function snapshot(root='.',label='manual'){
 recover(root);
 const indexPath=path.join(root,'tietovarasto/index.json');
 const index=fs.existsSync(indexPath)?JSON.parse(fs.readFileSync(indexPath)):{version:1,versions:[],runs:[]};
 if(index.version!==1)throw Error('Tietovaraston versio ei kelpaa');
 const refs={};
 for(const file of ['data.js','ottelut-data.js']){
  const full=path.join(root,file);if(!fs.existsSync(full))continue;
  const bytes=fs.readFileSync(full),text=bytes.toString('utf8');
  const vm=require('node:vm'),ctx={window:{}};vm.runInNewContext(text,ctx,{timeout:15000});const value=ctx.window[file==='data.js'?'PAINI_SHARED_DATA':'PAINI_BOUTS_DATA'];
  // Keep source evidence, exclusions and coverage diagnostics as well as results.
  // hash() ignores scan/export timestamps so unchanged scans still share a backup.
  const semanticHash=hash(value),existing=index.versions.find(v=>v.file===file&&v.semanticHash===semanticHash);
  if(existing){verifyBackup(root,existing);refs[file]=existing.sha256;continue;}
  const sha256=crypto.createHash('sha256').update(bytes).digest('hex'),blob='tietovarasto/versiot/'+sha256+'.gz';
  atomic(path.join(root,blob),zlib.gzipSync(bytes,{level:9}));
  index.versions.push({file,semanticHash,sha256,blob,createdAt:new Date().toISOString(),bytes:bytes.length});refs[file]=sha256;
 }
 index.runs.push({at:new Date().toISOString(),label,run:process.env.GITHUB_RUN_ID||null,refs});
 atomic(indexPath,JSON.stringify(index,null,2)+'\n');return refs;
}
// Durable undo journal: a failed/interrupted batch is rolled back before reuse.
const JOURNAL='.paini-transaction.json';
function recover(root='.',force=false){
 const file=path.join(root,JOURNAL);if(!fs.existsSync(file))return;
 const journal=JSON.parse(fs.readFileSync(file)),entries=Array.isArray(journal)?journal:journal.entries;
 if(!force&&journal.pid){let alive=true;try{process.kill(journal.pid,0);}catch(error){if(error.code==='ESRCH')alive=false;else throw error;}if(alive)throw Error('Hyväksynnän tallennus on vielä käynnissä. Yritä uudelleen sen valmistuttua.');}
 for(const [name,bytes]of entries){if(!['data.js','ottelut-data.js','muutosjono.json','hyvaksyntapaatokset.json'].includes(name))throw Error('Tallennuksen palautusviite ei kelpaa');const target=path.join(root,name);if(bytes===null){if(fs.existsSync(target))fs.unlinkSync(target);}else atomic(target,Buffer.from(bytes,'base64'));}
 fs.unlinkSync(file);
}
function transaction(root,files){
 recover(root);const journal=path.join(root,JOURNAL);
 const before=[...files.keys()].map(name=>[name,fs.existsSync(path.join(root,name))?fs.readFileSync(path.join(root,name)).toString('base64'):null]);
 atomic(journal,JSON.stringify({pid:process.pid,entries:before}));
 try{for(const [name,bytes]of files)atomic(path.join(root,name),bytes);fs.unlinkSync(journal);}
 catch(error){try{recover(root,true);}catch(rollback){throw new Error('Tallennus keskeytyi. Palautus jatkuu seuraavalla käynnistyksellä: '+rollback.message,{cause:error});}throw error;}
}
module.exports={copy,hash,stable,readQueue,saveQueue,atomic,propose,withdraw,snapshot,transaction,recover};
