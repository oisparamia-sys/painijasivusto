"use strict";
(() => {
 const section=document.querySelector('#review-queue');if(!section)return;
 const base=new URL('.',document.currentScript?.src||location.href),status=section.querySelector('[role=status]'),list=section.querySelector('#review-list'),exportButton=section.querySelector('#review-export');
 let queue=null;const choices=new Map();
 const names={competition:'Sijoitustulokset','bout-event':'Ottelut'};
 const addText=(parent,tag,text)=>{const e=document.createElement(tag);e.textContent=text;parent.append(e);return e;};
 const title=p=>p.kind==='competition'?p.after.title+' · '+p.after.details:p.after.meta.title+' · '+p.after.meta.details;
 function sideRows(p,which){return p.kind==='competition'?p[which].rows:p[which].matches;}
 function comparison(p){
  const before=sideRows(p,'before'),after=sideRows(p,'after'),key=r=>p.kind==='competition'?JSON.stringify([r.name,r.club,r.category,r.weight]):r.id;
  const old=new Map(before.map(r=>[key(r),r])),next=new Map(after.map(r=>[key(r),r]));const changes=[];
  for(const k of new Set([...old.keys(),...next.keys()])){
   const a=old.get(k),b=next.get(k);
   const pick=r=>!r?null:p.kind==='competition'?{name:r.name,club:r.club,category:r.category,weight:r.weight,place:r.place}:{round:r.round,category:r.category,weight:r.weight,red:r.red,blue:r.blue,winner:r.winner,code:r.code,points:r.points,source:r.source};
   if(JSON.stringify(pick(a))!==JSON.stringify(pick(b)))changes.push([pick(a),pick(b)]);
  }
  return changes;
 }
 function label(row,p){
  if(!row)return 'Ei riviä';
  if(p.kind==='competition')return row.name+' · '+row.club+' · '+row.category+' '+row.weight+' kg · sijoitus '+row.place;
  const participants=new Map([...p.before.participants,...p.after.participants].map(r=>[r.resultId,r]));
  const current=window.PAINI_SHARED_DATA?.competitions?.find(c=>c.source===p.target),rows=new Map((current?.rows||[]).map(r=>[r.resultId,r.name]));
  const person=id=>rows.get(id)||id;
  const methods={PV:'Pistevoitto',SV:'Selätys',YPV:'Ylivoimainen pistevoitto',VP:'Pistevoitto',VT:'Selätys',GS:'Ylivoimainen pistevoitto',VFA:'Selätys',VPO:'Pistevoitto',VPO1:'Pistevoitto',VSU:'Ylivoimainen pistevoitto',VSU1:'Ylivoimainen pistevoitto',FI:'Loukkaantuminen',LOUK:'Loukkaantuminen'};
  return person(row.red)+' – '+person(row.blue)+' · kierros '+row.round+' · voittaja '+person(row.winner)+' · '+(methods[row.code]||row.code)+' · pisteet '+(row.points?row.points.join('–'):'ei ilmoitettu');
 }
 function updateCount(){exportButton.disabled=!choices.size;section.querySelector('#review-selected').textContent=choices.size+' päätöstä valittu. Päätöksiä ei ole vielä julkaistu.';}
 function render(){
  list.replaceChildren();const pending=queue.proposals.filter(p=>p.status==='pending');
  const rejected=queue.proposals.filter(p=>p.status==='rejected').length,approved=queue.proposals.filter(p=>p.status==='approved').length;
  status.textContent=pending.length+' muutosehdotusta odottaa päätöstä. Hyväksytty aiemmin '+approved+', hylätty '+rejected+'.';
  for(const p of pending){
   const box=document.createElement('details');addText(box,'summary',names[p.kind]+' · '+title(p));
   addText(box,'p',p.reason);addText(box,'p','Havaittu '+new Intl.DateTimeFormat('fi-FI',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Helsinki'}).format(new Date(p.createdAt)));
   const source=new URL(p.target);if(source.protocol==='https:'&&source.hostname==='turniereklassisch.ringerdb.de'){const link=addText(box,'a','Avaa kilpailun lähde ↗');link.href=source.href;link.target='_blank';link.rel='noopener noreferrer';}
   const changes=comparison(p);addText(box,'p','Nykyisessä aineistossa '+sideRows(p,'before').length+' riviä, ehdotuksessa '+sideRows(p,'after').length+'. Muuttuneita rivejä '+changes.length+'.');
   const scroll=document.createElement('div');scroll.className='scroll';const table=document.createElement('table'),head=document.createElement('thead'),hr=document.createElement('tr');addText(hr,'th','Nykyinen hyväksytty tieto');addText(hr,'th','Lähteestä löytynyt ehdotus');head.append(hr);table.append(head);const body=document.createElement('tbody');
   for(const pair of changes.slice(0,100)){const tr=document.createElement('tr');addText(tr,'td',label(pair[0],p));addText(tr,'td',label(pair[1],p));body.append(tr);}table.append(body);scroll.append(table);box.append(scroll);
   if(changes.length>100)addText(box,'p','Näytetään ensimmäiset 100 eroa. Täydellinen ehdotus on ladattavassa muutosjonossa.');
   if(p.kind==='competition'&&(p.before.title!==p.after.title||p.before.details!==p.after.details))addText(box,'p','Kilpailun otsikko: '+p.before.title+' · '+p.before.details+' → '+p.after.title+' · '+p.after.details);
   const choose=document.createElement('select');choose.setAttribute('aria-label','Päätös: '+title(p));
   for(const [value,text]of[['','Jätä odottamaan'],['approve','Hyväksy muutos'],['reject','Hylkää muutos']]){const option=addText(choose,'option',text);option.value=value;}
   choose.value=choices.get(p.id)||'';choose.addEventListener('change',()=>{if(choose.value)choices.set(p.id,choose.value);else choices.delete(p.id);updateCount();});box.append(choose);list.append(box);
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
  if(choices.size&&!window.confirm('Sivulla on julkaisemattomia päätösvalintoja. Haluatko tyhjentää ne ja hakea jonon uudelleen?'))return;
  status.textContent='Ladataan muutosehdotuksia…';exportButton.disabled=true;
  versions();
  try{const response=await fetch(new URL('muutosjono.json',base),{cache:'no-cache'});if(!response.ok)throw Error('Muutosjono ei latautunut');const value=await response.json();if(value.version!==1||!Array.isArray(value.proposals)||value.proposals.some(p=>!names[p.kind]||!p.before||!p.after))throw Error('Muutosjonon muoto ei kelpaa');queue=value;choices.clear();render();}
  catch(error){status.textContent=error.message+'. Yritä uudelleen. Muut ylläpitotoiminnot ovat käytettävissä.';updateCount();exportButton.disabled=true;}
 }
 section.querySelector('#review-reload').addEventListener('click',reload);
 exportButton.addEventListener('click',()=>{
  if(!queue||!choices.size)return;
  const decisions=queue.proposals.filter(p=>choices.has(p.id)).map(p=>({id:p.id,action:choices.get(p.id),beforeHash:p.beforeHash,afterHash:p.afterHash}));
  const blob=new Blob([JSON.stringify({version:1,decisions},null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='hyvaksyntapaatokset.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  status.textContent='Päätöstiedosto ladattu. Siirrä se projektin pääkansioon, tee commit ja push sekä käynnistä automaattihaun vain päätökset käsittelevä ajo. Valinnat säilyvät sivulla siihen asti.';
 });
 window.addEventListener('beforeunload',event=>{if(choices.size){event.preventDefault();event.returnValue='';}});
 reload();
})();
