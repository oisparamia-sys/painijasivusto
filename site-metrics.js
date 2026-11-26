"use strict";
(function(root){
 const U=typeof module==='object'&&module.exports?require('./site-utils.js'):root.PAINI_UTILS;
 const norm=value=>String(value||'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('fi');
 const key=c=>c.source||JSON.stringify([norm(c.title),norm(c.details)]);
 const ratio=(count,total)=>total>0?Math.round(count/total*1000)/10:null;
 function standings(c){const rows=c.rows;return {results:rows.length,athletes:new Set(rows.map(r=>r.athleteId)).size,clubs:new Set(rows.map(r=>norm(r.club))).size,categories:new Set(rows.map(r=>r.category)).size,wins:rows.filter(r=>r.place===1).length,medals:rows.filter(r=>r.place<=3).length};}
 function clubs(data){
  const map=new Map();for(const competition of data.competitions)for(const row of competition.rows){const id=norm(row.club);if(!map.has(id))map.set(id,{id,name:row.club,entries:[],athletes:new Set(),competitions:new Set(),onlyKll:true});const club=map.get(id);club.entries.push({item:competition,result:row});club.athletes.add(row.athleteId);club.competitions.add(key(competition));if(!/\bkll\b|koululiikuntaliit/i.test(competition.title))club.onlyKll=false;}
  return [...map.values()].sort((a,b)=>Number(!/^\p{L}/u.test(a.name.trim()))-Number(!/^\p{L}/u.test(b.name.trim()))||a.name.localeCompare(b.name,'fi'));
 }
 function highlights(entries,dateOf){
  const sorted=[...entries].sort((a,b)=>dateOf(b.item)-dateOf(a.item)||a.item.title.localeCompare(b.item.title,'fi'));
  const sm=entries.filter(e=>U.competitionTier(e.item.title)===0).sort((a,b)=>a.result.place-b.result.place||dateOf(b.item)-dateOf(a.item));
  return {wins:entries.filter(e=>e.result.place===1).length,medals:entries.filter(e=>e.result.place<=3).length,bestSm:sm[0]||null,recent:sorted.slice(0,3)};
 }
 function coverage(data,bouts){
  const competitions=Object.create(null),athletes=Object.create(null),byResult=new Map(),meta=new Map(bouts.competitions.map(c=>[c.key,c]));
  const empty=()=>({matches:0,points:0,methods:0,excluded:0,identityConflicts:0});
  for(const c of data.competitions){competitions[key(c)]={...empty(),results:c.rows.length,notes:c.importNotes||[],checkedAt:meta.get(key(c))?.checkedAt||null,scanned:meta.has(key(c))};for(const row of c.rows)byResult.set(row.resultId,row.athleteId);}
  const methods=new Set(['YPV','PV','SV','VFA','VPO','VPO1','VSU','VSU1','VP','VT','GS','FI','LOUK']);
  const total=empty();
  for(const match of bouts.matches){
   const c=competitions[match.competition];if(!c)throw Error('Kattavuuden kilpailuviittaus puuttuu');
   const red=byResult.get(match.red),blue=byResult.get(match.blue);if(!red||!blue)throw Error('Kattavuuden tulostunnus puuttuu');
   const points=Array.isArray(match.points)&&match.points.length===2&&match.points.every(n=>Number.isInteger(n)&&n>=0),method=methods.has(match.code),conflict=red===blue;
   for(const value of [total,c,...[...new Set([red,blue])].map(id=>athletes[id]||(athletes[id]=empty()))]){value.matches++;if(points)value.points++;if(method)value.methods++;if(conflict)value.identityConflicts++;}
  }
  for(const omitted of bouts.excluded){const c=competitions[omitted.competition];if(!c)continue;c.excluded++;total.excluded++;for(const id of new Set((omitted.people||[]).map(result=>byResult.get(result)).filter(Boolean)))(athletes[id]||(athletes[id]=empty())).excluded++;}
  for(const value of [total,...Object.values(competitions),...Object.values(athletes)]){value.pointsPercent=ratio(value.points,value.matches);value.methodsPercent=ratio(value.methods,value.matches);value.acceptedPercent=ratio(value.matches,value.matches+value.excluded);}
  return {version:1,resultsVersion:data.exportedAt||data.updatedAt||null,checkedAt:bouts.checkedAt,total:{...total,competitions:data.competitions.length,results:data.competitions.reduce((n,c)=>n+c.rows.length,0),withoutNotes:data.competitions.filter(c=>!c.importNotes?.length).length,withBouts:Object.values(competitions).filter(c=>c.matches>0).length},competitions,athletes};
 }
 const api={norm,key,ratio,standings,clubs,highlights,coverage};if(typeof module==='object'&&module.exports)module.exports=api;else root.PAINI_METRICS=api;
})(typeof window==='undefined'?globalThis:window);
