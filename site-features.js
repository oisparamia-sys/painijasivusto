"use strict";
(() => {
 const M=window.PAINI_METRICS,$=s=>document.querySelector(s);
 let H,data,clubList,coverage=null,currentClub='',profileId=null;
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 const source=(tag,text)=>{const e=node(tag,text);e.translate='no';return e;};
 function action(text,fn,cls=''){const button=node('button',text,cls);button.type='button';button.addEventListener('click',fn);return button;}
 function stat(label,value){const card=node('div',undefined,'feature-stat');card.append(node('span',label),node('strong',String(value)));return card;}
 function rowLink(entry){const li=node('li');li.append(source('strong',entry.item.title),source('p',entry.item.details+' · '+entry.result.category+' '+entry.result.weight+' kg · '+entry.result.place+'.'));li.append(action('Näytä tulokset',()=>H.openCompetition(entry.item)));return li;}
 function meter(parent,label,count,total){const box=node('div',undefined,'coverage-metric');box.append(node('strong',label),node('span',count+' / '+total));const percent=M.ratio(count,total);if(percent!==null){const bar=document.createElement('meter');bar.min=0;bar.max=100;bar.value=percent;bar.setAttribute('aria-label',label);box.append(bar,node('span',percent.toLocaleString({fi:'fi-FI',en:'en-GB',sv:'sv-SE'}[window.PAINI_I18N?.language||'fi'])+' %'));}else box.append(node('span','Ei laskettavissa'));parent.append(box);}
 function coverageBox(parent,value,notes){
  parent.replaceChildren(node('h3','Tallennetun aineiston kattavuus'));
  if(!coverage){parent.append(node('p','Kattavuustietoja ladataan…'));return;}
  if(!value){parent.append(node('p','Ei tallennettuja ottelutietoja.'));return;}
  const grid=node('div',undefined,'coverage-grid');meter(grid,'Pisteet ilmoitettu',value.points,value.matches);meter(grid,'Voittotapa vahvistettu',value.methods,value.matches);meter(grid,'Hyväksytyt käsitellyistä otteluista',value.matches,value.matches+value.excluded);parent.append(grid);
  if(notes!==undefined)parent.append(node('p','Tuonnin kattavuusvaroituksia sisältäviä kilpailuja: '+notes));
  if(value.identityConflicts)parent.append(node('p','Henkilöviittauksen tarkistusta odottavia otteluita: '+value.identityConflicts));
  parent.append(node('p','Prosentit koskevat tallennettuja ja käsiteltyjä tietoja. Ne eivät osoita, että kaikki kilpailut tai niiden kaikki ottelut olisivat löytyneet.','hint'));
 }
 function renderCoverages(){
  if(!H)return;
  coverageBox($('#home-coverage'),coverage?.total,coverage?coverage.total.competitions-coverage.total.withoutNotes:undefined);
  if(profileId){coverageBox($('#profile-coverage'),coverage?.athletes[profileId]);$('#profile-coverage').append(node('p','Painijan kattavuus koskee kaikkia aineiston vuosia.','hint'));}
  if(currentClub)renderClubCoverage();
  $('#home-bout-count').textContent=coverage?String(coverage.total.matches):'…';
 }
 function renderHome(){
  const counters=$('#home-stats');counters.replaceChildren(stat('Kilpailuja',data.competitions.length),stat('Sijoituksia',data.competitions.reduce((n,c)=>n+c.rows.length,0)));
  const bouts=stat('Otteluita',coverage?coverage.total.matches:'…');bouts.querySelector('strong').id='home-bout-count';counters.append(bouts);
  const list=$('#home-latest');list.replaceChildren();
  [...data.competitions].sort((a,b)=>H.date(b)-H.date(a)||a.title.localeCompare(b.title,'fi')).slice(0,6).forEach(c=>{const card=node('article',undefined,'feature-card');card.append(source('h3',c.title),source('p',c.details),node('p',String(c.rows.length)+' kilpailusijoitusta'),action('Näytä tulokset',()=>H.openCompetition(c)));list.append(card);});
 }
 function renderClubs(){
  const query=M.norm($('#club-search').value),list=$('#club-list');list.replaceChildren();
  const found=clubList.filter(club=>M.norm(club.name).includes(query));$('#club-count').textContent='Lähdemerkintöjä: '+found.length;
  for(const club of found){const card=node('article',undefined,'feature-card');card.append(source('h3',club.name),node('p',club.athletes.size+' painijatunnusta · '+club.competitions.size+' kilpailua'),action('Avaa seuran profiili',()=>openClub(club.id)));if(club.onlyKll)card.append(node('p','Vain KLL-lähteissä esiintyvä merkintä.','hint'));list.append(card);}
 }
 function renderClubCoverage(){
  const club=clubList.find(c=>c.id===currentClub);if(!club)return;
  // A club's wrestler may have represented other clubs. Do not assign their
  // entire bout history to this club without source-level affiliation proof.
  const box=$('#club-coverage');box.replaceChildren(node('p','Seuran tilastot lasketaan vain tämän seuramerkinnän tulosriveistä. Painijan muiden seurojen tuloksia ei lasketa seuran saavutuksiksi.','hint'));
 }
 function openClub(id,updateUrl=true){
  if(!H)return false;const club=clubList.find(c=>c.id===id);if(!club)return false;currentClub=id;
  if(updateUrl){const url=new URL(location.href);url.hash=new URLSearchParams({seura:id});history.pushState(null,'',url.href);}
  H.showView('club',false,false);$('#club-title').textContent=club.name;window.PAINI_HOME?.selectClub(id);
  const year=$('#club-year').value;const entries=club.entries.filter(e=>!year||H.year(e.item)===year);
  const stats=$('#club-stats');stats.replaceChildren(stat('Painijatunnuksia',new Set(entries.map(e=>e.result.athleteId)).size),stat('Kilpailuja',new Set(entries.map(e=>M.key(e.item))).size),stat('Mitalisijoituksia',entries.filter(e=>e.result.place<=3).length));
  const people=new Map();for(const entry of entries){const id=entry.result.athleteId;if(!people.has(id))people.set(id,{name:entry.result.name,entries:[]});people.get(id).entries.push(entry);}
  const roster=$('#club-athletes');roster.replaceChildren();for(const [id,person] of [...people].sort((a,b)=>a[1].name.localeCompare(b[1].name,'fi'))){const li=node('li');const b=action(person.name,event=>H.openProfile(id,b));b.translate='no';li.append(b,node('span',' · '+person.entries.length+' tulosriviä'));roster.append(li);}
  const years=new Map();for(const e of club.entries){const y=H.year(e.item);if(!years.has(y))years.set(y,[0,0,0,0]);const values=years.get(y);values[Math.min(e.result.place,4)-1]++;}
  const body=$('#club-year-rows');body.replaceChildren();for(const [year,values] of [...years].sort((a,b)=>a[0].localeCompare(b[0],'fi'))){const tr=document.createElement('tr');[year,...values,values.reduce((a,b)=>a+b,0)].forEach((value,i)=>{const cell=node(i?'td':'th',String(value));if(!i)cell.scope='row';tr.append(cell);});body.append(tr);}
  const competitions=$('#club-competitions');competitions.replaceChildren();const seen=new Set();for(const e of [...entries].sort((a,b)=>H.date(b.item)-H.date(a.item))){if(seen.has(M.key(e.item)))continue;seen.add(M.key(e.item));const li=node('li');li.append(source('strong',e.item.title),source('p',e.item.details),node('p',String(entries.filter(entry=>M.key(entry.item)===M.key(e.item)).length)+' kilpailusijoitusta'),action('Näytä tulokset',()=>H.openCompetition(e.item)));competitions.append(li);}
  renderClubCoverage();$('#club-title').focus();return true;
 }
 function profile(entries,id){
  if(!H)return;profileId=id;window.PAINI_HOME?.selectAthlete(id);const values=M.highlights(entries,H.date),parent=$('#career-highlights');parent.replaceChildren(node('h3','Uran kohokohdat tässä aineistossa'));
  const stats=node('div',undefined,'feature-stats');stats.append(stat('Kilpailuvoittoja',values.wins),stat('Mitalisijoituksia',values.medals));if(values.bestSm)stats.append(stat('Paras SM-sijoitus',values.bestSm.result.place+'.'));parent.append(stats);
  if(values.bestSm){const list=node('ul',undefined,'feature-results');list.append(rowLink(values.bestSm));parent.append(list);}
  parent.append(node('h4','Viimeisimmät tulokset'));const recent=node('ul',undefined,'feature-results');values.recent.forEach(e=>recent.append(rowLink(e)));parent.append(recent,node('p','Kohokohdat koskevat koko tallennettua aineistoa. Vuosirajaus ei muuta tätä yhteenvetoa.','hint'));coverageBox($('#profile-coverage'),coverage?.athletes[id]);$('#profile-coverage').append(node('p','Painijan kattavuus koskee kaikkia aineiston vuosia.','hint'));
 }
 function init(hooks){
  if(!$('#home-view'))return;H=hooks;data=hooks.data;clubList=M.clubs(data);
  $('#home-search-form').addEventListener('submit',event=>{event.preventDefault();$('#search').value=$('#home-search').value;$('#competition').value='';$('#result-year').value='';$('#result-style').value='';$('#club').value='';$('#category').value='';H.search();H.showView('results');});
  document.querySelectorAll('[data-open-view]').forEach(button=>button.addEventListener('click',()=>H.showView(button.dataset.openView)));
  $('#club-search').addEventListener('input',renderClubs);$('#club-year').addEventListener('change',()=>{if(currentClub)openClub(currentClub,false);});
  const years=[...new Set(data.competitions.map(H.year))].sort((a,b)=>a==='Ei päivämäärää'?1:b==='Ei päivämäärää'?-1:Number(b)-Number(a));for(const year of years)$('#club-year').add(new Option(year,year));
  renderHome();renderClubs();window.addEventListener('paini-language-change',renderCoverages);
  coverage=window.PAINI_COVERAGE||null;
  renderCoverages();
  window.PAINI_HOME?.mount({data,registry:window.PainiRegistry,clubs:clubList,date:H.date,utils:window.PAINI_UTILS,openProfile:id=>H.openProfile(id),openClub,openCompetition:H.openCompetition});
 }
 const capture=()=>!H?null:({club:currentClub,fields:Object.fromEntries(['home-search','club-search','club-year'].map(id=>[id,$('#'+id).value]))});
 const restore=state=>{if(!state||!H)return;for(const [id,value]of Object.entries(state.fields||{})){const el=document.getElementById(id);if(el&&typeof value==='string')el.value=value;}if(state.club){currentClub=state.club;openClub(currentClub,false);}};
 window.PAINI_FEATURES={update:bundle=>{data=bundle.data;clubList=M.clubs(data);coverage=bundle.coverage;renderHome();renderClubs();renderCoverages();window.PAINI_HOME?.update({data,clubs:clubList});},init,profile,openClub,capture,restore,hashFor:view=>view==='club'?new URLSearchParams({seura:currentClub}).toString():null,onView:view=>{if(view==='clubs')renderClubs();},competitionCoverage:()=>{} /* Compatibility with an older cached script.js. */};
})();
