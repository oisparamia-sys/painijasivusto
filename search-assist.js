"use strict";
(() => {
 let data,entries=[],mounted=false;
 const U=()=>window.PAINI_UTILS;
 function update(next){data=next;const names=new Map();for(const c of data.competitions){names.set(c.title+' · '+c.details,{label:c.title+' · '+c.details,value:c.title+' '+c.details,kind:'competition'});for(const r of c.rows){names.set('athlete:'+r.name,{label:r.name,value:r.name,kind:'athlete'});names.set('club:'+r.club,{label:r.club,value:r.club,kind:'club'});}}entries=[...names.values()].map(e=>({...e,words:U().searchWords(e.value)}));}
 function attach(id,kind){
  const input=document.getElementById(id);if(!input)return;
  const list=document.createElement('ul');list.id=id+'-suggestions';list.className='search-options';list.setAttribute('role','listbox');list.setAttribute('aria-label','Hakuehdotukset');list.hidden=true;input.insertAdjacentElement('afterend',list);
  input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',list.id);input.setAttribute('aria-expanded','false');input.autocomplete='off';
  let selected=-1,found=[];
  function close(){list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');selected=-1;}
  function choose(n){if(!found[n])return;input.value=found[n].value;close();input.dispatchEvent(new Event('input',{bubbles:true}));close();input.focus({preventScroll:true});}
  function render(){const query=input.value.trim();list.replaceChildren();selected=-1;input.removeAttribute('aria-activedescendant');if(query.length<2){close();return;}
   const tokens=U().searchWords(query),exact=query.toLocaleLowerCase('fi'),dateQuery=/\d{1,2}[./]\d{1,2}/.test(query);
   found=entries.filter(e=>(!kind||e.kind===kind)&&(dateQuery?U().matchesCompetitionQuery(e.value,query):U().matchesSearchWords(e.words,tokens))).sort((a,b)=>Number(!a.value.toLocaleLowerCase('fi').startsWith(exact))-Number(!b.value.toLocaleLowerCase('fi').startsWith(exact))||a.label.localeCompare(b.label,'fi')).slice(0,8);
   found.forEach((e,n)=>{const li=document.createElement('li');li.id=list.id+'-'+n;li.role='option';li.setAttribute('aria-selected','false');const button=document.createElement('button');button.type='button';button.tabIndex=-1;button.textContent=e.label;button.translate='no';button.addEventListener('click',()=>choose(n));li.append(button);list.append(li);});list.hidden=!found.length;input.setAttribute('aria-expanded',String(!!found.length));
  }
  input.addEventListener('input',render);input.addEventListener('focus',render);
  input.addEventListener('keydown',event=>{if(event.key==='Escape'){if(!list.hidden)event.preventDefault();close();return;}if(list.hidden)return;if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();selected=selected<0?(event.key==='ArrowDown'?0:found.length-1):(selected+(event.key==='ArrowDown'?1:-1)+found.length)%found.length;for(const [n,el]of [...list.children].entries())el.setAttribute('aria-selected',String(n===selected));input.setAttribute('aria-activedescendant',list.children[selected].id);list.children[selected].scrollIntoView({block:'nearest'});}else if(event.key==='Enter'&&selected>=0){event.preventDefault();choose(selected);}});
  input.addEventListener('focusout',()=>setTimeout(()=>{if(document.activeElement!==input&&!list.contains(document.activeElement))close();},120));document.addEventListener('click',event=>{if(event.target!==input&&!list.contains(event.target))close();});
 }
 window.PAINI_SEARCH_ASSIST={update,mount(next){update(next);if(mounted)return;mounted=true;attach('home-search');attach('search');attach('club-search','club');}};
})();
