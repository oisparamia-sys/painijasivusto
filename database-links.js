"use strict";
(function(root){
 function sourceUrl(value){
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&['turniereklassisch.ringerdb.de','www.ringerdb.de'].includes(u.hostname)?u.href:null;}catch{return null;}
 }
 function linkFor(column,value,record,base){
  const text=String(value??''),source=sourceUrl(text);
  if(source)return {href:source,external:true,label:'Avaa alkuperäinen lähde'};
  if(column==='sha256'&&/^[a-f0-9]{64}$/.test(text)){const url=new URL('lahde.html',base);url.searchParams.set('sha256',text);return {href:url.href,external:true,label:'Avaa tallennettu lähdesivu'};}
  const person=/^painija-\d{6,}$/.test(text)?text:column==='name'?[record.id,record.athleteId,record.athlete_id].find(id=>/^painija-\d{6,}$/.test(id||'')):null;
  if(person){const url=new URL('index.html',base);url.hash=new URLSearchParams({painija:person});return {href:url.href,external:true,label:'Avaa painijaprofiili'};}
  if(/^tulos-\d{6,}$/.test(text))return {href:'#'+new URLSearchParams({table:'placements',query:text}),external:false,label:'Näytä tulos tietokannassa'};
  return null;
 }
 const api={sourceUrl,linkFor};if(typeof module==='object'&&module.exports)module.exports=api;else root.PAINI_DATABASE_LINKS=api;
})(typeof window==='undefined'?globalThis:window);
