"use strict";
// This is only the verified home overview. Searches still use the full dataset.
window.PAINI_HOME_PREVIEW={render(value){
 if(window.PAINI_PAGE_STATE||value?.version!==1||!Array.isArray(value.latest))return;
 const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
 const stats=document.getElementById('home-stats');stats.replaceChildren();
 for(const [label,key]of [['Kilpailuja','competitions'],['Sijoituksia','results'],['Otteluita','matches']]){const card=el('div',undefined,'feature-stat');card.append(el('span',label),el('strong',String(value.total[key])));stats.append(card);}
 const years=document.getElementById('home-year'),chosen=years.value;years.replaceChildren(new Option('Kaikki vuodet',''));for(const year of value.years)years.add(new Option(year,year));years.value=chosen;
 const list=document.getElementById('home-latest');list.replaceChildren();
 for(const c of value.latest){
  const card=el('article',undefined,'feature-card');if(c.date>0){const date=new Date(c.date),badge=el('div',undefined,'competition-date');badge.setAttribute('aria-hidden','true');badge.append(el('strong',String(date.getUTCDate())),el('span',new Intl.DateTimeFormat('fi-FI',{month:'short',timeZone:'UTC'}).format(date)));card.append(badge);}
  const title=el('h3',c.title),details=el('p',c.details);title.translate=details.translate='no';const button=el('button','Näytä tulokset');button.type='button';button.addEventListener('click',()=>{window.PAINI_PENDING_COMPETITION=c.source;document.getElementById('nav-results').click();});
  card.append(title,details,el('p',c.rows+' kilpailusijoitusta'),button);list.append(card);
 }
 document.getElementById('home-view').dataset.preview='ready';
}};
