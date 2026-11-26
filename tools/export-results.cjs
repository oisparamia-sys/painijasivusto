'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const digest=text=>crypto.createHash('sha256').update(text).digest('hex');
// Authoritative data.js keeps undo history. Public searches need only current identities.
function project(data){
 const pick=(value,keys)=>Object.fromEntries(keys.filter(k=>value[k]!==undefined).map(k=>[k,value[k]]));
 return {...pick(data,['version','snapshotDate','exportedAt','updatedAt']),competitions:data.competitions,athleteRegistry:{...pick(data.athleteRegistry,['version','nextAthlete','nextResult']),history:[],athletes:data.athleteRegistry.athletes.map(a=>pick(a,['id','name','status','mergedInto','distinctFrom']))}};
}
function build(data,directory='.'){
 const value=project(data),parts=[],output=path.join(directory,'tulokset');fs.mkdirSync(output,{recursive:true});
 function write(kind,rows){
  const text=JSON.stringify(rows)+'\n',sha256=digest(text),file='tulokset/'+kind+'-'+sha256+'.json';
  fs.writeFileSync(path.join(directory,file),text);parts.push({kind,file,sha256});
 }
 // Bounded chunks: a large event can span chunks, preserving its index and all IDs.
 let batch=[],size=0;
 value.competitions.forEach((c,index)=>{const {rows,...meta}=c;for(let start=0;start<rows.length;start+=250){const entry={index,meta,rows:rows.slice(start,start+250)},bytes=Buffer.byteLength(JSON.stringify(entry));if(size+bytes>512000&&batch.length){write('competitions',batch);batch=[];size=0;}batch.push(entry);size+=bytes;}});
 if(batch.length)write('competitions',batch);
 for(let start=0;start<value.athleteRegistry.athletes.length;start+=1500)write('athletes',value.athleteRegistry.athletes.slice(start,start+1500));
 const {competitions,athleteRegistry,...metadata}=value,{athletes,...registry}=athleteRegistry;
 const text=JSON.stringify({version:1,metadata,registry,competitionCount:competitions.length,athleteCount:athletes.length,parts})+'\n';
 const indexFile=path.join(output,'index.json'),previous=fs.existsSync(indexFile)?JSON.parse(fs.readFileSync(indexFile,'utf8')):null;
 if(previous)fs.writeFileSync(path.join(output,'previous-index.json'),JSON.stringify(previous)+'\n');
 fs.writeFileSync(indexFile,text);
 const keep=new Set([...parts,...(previous?.parts||[])].map(p=>path.basename(p.file)));
 for(const name of fs.readdirSync(output))if(/^(?:athletes|competitions)-[a-f0-9]{64}\.json$/.test(name)&&!keep.has(name))fs.unlinkSync(path.join(output,name));
 return {file:'tulokset/index.json',sha256:digest(text)};
}
module.exports={project,build};
