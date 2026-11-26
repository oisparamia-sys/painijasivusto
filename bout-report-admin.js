"use strict";
(function(root){
 function summarize(data,packed){
  if(packed?.version!==3||!['competitions','participants','matches'].every(key=>Array.isArray(packed[key])))throw Error('Otteluaineisto ei kelpaa');
  const byResult=new Map(data.competitions.flatMap(c=>c.rows.map(row=>[row.resultId,row.athleteId]))),ids=new Set();let missingPeople=0;
  for(const person of packed.participants){const id=byResult.get(person[0]);if(id)ids.add(id);else missingPeople++;}
  const years=packed.competitions.map(c=>c.year).filter(Number.isInteger);
  return {competitions:packed.competitions.length,matches:packed.matches.length,people:ids.size,missingPeople,years:years.length?Math.min(...years)+'–'+Math.max(...years):'ei tiedossa'};
 }
 if(typeof module==='object'&&module.exports){module.exports={summarize};return;}
 if(!document.getElementById('bout-report-admin'))return;
 const base=new URL('.',document.currentScript.src),$=id=>document.getElementById(id);
 const time=value=>{const stamp=Date.parse(value);return Number.isFinite(stamp)?new Intl.DateTimeFormat('fi-FI',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Helsinki'}).format(new Date(stamp)):'ei tiedossa';};
 const line=text=>{const li=document.createElement('li');li.textContent=text;return li;};
 function render(data,packed){
  const total=summarize(data,packed),search=packed.searchSummary;
  $('admin-bout-search-summary').textContent=search?'Viimeisin haku: '+search.attempted+' kilpailua käsitelty, '+search.updated+' päivitetty, '+search.preserved+' säilytetty aiemmasta aineistosta, '+search.failed+' ilman vahvistettuja otteluita. Kaikkien kilpailujen tietoja ei ole välttämättä saatavilla.':'Viimeisimmän haun yhteenveto ei ole saatavilla.';
  $('admin-bout-coverage-summary').textContent=total.competitions+' kilpailua vuosilta '+total.years+'. Mukana '+total.matches.toLocaleString('fi-FI')+' ottelua ja '+total.people+' painijaa. Tämä ei vielä ole painijoiden koko otteluhistoria.'+(total.missingPeople?' Nykyisestä tulosaineistosta puuttuvia osallistujaviittauksia: '+total.missingPeople+'.':'');
  $('admin-bout-checked-at').textContent='Viimeisin otteluhaku '+time(packed.checkedAt)+'.';
  const missing=Array.isArray(packed.coverageMissing)?packed.coverageMissing:null,list=$('admin-bout-missing-list');list.replaceChildren();$('admin-bout-missing-count').textContent=missing?String(missing.length):'ei tiedossa';
  if(!missing)list.append(line('Puuttuvien kilpailujen luetteloa ei ole tässä aineistoversiossa.'));
  else if(!missing.length)list.append(line('Ei kilpailuja ilman vahvistettuja otteluita. Yksittäisiä otteluita voi silti puuttua.'));
  else for(const entry of missing){const li=line(entry.title+' · '+entry.details+' — '+entry.reason);try{const url=new URL(entry.source);if(url.protocol==='https:'&&url.hostname==='turniereklassisch.ringerdb.de'&&!url.username&&!url.password){const a=document.createElement('a');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=' Avaa lähde';li.append(a);}}catch{}list.append(li);}
  const coverage=$('admin-bout-coverage-list');coverage.replaceChildren();for(const c of packed.competitions){const stats=c.stats||{};coverage.append(line((c.checkedAt?'Tarkistettu '+time(c.checkedAt)+' · ':'')+c.title+' · '+c.details+' — mukana '+(stats.accepted??'ei tiedossa')+' ottelua, pois jäi '+(stats.excluded??'ei tiedossa')+' ottelua. Vain toisessa luettelossa '+(stats.unmatchedNumbered??'ei tiedossa')+', muita lähdehuomioita '+(stats.unreadable??'ei tiedossa')+'.'));}
  $('admin-bout-report-status').textContent='Julkaistun otteluaineiston yhteenveto ladattu.';
 }
 let loading=false;
 async function load(){
  if(loading||!root.PAINI_SHARED_DATA)return;loading=true;$('admin-bout-report-retry').hidden=true;
  try{
   const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(n=>n.toString(16).padStart(2,'0')).join('');
   const io=root.PAINI_DATA_IO.create({base,fetch,hash}),manifest=await io.manifest(),packed=JSON.parse(await io.file(manifest,'bouts'));render(root.PAINI_SHARED_DATA,packed);io.clearMemory();
  }catch{$('admin-bout-report-status').textContent='Otteluhaun yhteenvetoa ei voitu ladata. Muut ylläpidon toiminnot ovat käytettävissä.';$('admin-bout-report-retry').hidden=false;}
  finally{loading=false;}
 }
 $('admin-bout-report-retry').addEventListener('click',load);root.addEventListener('paini-data-ready',load);if(root.PAINI_SHARED_DATA)load();
})(typeof window==='undefined'?globalThis:window);
