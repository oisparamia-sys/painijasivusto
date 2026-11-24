"use strict";
(() => {
 function comparable(row,kind){return !row?null:kind==='competition'?{name:row.name,club:row.club,category:row.category,weight:row.weight,place:row.place}:{id:row.id,round:row.round,category:row.category,weight:row.weight,red:row.red,blue:row.blue,winner:row.winner,code:row.code,points:row.points,source:row.source};}
 function stable(value){return Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;}
 function comparison(p){
  const before=p.kind==='competition'?p.before.rows:p.before.matches,after=p.kind==='competition'?p.after.rows:p.after.matches;
  const old=new Set(before),next=new Set(after),changes=[];
  const id=row=>p.kind==='competition'?row.resultId:row.id,pick=row=>JSON.stringify(stable(comparable(row,p.kind)));
  const byId=new Map(after.filter(row=>id(row)).map(row=>[id(row),row]));
  for(const row of before){const match=id(row)&&byId.get(id(row));if(match&&next.has(match)){old.delete(row);next.delete(match);if(pick(row)!==pick(match))changes.push([comparable(row,p.kind),comparable(match,p.kind)]);}}
  const key=row=>p.kind==='competition'?JSON.stringify([row.name,row.club,row.category,row.weight]):row.id;
  const groups=new Map();
  for(const row of next){const k=key(row);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(row);}
  // Cancel unchanged duplicates before pairing corrections. No row may disappear
  // merely because another wrestler has the same name, club and weight class.
  for(const row of [...old]){const candidates=groups.get(key(row))||[],i=candidates.findIndex(other=>pick(other)===pick(row));if(i>=0){next.delete(candidates[i]);candidates.splice(i,1);old.delete(row);}}
  for(const row of old){const candidates=groups.get(key(row))||[],match=candidates.shift();if(match){next.delete(match);changes.push([comparable(row,p.kind),comparable(match,p.kind)]);}else changes.push([comparable(row,p.kind),null]);}
  for(const row of next)changes.push([null,comparable(row,p.kind)]);
  return changes;
 }
 function proposalSummary(p){
  const changes=comparison(p),metadata=[];
  const fields=p.kind==='competition'?['title','details','categoryStyles','styleSources','importNotes','textSource']:['title','details','year','stats','comparisonMethod','participants','excluded','issues'];
  const labels={title:'Kilpailun nimi',details:'Paikka ja aika',categoryStyles:'Sarjojen painimuodot',styleSources:'Painimuotojen lähteet',importNotes:'Kattavuusvaroitukset',textSource:'Tekstitiedoston lähde',year:'Vuosi',stats:'Kattavuusluvut',comparisonMethod:'Tarkistusmenetelmä',participants:'Osallistujaviittaukset',excluded:'Pois jätetyt ottelut',issues:'Lähdehuomiot'};
  for(const field of fields){const a=p.kind==='bout-event'&&Object.hasOwn(p.before.meta,field)?p.before.meta[field]:p.before[field],b=p.kind==='bout-event'&&Object.hasOwn(p.after.meta,field)?p.after.meta[field]:p.after[field];
   if(JSON.stringify(stable(a))!==JSON.stringify(stable(b)))metadata.push({field,label:labels[field],before:a,after:b});
  }
  return {changes,metadata,added:changes.filter(([a,b])=>!a&&b).length,removed:changes.filter(([a,b])=>a&&!b).length,changed:changes.filter(([a,b])=>a&&b).length};
 }
 function retainDecisions(choices,queue){const pending=new Set(queue.proposals.filter(p=>p.status==='pending').map(p=>p.id));return new Map([...choices].filter(([id])=>pending.has(id)));}

 if(typeof module==='object'&&module.exports){module.exports={comparison,proposalSummary,retainDecisions};return;}

 const section=document.querySelector('#review-queue');if(!section)return;
 const base=new URL('.',document.currentScript?.src||location.href),status=section.querySelector('[role=status]'),list=section.querySelector('#review-list'),exportButton=section.querySelector('#review-export');
 let queue=null,loading=false;const choices=new Map(),summaries=new WeakMap();
 const summary=p=>{if(!summaries.has(p))summaries.set(p,proposalSummary(p));return summaries.get(p);};
 const names={competition:'Sijoitustulokset','bout-event':'Ottelut'};
 const addText=(parent,tag,text)=>{const e=document.createElement(tag);e.textContent=text;parent.append(e);return e;};
 const title=p=>p.kind==='competition'?p.after.title+' · '+p.after.details:p.after.meta.title+' · '+p.after.meta.details;
 function sideRows(p,which){return p.kind==='competition'?p[which].rows:p[which].matches;}
 function label(row,p){
  if(!row)return 'Ei riviä';
  if(p.kind==='competition')return row.name+' · '+row.club+' · '+row.category+' '+row.weight+' kg · sijoitus '+row.place;
  const participants=new Map([...p.before.participants,...p.after.participants].map(r=>[r.resultId,r]));
  const current=window.PAINI_SHARED_DATA?.competitions?.find(c=>c.source===p.target),rows=new Map((current?.rows||[]).map(r=>[r.resultId,r.name]));
  const person=id=>rows.get(id)||id;
  const methods={PV:'Pistevoitto',SV:'Selätys',YPV:'Ylivoimainen pistevoitto',VP:'Pistevoitto',VT:'Selätys',GS:'Ylivoimainen pistevoitto',VFA:'Selätys',VPO:'Pistevoitto',VPO1:'Pistevoitto',VSU:'Ylivoimainen pistevoitto',VSU1:'Ylivoimainen pistevoitto',FI:'Loukkaantuminen',LOUK:'Loukkaantuminen'};
  return person(row.red)+' – '+person(row.blue)+' · kierros '+row.round+' · voittaja '+person(row.winner)+' · '+(methods[row.code]||row.code)+' · pisteet '+(row.points?row.points.join('–'):'ei ilmoitettu');
 }
 function updateCount(){const approved=[...choices.values()].filter(value=>value==='approve').length;exportButton.disabled=loading||!choices.size;section.querySelector('#review-selected').textContent=approved+' hyväksyntää · '+(choices.size-approved)+' hylkäystä valittu. Päätöksiä ei ole vielä julkaistu.';}
 function render(){
  list.replaceChildren();const pending=queue.proposals.filter(p=>p.status==='pending');
  const rejected=queue.proposals.filter(p=>p.status==='rejected').length,approved=queue.proposals.filter(p=>p.status==='approved').length;
  status.textContent=pending.length+' muutosehdotusta odottaa päätöstä. Hyväksytty aiemmin '+approved+', hylätty '+rejected+'.';
  const query=(section.querySelector('#review-search')?.value||'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('fi');
  const kind=section.querySelector('#review-kind')?.value||'';
  const shown=pending.filter(p=>(!kind||p.kind===kind)&&title(p).normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('fi').includes(query));
  const filterCount=section.querySelector('#review-filter-count');if(filterCount)filterCount.textContent='Näytetään '+shown.length+' / '+pending.length+' odottavaa ehdotusta.';
  for(const p of shown){
   const card=document.createElement('article');card.className='review-card';addText(card,'h3',names[p.kind]+' · '+title(p));
   const info=summary(p);addText(card,'p','Lisäyksiä '+info.added+' · korjauksia '+info.changed+' · poistoehdotuksia '+info.removed+' · tietomuutoksia '+info.metadata.length+'.');
   const box=document.createElement('details');box.open=info.removed>0;addText(box,'summary','Näytä rivien ja tietojen muutokset');
   addText(box,'p',p.reason);addText(box,'p','Havaittu '+new Intl.DateTimeFormat('fi-FI',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Helsinki'}).format(new Date(p.createdAt)));
   const source=new URL(p.target);if(source.protocol==='https:'&&source.hostname==='turniereklassisch.ringerdb.de'){const link=addText(box,'a','Avaa kilpailun lähde ↗');link.href=source.href;link.target='_blank';link.rel='noopener noreferrer';}
   const changes=info.changes;addText(box,'p','Nykyisessä aineistossa '+sideRows(p,'before').length+' riviä, ehdotuksessa '+sideRows(p,'after').length+'. Muuttuneita rivejä '+changes.length+'.');
   const scroll=document.createElement('div');scroll.className='scroll';const table=document.createElement('table'),head=document.createElement('thead'),hr=document.createElement('tr');addText(hr,'th','Nykyinen hyväksytty tieto');addText(hr,'th','Lähteestä löytynyt ehdotus');head.append(hr);table.append(head);const body=document.createElement('tbody');
   for(const pair of changes.slice(0,100)){const tr=document.createElement('tr');addText(tr,'td',label(pair[0],p));addText(tr,'td',label(pair[1],p));body.append(tr);}table.append(body);scroll.append(table);box.append(scroll);
   if(changes.length>100)addText(box,'p','Näytetään ensimmäiset 100 eroa. Täydellinen ehdotus on ladattavassa muutosjonossa.');
   if(p.kind==='competition'&&(p.before.title!==p.after.title||p.before.details!==p.after.details))addText(box,'p','Kilpailun otsikko: '+p.before.title+' · '+p.before.details+' → '+p.after.title+' · '+p.after.details);
   if(info.metadata.length){
    addText(box,'h4','Kilpailun muiden tietojen muutokset');
    const values=document.createElement('div');
    const format=value=>value===undefined?'Ei tietoa':(typeof value==='string'?value:JSON.stringify(value,null,2));
    for(const field of info.metadata){const details=document.createElement('details');addText(details,'summary',field.label);for(const [title,value] of [['Nykyinen',field.before],['Ehdotus',field.after]]){addText(details,'h5',title);const text=format(value);addText(details,'pre',text.slice(0,2000));if(text.length>2000)addText(details,'p','Näytetään ensimmäiset 2000 merkkiä. Täydellinen tieto on muutosjonotiedostossa.');}values.append(details);}box.append(values);
   }
   card.append(box);
   const actions=document.createElement('div');actions.className='actions review-actions';actions.setAttribute('aria-label','Päätös: '+title(p));
   for(const [value,text]of[['approve','Hyväksy muutos'],['reject','Hylkää muutos'],['','Jätä odottamaan']]){
    const button=document.createElement('button');button.type='button';button.textContent=text;button.dataset.decision=value;button.setAttribute('aria-pressed',String((choices.get(p.id)||'')===value));
    button.addEventListener('click',()=>{if(loading)return;if(value)choices.set(p.id,value);else choices.delete(p.id);for(const other of actions.querySelectorAll('button'))other.setAttribute('aria-pressed',String(other.dataset.decision===value));updateCount();});actions.append(button);
   }
   card.append(actions);list.append(card);
  }
  updateCount();
 }
 async function versions(){
  const message=section.querySelector('#review-versions-status'),list=section.querySelector('#review-versions');
  try{const response=await fetch(new URL('tietovarasto/index.json',base),{cache:'no-cache'});if(!response.ok)throw Error('Ensimmäistä tallennusajoa ei vielä ole julkaistu');const index=await response.json();if(index.version!==1||!Array.isArray(index.runs)||!Array.isArray(index.versions))throw Error('Versiontallennuksen tiedot eivät kelpaa');
   message.textContent=index.versions.length+' aineistoversiota ja '+index.runs.length+' tallennuspistettä. Näytetään kymmenen uusinta tallennuspistettä.';list.replaceChildren();
   for(const run of index.runs.slice(-10).reverse()){const li=addText(list,'li',new Intl.DateTimeFormat('fi-FI',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Helsinki'}).format(new Date(run.at))+' · '+({before:'Ennen muutoksia',after:'Muutosten jälkeen'}[run.label]||run.label)+' ');
    for(const file of ['data.js','ottelut-data.js']){const version=index.versions.find(v=>v.file===file&&v.sha256===run.refs[file]);if(!version||!/^tietovarasto\/versiot\/[a-f0-9]{64}\.gz$/.test(version.blob))continue;const a=addText(li,'a',file+' (pakattu)');a.href=new URL(version.blob,base).href;a.download=file+'.gz';li.append(document.createTextNode(' '));}
   }
  }catch(error){message.textContent=error.message+'. Käynnistä ensimmäinen päätösajo asennusohjeen mukaan ja päivitä sivu sen julkaisun jälkeen.';}
 }
 async function reload(){
  if(loading)return;loading=true;
  status.textContent='Ladataan muutosehdotuksia…';exportButton.disabled=true;
  versions();
  try{const response=await fetch(new URL('muutosjono.json',base),{cache:'no-cache'});if(!response.ok)throw Error('Muutosjono ei latautunut');const value=await response.json();if(value.version!==1||!Array.isArray(value.proposals)||value.proposals.some(p=>!names[p.kind]||!p.before||!p.after))throw Error('Muutosjonon muoto ei kelpaa');const retained=retainDecisions(choices,value),removed=choices.size-retained.size;queue=value;choices.clear();for(const [id,action] of retained)choices.set(id,action);loading=false;render();if(removed)status.textContent+=' Vanhenneita päätösvalintoja poistettiin '+removed+'.';}
  catch(error){loading=false;status.textContent=error.message+'. Yritä uudelleen. Muut ylläpitotoiminnot ovat käytettävissä.';updateCount();exportButton.disabled=true;}
 }
 section.querySelector('#review-reload').addEventListener('click',reload);
 section.querySelector('#review-search')?.addEventListener('input',()=>{if(queue)render();});
 section.querySelector('#review-kind')?.addEventListener('change',()=>{if(queue)render();});
 exportButton.addEventListener('click',()=>{
  if(!queue||!choices.size)return;
  const decisions=queue.proposals.filter(p=>choices.has(p.id)).map(p=>({id:p.id,action:choices.get(p.id),beforeHash:p.beforeHash,afterHash:p.afterHash}));
  const blob=new Blob([JSON.stringify({version:1,decisions},null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='hyvaksyntapaatokset.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  status.textContent='Päätöstiedosto ladattu. Siirrä se projektin pääkansioon, tee commit ja push sekä käynnistä automaattihaun vain päätökset käsittelevä ajo. Valinnat säilyvät sivulla siihen asti.';
 });
 window.addEventListener('beforeunload',event=>{if(choices.size){event.preventDefault();event.returnValue='';}});
 reload();
})();
