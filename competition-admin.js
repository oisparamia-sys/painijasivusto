"use strict";
(async()=>{
 const $=id=>document.getElementById(id),U=window.PAINI_UTILS,hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(n=>n.toString(16).padStart(2,'0')).join('');
 const year=c=>c.details.match(/\b20\d{2}\b/)?.[0]||'Ei päivämäärää';
 const date=c=>{const m=c.details.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/);if(!m)return -Infinity;const value=Date.UTC(+m[3],+m[2]-1,+m[1]),d=new Date(value);return d.getUTCFullYear()===+m[3]&&d.getUTCMonth()===+m[2]-1&&d.getUTCDate()===+m[1]?value:-Infinity;};
 const style=(c,r)=>['greco','freestyle','women'].includes(c.categoryStyles?.[r.category])?c.categoryStyles[r.category]:'unknown';
 const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 try{
  const io=window.PAINI_DATA_IO.create({base:new URL('.',location.href),fetch,hash}),{data}=await io.bundle(await io.manifest());
  for(const value of [...new Set(data.competitions.map(year))].sort().reverse())$('admin-competition-year').add(new Option(value,value));
  function render(){
   const query=$('admin-competition-query').value.trim(),selectedYear=$('admin-competition-year').value,selectedStyle=$('admin-competition-style').value,sort=$('admin-competition-sort').value;
   const found=data.competitions.filter(c=>(!selectedYear||year(c)===selectedYear)&&(!selectedStyle||c.rows.some(r=>style(c,r)===selectedStyle))&&U.matchesCompetitionQuery(c.title+' '+c.details,query));
   found.sort((a,b)=>{if(sort==='importance'){const difference=U.competitionTier(a.title)-U.competitionTier(b.title);if(difference)return difference;}if(sort!=='name'){const left=date(a),right=date(b);if(left!==right){if(left===-Infinity)return 1;if(right===-Infinity)return -1;return sort==='oldest'?left-right:right-left;}}return a.title.localeCompare(b.title,'fi')||a.details.localeCompare(b.details,'fi');});
   const list=$('admin-competition-list');list.replaceChildren();for(const c of found){
    const card=node('li');card.append(node('h2',c.title),node('p',c.details),node('p',c.rows.length+' tulosriviä · '+new Set(c.rows.map(r=>r.club)).size+' seuraa'));
    if(c.importNotes?.length)card.append(node('p','Osittainen aineisto: '+c.importNotes.length+' huomiota. Näytä tulokset tarkastellaksesi puutteita.'));
    const actions=node('div');actions.className='competition-actions';const open=node('a','Näytä tulokset');const url=new URL('index.html',location.href);url.hash=new URLSearchParams({kilpailu:JSON.stringify([c.title,c.details].map(v=>v.trim().replace(/\s+/g,' ').toLocaleLowerCase('fi')))});open.href=url.href;open.target='_blank';open.rel='noopener';actions.append(open);
    try{const source=new URL(c.source);if(source.protocol==='https:'&&source.hostname==='turniereklassisch.ringerdb.de'&&!source.username&&!source.password){const a=node('a','Alkuperäinen tulossivu ↗');a.href=source.href;a.target='_blank';a.rel='noopener noreferrer';actions.append(a);}}catch{}
    card.append(actions);list.append(card);
   }
   $('admin-competition-count').textContent=found.length+' kilpailua · '+found.reduce((sum,c)=>sum+c.rows.length,0)+' tulosriviä';
   const options=$('admin-competition-options');options.replaceChildren();options.hidden=query.length<2||!found.length;
   if(!options.hidden)for(const c of found.slice(0,8)){const li=node('li'),button=node('button',c.title+' · '+c.details);button.type='button';button.addEventListener('click',()=>{$('admin-competition-query').value=c.title;render();options.hidden=true;});li.append(button);options.append(li);}
  }
  for(const id of ['admin-competition-query','admin-competition-year','admin-competition-style','admin-competition-sort'])$(id).addEventListener(id.endsWith('query')?'input':'change',render);
  $('admin-competition-query').addEventListener('keydown',e=>{if(e.key==='Escape')$('admin-competition-options').hidden=true;});
  document.addEventListener('click',e=>{if(e.target!==$('admin-competition-query')&&!$('admin-competition-options').contains(e.target))$('admin-competition-options').hidden=true;});
  $('admin-competition-status').textContent='Kilpailuluettelo on ylläpidon käytössä.';render();
 }catch{$('admin-competition-status').textContent='Kilpailuja ei voitu ladata. Tarkista verkkoyhteys ja yritä uudelleen.';}
})();
