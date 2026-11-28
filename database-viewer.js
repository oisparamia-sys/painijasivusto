"use strict";
(async()=>{
 if(location.protocol==='file:'){document.getElementById('database-status').textContent='Avaa tietokanta minillä Avaa tietokanta.command -tiedostosta. Se käynnistää tietokantaikkunan.';return;}
 const $=id=>document.getElementById(id),hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(n=>n.toString(16).padStart(2,'0')).join('');
 let bundle,status,extra={},page=0,local=false;
 const labels={matches:'Otteluita',wins:'Voittoja',losses:'Tappioita',id:'Tunnus',name:'Nimi',title:'Kilpailu',details:'Paikka ja aika',points:'Pisteet',method:'Voittotapa',code:'Voittotapa',round:'Kierros',competitions:'Kilpailuja',placements:'Sijoituksia',source:'Lähde',sha256:'Tarkistussumma',fetchedAt:'Haettu',fetched_at:'Haettu',resultId:'Tulostunnus',athleteId:'Painijatunnus',athlete_id:'Painijatunnus',competition:'Kilpailu',competition_id:'Kilpailutunnus',place:'Sijoitus',club:'Seura',category:'Sarja',weight:'Paino',red:'Punaisen tulostunnus',blue:'Sinisen tulostunnus',winner:'Voittajan tulostunnus'};
 const row=(columns,values)=>Object.fromEntries(columns.map((c,i)=>[c,values[i]]));
 async function verified(entry){const res=await fetch(entry.file+'?v='+entry.sha256);if(!res.ok)throw Error();const text=await res.text();if(await hash(text)!==entry.sha256)throw Error('Aineistoversio muuttui');return text;}
 async function records(table){
  const d=bundle.data,b=bundle.bouts;
  if(table==='competitions')return d.competitions.map(c=>({id:c.source,title:c.title,details:c.details,placements:c.rows.length}));
  if(table==='athletes')return d.athleteRegistry.athletes.map(p=>({id:p.id,name:p.name,status:p.status,mergedInto:p.mergedInto||''}));
  if(table==='placements')return d.competitions.flatMap(c=>c.rows.map(r=>({...r,competition:c.title,date:c.details})));
  if(table==='athlete_stats'){const rows=new Map(d.athleteRegistry.athletes.map(p=>[p.id,{id:p.id,name:p.name,competitions:0,matches:0,wins:0,losses:0}]));for(const c of d.competitions)for(const id of new Set(c.rows.map(r=>r.athleteId))){if(rows.has(id))rows.get(id).competitions++;}for(const m of b.matches){const red=b.participants[m[5]][1],blue=b.participants[m[6]][1],winner=b.participants[m[7]][1];for(const id of new Set([red,blue])){const r=rows.get(id);if(!r)continue;r.matches++;if(red!==blue)r[id===winner?'wins':'losses']++;}}return [...rows.values()];}
  if(table==='participants')return b.participants.map(p=>row(['resultId','athleteId','competition','category','weight'],[p[0],p[1],b.competitions[p[2]].title,p[3],p[4]]));
  if(table==='matches')return b.matches.map(m=>row(['id','competition','category','weight','round','red','blue','winner','method','points','source'],[m[0],b.competitions[m[1]].title,m[2],m[3],m[4],b.participants[m[5]][0],b.participants[m[6]][0],b.participants[m[7]][0],m[8],m[9]===null?'Ei ilmoitettu':m[9].join('–'),new URL(m[10],b.competitions[m[1]].key).href]));
  if(!extra[table]){const text=await verified(['issues','excluded'].includes(table)?status.issues:status.sourceIndex);extra[table]=['issues','excluded'].includes(table)?JSON.parse(text)[table]:text.trim().split('\n').filter(Boolean).map(line=>{const e=JSON.parse(line);return {id:e.id,source:e.source,sha256:e.sha256,fetchedAt:e.fetchedAt};});}return extra[table];
 }
 const cache=new Map(),collator=new Intl.Collator('fi',{numeric:true}),fold=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('fi').replace(/ß/g,'ss');
 const sorts={athlete_stats:[['competitions-desc','Eniten kilpailuja'],['wins-desc','Eniten otteluvoittoja'],['matches-desc','Eniten otteluita'],['losses-desc','Eniten tappioita'],['name-asc','Nimi A–Ö'],['id-asc','Tunnus']],athletes:[['name-asc','Nimi A–Ö'],['id-asc','Tunnus']],competitions:[['title-asc','Kilpailun nimi A–Ö'],['id-asc','Tunnus']],placements:[['place-asc','Paras sijoitus ensin'],['name-asc','Nimi A–Ö'],['id-asc','Tunnus']]};
 const scroll=$('database-table-scroll'),top=$('database-scroll-top');
 function scrollState(){const max=Math.max(0,scroll.scrollWidth-scroll.clientWidth);$('database-left').disabled=scroll.scrollLeft<=0;$('database-right').disabled=scroll.scrollLeft>=max-1;top.firstElementChild.style.width=scroll.scrollWidth+'px';}
 scroll.addEventListener('scroll',()=>{top.scrollLeft=scroll.scrollLeft;scrollState();},{passive:true});top.addEventListener('scroll',()=>{scroll.scrollLeft=top.scrollLeft;},{passive:true});
 $('database-left').addEventListener('click',()=>scroll.scrollBy({left:-scroll.clientWidth*.75,behavior:'smooth'}));$('database-right').addEventListener('click',()=>scroll.scrollBy({left:scroll.clientWidth*.75,behavior:'smooth'}));
 new ResizeObserver(scrollState).observe(scroll);
 function sortOptions(selected){const options=sorts[$('database-table').value]||[['id-asc','Tunnus']];$('database-sort').replaceChildren(...options.map(([value,label])=>new Option(label,value)));if(options.some(([value])=>value===selected))$('database-sort').value=selected;}
 let request=0,controller,timer;
 async function render(){
  const token=++request,table=$('database-table').value,query=fold($('database-query').value.trim()),sort=$('database-sort').value,requestedPage=page;
  controller?.abort();controller=new AbortController();scroll.setAttribute('aria-busy','true');$('database-prev').disabled=$('database-next').disabled=true;
  try{
   let rows,count,columns;
   if(local){
    const response=await fetch('api/database?'+new URLSearchParams({table,page:requestedPage,query,sort}),{signal:controller.signal});if(!response.ok)throw Error();const answer=await response.json();
    if(token!==request)return;rows=answer.rows.map(values=>row(answer.columns,values));count=answer.count;page=answer.page;columns=answer.columns;
   }else{
    if(!cache.has(table))cache.set(table,records(table).catch(error=>{cache.delete(table);throw error;}));
    const all=await cache.get(table);if(token!==request)return;
    rows=all.filter(r=>!query||Object.values(r).some(v=>fold(v).includes(query)));
    const [field,direction]=sort.split('-'),sign=direction==='desc'?-1:1;
    rows.sort((a,b)=>sign*(typeof a[field]==='number'&&typeof b[field]==='number'?a[field]-b[field]:collator.compare(String(a[field]??''),String(b[field]??'')))||collator.compare(String(a.id),String(b.id)));
    count=rows.length;page=Math.min(requestedPage,Math.max(0,Math.ceil(count/50)-1));columns=Object.keys(rows[0]||{});rows=rows.slice(page*50,page*50+50);
   }
   $('database-columns').replaceChildren();$('database-rows').replaceChildren();const header=document.createElement('tr');
   for(const col of columns){const th=document.createElement('th');th.scope='col';th.textContent=labels[col]||col;header.append(th);}$('database-columns').append(header);
   const fragment=document.createDocumentFragment();for(const record of rows){const tr=document.createElement('tr');for(const col of columns){const td=document.createElement('td'),value=String(record[col]??''),target=window.PAINI_DATABASE_LINKS.linkFor(col,value,record,location.href);td.textContent=value;if(target){const link=document.createElement('a');link.href=target.href;link.textContent=value;link.title=target.label;if(target.external){link.target='_blank';link.rel='noopener noreferrer';}td.replaceChildren(link);}td.dataset.label=labels[col]||col;td.style.overflowWrap='anywhere';tr.append(td);}fragment.append(tr);}$('database-rows').append(fragment);
   $('database-count').textContent=count.toLocaleString('fi-FI')+' merkintää'+(table==='athlete_stats'?' · Kilpailut: eri kilpailut, joista on sijoitus. Voitot: vahvistetut otteluvoitot.':'');$('database-page').textContent='Sivu '+(page+1)+' / '+Math.max(1,Math.ceil(count/50));$('database-prev').disabled=!page;$('database-next').disabled=(page+1)*50>=count;
   scroll.scrollTop=0;scrollState();
  }catch(error){if(token===request&&error.name!=='AbortError')$('database-count').textContent='Tietoryhmää ei voitu ladata. Yritä uudelleen tai päivitä sivu.';}
  finally{if(token===request)scroll.setAttribute('aria-busy','false');}
 }
 try{
  if(['127.0.0.1','localhost'].includes(location.hostname)){const response=await fetch('api/database');if(response.ok){status=await response.json();local=true;}}
  if(!local){const io=window.PAINI_DATA_IO.create({base:new URL('.',location.href),fetch,hash});status=await (await fetch('database-public-index.json',{cache:'no-store'})).json();const manifest=await io.manifest();if(manifest.databaseRevision!==status.revision)throw Error('Tietokannan julkaisuversiot eroavat');bundle=await io.bundle(manifest,true);}
  $('database-status').textContent='Tietokannassa '+status.tables.competitions+' kilpailua, '+status.tables.placements+' sijoitusta ja '+status.tables.matches+' ottelua. Vain luku.';
  function route(){const params=new URLSearchParams(location.hash.slice(1)),table=params.get('table');if([...$('database-table').options].some(o=>o.value===table))$('database-table').value=table;$('database-query').value=params.get('query')||'';sortOptions(params.get('sort'));page=0;render();}
  window.addEventListener('hashchange',route);
  function changed(event){clearTimeout(timer);page=0;if(event.target.id==='database-table')sortOptions();history.replaceState(null,'',location.pathname+location.search+'#'+new URLSearchParams({table:$('database-table').value,query:$('database-query').value,sort:$('database-sort').value}));if(event.type==='input'){controller?.abort();request++;timer=setTimeout(render,150);}else render();}
  for(const id of ['database-query','database-table','database-sort'])$(id).addEventListener(id==='database-query'?'input':'change',changed);
  $('database-prev').addEventListener('click',()=>{page--;render();});$('database-next').addEventListener('click',()=>{page++;render();});route();

 }catch{$('database-status').textContent='Tietokantaa ei voitu ladata. Tarkista yhteys ja yritä uudelleen.';}
})();
