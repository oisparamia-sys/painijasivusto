"use strict";
(function(root){
 const names={results:'data.js',coverage:'kattavuus.json',bouts:'ottelut-public.json'};
 function validateManifest(value){
  if(![1,2].includes(value?.version)||!/^[a-f0-9]{64}$/.test(value.revision||''))throw Error('Aineiston versiotieto ei kelpaa');
  for(const [key,file]of Object.entries(names))if(value.files?.[key]?.file!==(key==='results'&&value.version===2?'tulokset/index.json':file)||!/^[a-f0-9]{64}$/.test(value.files[key].sha256||''))throw Error('Aineiston tiedostoviite ei kelpaa');
  return value;
 }
 function parseResults(text){
  const match=text.match(/^\s*(?:["']use strict["'];\s*)?window\.PAINI_SHARED_DATA\s*=\s*([\s\S]*?)\s*;?\s*$/);
  if(!match)throw Error('Tulosaineiston muoto ei kelpaa');return JSON.parse(match[1]);
 }
 function create({base,fetch,hash,cache}){
  const memory=new Map();
  async function saved(key){try{return await cache?.get(new URL(key,base).href);}catch{return null;}}
  async function save(key,text){try{await cache?.put(new URL(key,base).href,text);}catch{/* Private browsing and storage limits must not prevent use. */}}
  async function manifest(){const response=await fetch(new URL('aineisto-manifest.json',base),{cache:'no-store'});if(!response.ok)throw Error('Versiotieto ei latautunut');return validateManifest(await response.json());}
  async function entryFile(entry){
   const url=new URL(entry.file,base);url.searchParams.set('v',entry.sha256);const address=url.href;
   if(memory.has(address))return memory.get(address);
   const cached=await saved(address);
   if(cached&&await hash(cached)===entry.sha256){memory.set(address,cached);return cached;}
   const response=await fetch(url,{cache:'no-cache'});if(!response.ok)throw Error('Aineisto ei latautunut');const text=await response.text();
   if(await hash(text)!==entry.sha256)throw Error('Julkaisun tiedostot eivät vielä täsmää');
   memory.set(address,text);await save(address,text);return text;
  }
  const partsByRevision=new Map();
  async function file(manifest,key){validateManifest(manifest);return entryFile(manifest.files[key]);}
  function validateParts(index){
   if(index?.version!==1||!Array.isArray(index.parts)||index.parts.length>2000||!Number.isInteger(index.competitionCount)||!Number.isInteger(index.athleteCount))throw Error('Tulosaineiston osaluettelo ei kelpaa');
   const seen=new Set();for(const p of index.parts){if(!['athletes','competitions'].includes(p.kind)||!/^tulokset\/(?:athletes|competitions)-[a-f0-9]{64}\.json$/.test(p.file)||!p.file.endsWith(p.sha256+'.json')||seen.has(p.file))throw Error('Aineiston osaviite ei kelpaa');seen.add(p.file);}
  }
  async function results(manifest){
   const text=await file(manifest,'results');if(manifest.version===1)return parseResults(text);
   const index=JSON.parse(text);validateParts(index);const blocks=new Array(index.parts.length);let cursor=0;
   await Promise.all(Array.from({length:Math.min(4,index.parts.length)},async()=>{while(cursor<index.parts.length){const n=cursor++;blocks[n]=JSON.parse(await entryFile(index.parts[n]));}}));
   const competitions=[],athletes=[];
   index.parts.forEach((p,n)=>{if(!Array.isArray(blocks[n]))throw Error('Aineiston osa ei kelpaa');if(p.kind==='athletes')athletes.push(...blocks[n]);else for(const e of blocks[n]){if(!Number.isInteger(e.index)||e.index<0||e.index>=index.competitionCount||!Array.isArray(e.rows))throw Error('Kilpailun osaviite ei kelpaa');if(!competitions[e.index])competitions[e.index]={...e.meta,rows:[]};else if(JSON.stringify(e.meta)!==JSON.stringify(Object.fromEntries(Object.entries(competitions[e.index]).filter(([k])=>k!=='rows'))))throw Error('Kilpailun osat eroavat');competitions[e.index].rows.push(...e.rows);}});
   if(competitions.filter(Boolean).length!==index.competitionCount||athletes.length!==index.athleteCount)throw Error('Aineiston osia puuttuu');
   partsByRevision.set(manifest.revision,index.parts);
   return {...index.metadata,competitions,athleteRegistry:{...index.registry,athletes}};
  }
  async function bundle(manifest,includeBouts=false){
   const [data,coverage,bouts]=await Promise.all([results(manifest),file(manifest,'coverage'),includeBouts?file(manifest,'bouts'):null]);
   const metrics=JSON.parse(coverage);
   if(data.version!==1||!Array.isArray(data.competitions)||metrics.resultsVersion!==(data.exportedAt||data.updatedAt||null)||metrics.total.competitions!==data.competitions.length)throw Error('Aineistoversiot eivät täsmää');
   return {data,coverage:metrics,bouts:bouts?JSON.parse(bouts):null};
  }
  return {manifest,file,bundle,remember:async manifest=>{await save('paini-last-manifest',JSON.stringify(manifest));try{await cache?.prune?.([new URL('paini-last-manifest',base).href,...[...Object.values(manifest.files),...(partsByRevision.get(manifest.revision)||[])].map(entry=>{const url=new URL(entry.file,base);url.searchParams.set('v',entry.sha256);return url.href;})]);}catch{}},previous:async()=>{const text=await saved('paini-last-manifest');return text?validateManifest(JSON.parse(text)):null;},clearMemory:()=>memory.clear()};
 }
 const api={validateManifest,parseResults,create};if(typeof module==='object'&&module.exports)module.exports=api;else root.PAINI_DATA_IO=api;
})(typeof window==='undefined'?globalThis:window);
