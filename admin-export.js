"use strict";
(function(root){
 const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function merge(base,ours,theirs,label='aineisto'){
  if(equal(ours,base))return clone(theirs);
  if(equal(theirs,base)||equal(ours,theirs))return clone(ours);
  if(Array.isArray(base)&&Array.isArray(ours)&&Array.isArray(theirs)){
   const key=label.endsWith('competitions')?c=>c.source||JSON.stringify([c.title,c.details]):
    label.endsWith('rows')?r=>r.resultId:label.endsWith('athletes')?p=>p.id:null;
   if(key){
    const maps=[base,ours,theirs].map(items=>new Map(items.map(item=>[key(item),item])));
    if(maps.some((m,n)=>m.size!==[base,ours,theirs][n].length))throw Error('Aineistossa on toistuvia tunnisteita');
    const keys=new Set([...maps[2].keys(),...maps[1].keys()]);const result=[];
    for(const id of keys){const value=merge(maps[0].get(id),maps[1].get(id),maps[2].get(id),label+'/'+id);if(value!==undefined)result.push(value);}return result;
   }
   if(['history','revertedHistory'].some(k=>label.endsWith(k))&&equal(ours.slice(0,base.length),base)&&equal(theirs.slice(0,base.length),base))return [...clone(base),...clone(theirs.slice(base.length)),...clone(ours.slice(base.length))];
  }
  if(base&&ours&&theirs&&[base,ours,theirs].every(x=>typeof x==='object'&&!Array.isArray(x))){
   const result={};for(const key of new Set([...Object.keys(theirs),...Object.keys(ours)])){
    if(['exportedAt','updatedAt','snapshotDate'].includes(key)){result[key]=ours[key]??theirs[key];continue;}
    if(['nextAthlete','nextResult'].includes(key)){result[key]=Math.max(ours[key],theirs[key]);continue;}
    const value=merge(base[key],ours[key],theirs[key],label+'/'+key);if(value!==undefined)result[key]=value;
   }return result;
  }
  throw Error('Lähdeaineisto muuttui myös muokkaamassasi kohdassa ('+label+'). Vienti keskeytettiin. Säilytä tämä välilehti ja ratkaise ristiriita uusimman aineiston kanssa.');
 }
 // JSON, never eval: loading a newer source must not execute downloaded code.
 function parse(text){const match=text.match(/^\s*(?:["']use strict["'];\s*)?window\.PAINI_SHARED_DATA\s*=\s*([\s\S]*?)\s*;?\s*$/);if(!match)throw Error('Uusimman aineiston muoto ei kelpaa');return JSON.parse(match[1]);}
 function capture(base){
  const original=clone(base);
  return async ours=>{
   const response=await root.fetch(new URL('data.js',root.location.href),{cache:'no-store'});
   if(!response.ok)throw Error('Uusinta aineistoa ei voitu tarkistaa. Mitään ei viety.');
   const latest=parse(await response.text());root.PainiRegistry.validate(latest);
   const result=merge(original,ours,latest);root.PainiRegistry.validate(result);return result;
  };
 }
 // Optional properties can disappear in either branch.
 const api={merge,parse,capture};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.PAINI_ADMIN_EXPORT=api;
})(typeof window==='undefined'?globalThis:window);
