"use strict";
(() => {
 const root=document.querySelector('#coverage-admin');if(!root)return;
 const $=id=>document.getElementById(id);let snapshot=null,coverage=null;
 const cell=(row,tag,value)=>{const node=document.createElement(tag);node.textContent=String(value);row.append(node);return node;};
 const norm=value=>String(value).normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('fi');
 function render(){
  if(!snapshot||!coverage)return;
  const query=norm($('coverage-query').value),year=$('coverage-year').value,only=$('coverage-missing-only').checked,body=$('coverage-admin-rows');body.replaceChildren();let shown=0;
  for(const c of snapshot.competitions){
   const item=coverage.competitions[c.source||JSON.stringify([norm(c.title.trim()),norm(c.details.trim())])];if(!item)continue;
   const y=(c.details.match(/20\d{2}/)||[])[0]||'';
   if(year&&y!==year||!norm(c.title+' '+c.details).includes(query)||only&&!item.excluded&&!item.notes.length&&item.points===item.matches&&item.methods===item.matches&&item.scanned)continue;
   const row=document.createElement('tr');cell(row,'td',c.title+' · '+c.details);cell(row,'td',item.matches);cell(row,'td',item.matches-item.points);cell(row,'td',item.matches-item.methods);cell(row,'td',item.excluded);cell(row,'td',item.notes.length);cell(row,'td',item.checkedAt?new Intl.DateTimeFormat('fi-FI',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Helsinki'}).format(new Date(item.checkedAt)):'Ei tiedossa');
   const sources=cell(row,'td','');try{const url=new URL(c.source);if(url.protocol==='https:'&&url.hostname==='turniereklassisch.ringerdb.de'){const a=document.createElement('a');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Avaa lähde';sources.append(a);}}catch{}
   if(item.notes.length){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Kattavuushuomiot';details.append(summary);for(const note of item.notes){const p=document.createElement('p');p.textContent=note.category+' '+note.weight+' kg · '+(note.reason||'Tietoja puuttuu');details.append(p);}sources.append(details);}
   body.append(row);shown++;
  }
  $('coverage-admin-status').textContent='Näytetään '+shown+' kilpailua. Kattavuus laskettu '+new Intl.DateTimeFormat('fi-FI',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Helsinki'}).format(new Date(coverage.checkedAt))+'.';
 }
 async function load(){
  snapshot=window.PAINI_SHARED_DATA;if(!snapshot)return;
  try{const response=await fetch('kattavuus.json?fresh='+Date.now(),{cache:'no-cache'});if(!response.ok)throw Error();const value=await response.json();if(value.version!==1||value.resultsVersion!==(snapshot.exportedAt||snapshot.updatedAt||null))throw Error();coverage=value;render();}
  catch{$('coverage-admin-status').textContent='Kattavuustiedot eivät ole saatavilla tälle aineistoversiolle.';}
 }
 for(const id of ['coverage-query','coverage-year','coverage-missing-only'])$(id).addEventListener(id==='coverage-query'?'input':'change',render);
 window.addEventListener('paini-data-ready',load);if(window.PAINI_SHARED_DATA)load();
})();
