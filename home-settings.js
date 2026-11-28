"use strict";
(function(root){
 const KEY='paini-home-v1',ORDER=['stats','favorites','coverage','latest'];
 const defaults=()=>({version:1,sections:ORDER.map(id=>({id,visible:true})),athletes:[],clubs:[]});
 function normalize(value){
  const state=defaults();if(value?.version!==1)return state;
  const seen=new Set(),sections=[];
  for(const section of Array.isArray(value.sections)?value.sections:[])if(ORDER.includes(section?.id)&&!seen.has(section.id)){seen.add(section.id);sections.push({id:section.id,visible:section.visible!==false});}
  state.sections=[...sections,...state.sections.filter(section=>!seen.has(section.id))];
  for(const key of ['athletes','clubs']){const ids=new Set();for(const entry of Array.isArray(value[key])?value[key]:[]){if(!entry||typeof entry.id!=='string'||typeof entry.label!=='string'||entry.label.length>300||ids.has(entry.id))continue;if(key==='athletes'?!/^painija-\d{6,}$/.test(entry.id):!entry.id.trim()||entry.id.length>300)continue;ids.add(entry.id);state[key].push({id:entry.id,label:entry.label});if(state[key].length>=100)break;}}
  return state;
 }
 function read(storage){try{return normalize(JSON.parse(storage.getItem(KEY)||'null'));}catch{return defaults();}}
 function write(storage,state){try{storage.setItem(KEY,JSON.stringify(normalize(state)));return true;}catch{return false;}}
 function move(state,id,direction){const next=normalize(state),index=next.sections.findIndex(section=>section.id===id),target=index+direction;if(index>=0&&(direction===-1||direction===1)&&target>=0&&target<next.sections.length)[next.sections[index],next.sections[target]]=[next.sections[target],next.sections[index]];return next;}
 function resolver(data){const records=new Map(data.athleteRegistry.athletes.map(person=>[person.id,person])),cache=new Map();return id=>{if(cache.has(id))return cache.get(id);const path=new Set();let person=records.get(id);while(person?.mergedInto){if(path.has(person.id))return null;path.add(person.id);person=records.get(person.mergedInto);}const resolved=person?.id||null;cache.set(id,resolved);return resolved;};}
 function resolvedAthletes(state,data,registry){
  const records=new Map(data.athleteRegistry.athletes.map(person=>[person.id,person])),seen=new Set();
  return state.athletes.flatMap(saved=>{const id=registry.resolve(data,saved.id),person=records.get(id);if(seen.has(id||saved.id))return [];seen.add(id||saved.id);return [{id:id||saved.id,name:person?.name||saved.label,missing:!person}];});
 }
 const model={KEY,defaults,normalize,read,write,move,resolvedAthletes,resolver};
 if(typeof module==='object'&&module.exports){module.exports=model;return;}
 let hooks,state,athleteId=null,clubId=null,entriesByAthlete=new Map(),people=[],resolveId=()=>null;
 const $=id=>document.getElementById(id),labels={stats:'Aineiston määrät',favorites:'Suosikkien uusimmat tulokset',coverage:'Tallennetun aineiston kattavuus',latest:'Uusimmat tallennetut kilpailut'};
 const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 const original=(tag,text)=>{const el=node(tag,text);el.translate='no';return el;};
 function button(text,fn){const el=node('button',text);el.type='button';el.addEventListener('click',fn);return el;}
 const storage=()=>{try{return window.localStorage;}catch{return null;}};
 function hasAthlete(id){return !!id&&state.athletes.some(saved=>resolveId(saved.id)===id);}
 function hasClub(id){return state.clubs.some(saved=>saved.id===id);}
 function applyLayout(){const parent=$('home-sections');for(const section of state.sections){const block=$('home-block-'+section.id);block.hidden=!section.visible;parent.append(block);}}
 function renderControls(){const list=$('home-section-settings');list.replaceChildren();state.sections.forEach((section,index)=>{
  const li=node('li'),label=node('label'),input=document.createElement('input');input.type='checkbox';input.id='home-show-'+section.id;input.checked=section.visible;
  input.addEventListener('change',()=>{section.visible=input.checked;commit('#'+input.id);});label.append(input,node('span',labels[section.id]));li.append(label);
  for(const [delta,text]of [[-1,'Siirrä ylöspäin'],[1,'Siirrä alaspäin']]){const control=button(text,()=>{state=move(state,section.id,delta);commit('#home-move-'+section.id+'-'+(delta<0?'up':'down'));});control.id='home-move-'+section.id+'-'+(delta<0?'up':'down');control.disabled=delta<0?index===0:index===state.sections.length-1;li.append(control);}list.append(li);
 });}
 function toggleAthlete(id){if(!hasAthlete(id)&&state.athletes.length>=100){$('home-settings-status').textContent='Suosikkilista on täynnä. Poista ensin jokin suosikki.';return;}if(hasAthlete(id))state.athletes=state.athletes.filter(saved=>resolveId(saved.id)!==id);else{const person=people.find(person=>person.id===id);if(person)state.athletes.push({id,label:person.name});}commit();notify(hasAthlete(id)?'Painija valittu suosikiksi.':'Painija poistettu suosikeista.');}
 function toggleClub(id){if(!hasClub(id)&&state.clubs.length>=100){$('home-settings-status').textContent='Suosikkilista on täynnä. Poista ensin jokin suosikki.';return;}if(hasClub(id))state.clubs=state.clubs.filter(saved=>saved.id!==id);else{const club=hooks.clubs.find(club=>club.id===id);if(club)state.clubs.push({id,label:club.name});}commit();}
 let noticeTimer;
 function notify(text){const box=$('favorite-notice');if(!box)return;clearTimeout(noticeTimer);box.textContent=text;box.hidden=false;noticeTimer=setTimeout(()=>{box.hidden=true;},5000);}
 function renderSelected(){
  const list=$('home-selected-favorites');list.replaceChildren();
  for(const key of ['athletes','clubs'])for(const saved of state[key]){const li=node('li'),name=key==='athletes'?(hooks.data.athleteRegistry.athletes.find(person=>person.id===resolveId(saved.id))?.name||saved.label):(hooks.clubs.find(club=>club.id===saved.id)?.name||saved.label);
   li.append(original('span',name),button('Poista suosikeista',()=>{state[key]=state[key].filter(entry=>entry.id!==saved.id);commit('#home-selected-heading');}));list.append(li);
  }
  if(!list.children.length)list.append(node('li','Et ole vielä valinnut suosikkeja.'));
 }
 function renderSuggestions(kind){
  const input=$('home-find-'+kind),list=$('home-options-'+kind),query=input.value.trim(),tokens=hooks.utils.searchWords(query);list.replaceChildren();
  if(query.length<2)return;
  const rows=kind==='athlete'?people:hooks.clubs;
  const year=$('favorite-year')?.value,style=$('favorite-style')?.value;
  const found=rows.filter(item=>(!year&&!style||(kind==='athlete'?entriesByAthlete.get(item.id)||[]:item.entries).some(e=>(!year||hooks.year(e.item)===year)&&(!style||hooks.style(e.item,e.result)===style)))&&hooks.utils.matchesSearchWords(hooks.utils.searchWords(item.name),tokens)).slice(0,10);
  for(const item of found){const li=node('li'),selected=kind==='athlete'?hasAthlete(item.id):hasClub(item.id),select=button(selected?'Poista suosikeista':'Lisää suosikiksi',()=>{if(kind==='athlete')toggleAthlete(item.id);else toggleClub(item.id);input.focus();});
   li.append(original('strong',item.name));if(kind==='athlete'){const clubs=[...new Set((entriesByAthlete.get(item.id)||[]).map(entry=>entry.result.club))];li.append(original('small',clubs.join(', ')+' · '+item.id));}else if(item.onlyKll)li.append(node('small','Vain KLL-lähteissä esiintyvä merkintä.'));
   li.append(select);list.append(li);
  }
  if(!found.length)list.append(node('li','Ei hakutuloksia.'));
 }
 function resultList(entries){const list=node('ul');list.className='feature-results';for(const entry of [...entries].sort((a,b)=>hooks.date(b.item)-hooks.date(a.item)||a.result.place-b.result.place).slice(0,3)){
  const li=node('li'),open=button(entry.item.title,()=>hooks.openCompetition(entry.item));open.translate='no';li.append(open,original('p',entry.result.name+' · '+entry.item.details+' · '+entry.result.category+' '+entry.result.weight+' kg · '+entry.result.place+'.'));list.append(li);
 }return list;}
 function renderFavorites(){
  const parent=$('home-favorite-cards');parent.replaceChildren();
  for(const person of resolvedAthletes(state,hooks.data,{resolve:(_,id)=>resolveId(id)})){const card=node('article');card.className='feature-card';const title=node('h3'),open=button(person.name,()=>hooks.openProfile(person.id));open.translate='no';open.disabled=person.missing;title.append(open);card.append(title);
   const entries=entriesByAthlete.get(person.id)||[];if(entries.length)card.append(resultList(entries));else card.append(node('p','Suosikkia tai sen tuloksia ei löydy nykyisestä aineistosta.'));parent.append(card);
  }
  for(const saved of state.clubs){const club=hooks.clubs.find(club=>club.id===saved.id),card=node('article');card.className='feature-card';const title=node('h3'),open=button(club?.name||saved.label,()=>hooks.openClub(saved.id));open.translate='no';open.disabled=!club;title.append(open);card.append(title);
   if(club)card.append(resultList(club.entries));else card.append(node('p','Suosikkia tai sen tuloksia ei löydy nykyisestä aineistosta.'));parent.append(card);
  }
  if(!parent.children.length)parent.append(node('p','Valitse suosikkipainijat ja -seurat Muokkaa etusivua -kohdasta.'));
  if($('favorite-athlete')){$('favorite-athlete').hidden=!athleteId;const selected=hasAthlete(athleteId),label=selected?'Poista painija suosikeista':'Lisää painija suosikiksi';$('favorite-athlete').replaceChildren();const icon=node('span',selected?'★':'☆');icon.setAttribute('aria-hidden','true');$('favorite-athlete').append(icon);$('favorite-athlete').setAttribute('aria-label',label);$('favorite-athlete').title=label;$('favorite-athlete').setAttribute('aria-pressed',String(hasAthlete(athleteId)));}
  if($('favorite-club')){$('favorite-club').hidden=!clubId;$('favorite-club').textContent=hasClub(clubId)?'Poista seura suosikeista':'Lisää seura suosikiksi';$('favorite-club').setAttribute('aria-pressed',String(hasClub(clubId)));}
 }
 function commit(focus){state=normalize(state);window.PAINI_NOTIFICATIONS?.update(hooks.data,state.athletes);const saved=write(storage(),state);applyLayout();renderControls();renderSelected();renderFavorites();renderSuggestions('athlete');renderSuggestions('club');$('home-settings-status').textContent=saved?'Etusivun valinnat tallennettu.':'Valinnat toimivat tällä sivulla, mutta selain ei salli niiden tallentamista.';if(focus){const target=document.querySelector(focus);(target?.disabled?target.closest('li')?.querySelector('input'):target)?.focus({preventScroll:true});}}
 function update(next){hooks={...hooks,...next};resolveId=resolver(hooks.data);entriesByAthlete=new Map();for(const item of hooks.data.competitions)for(const result of item.rows){const id=resolveId(result.athleteId);if(!entriesByAthlete.has(id))entriesByAthlete.set(id,[]);entriesByAthlete.get(id).push({item,result});}people=hooks.data.athleteRegistry.athletes.filter(person=>!person.mergedInto&&entriesByAthlete.has(person.id));applyLayout();renderSelected();renderFavorites();renderSuggestions('athlete');renderSuggestions('club');}
 function mount(next){if(!$('home-customize'))return;hooks=next;state=read(storage());renderControls();update(next);window.PAINI_NOTIFICATIONS?.mount(hooks.data,state.athletes,hooks.openProfile);
  for(const id of ['favorite-year','favorite-style'])$(id)?.addEventListener('change',()=>{renderSuggestions('athlete');renderSuggestions('club');});
  for(const kind of ['athlete','club'])$('home-find-'+kind).addEventListener('input',()=>renderSuggestions(kind));
  $('home-reset').addEventListener('click',()=>{state={...defaults(),athletes:state.athletes,clubs:state.clubs};$('home-find-athlete').value='';$('home-find-club').value='';commit('#home-reset');if($('home-settings-status').textContent==='Etusivun valinnat tallennettu.')$('home-settings-status').textContent='Oletusnäkymä palautettu.';});
  $('favorite-athlete')?.addEventListener('click',()=>{if(athleteId)toggleAthlete(athleteId);});$('favorite-club')?.addEventListener('click',()=>{if(clubId)toggleClub(clubId);});
  window.addEventListener('storage',event=>{if(event.key!==KEY&&event.key!==null)return;state=read(storage());window.PAINI_NOTIFICATIONS?.update(hooks.data,state.athletes);applyLayout();renderControls();renderSelected();renderFavorites();renderSuggestions('athlete');renderSuggestions('club');});
 }
 root.PAINI_HOME={mount,update,favoriteAthletes:()=>state.athletes.map(f=>({...f})),selectAthlete:id=>{if(!hooks)return;athleteId=id;renderFavorites();},selectClub:id=>{if(!hooks)return;clubId=id;renderFavorites();}};
})(typeof window==='undefined'?globalThis:window);
