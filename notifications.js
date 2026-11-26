"use strict";
(function(root){
 const KEY='paini-notifications-v1',LIMIT=200,ID=/^tulos-\d{6,}$/;
 const empty=()=>({version:1,enabled:true,cursor:null,watch:[],items:[]});
 function normalize(input){
  const s=empty();if(input?.version!==1)return s;s.enabled=input.enabled!==false;
  s.cursor=Number.isSafeInteger(input.cursor)&&input.cursor>=0?input.cursor:null;
  s.watch=[...new Set((Array.isArray(input.watch)?input.watch:[]).filter(id=>typeof id==='string'&&/^painija-\d{6,}$/.test(id)))].slice(0,100);
  const seen=new Set();s.items=(Array.isArray(input.items)?input.items:[]).filter(i=>i&&ID.test(i.resultId)&&!seen.has(i.resultId)&&seen.add(i.resultId)).slice(0,LIMIT).map(i=>({resultId:i.resultId,read:i.read===true,watch:[...new Set((Array.isArray(i.watch)?i.watch:[]).filter(id=>typeof id==='string'&&/^painija-\d{6,}$/.test(id)))].slice(0,100)}));return s;
 }
 function resolveFor(data){const people=new Map(data.athleteRegistry.athletes.map(p=>[p.id,p]));return id=>{const seen=new Set();while(people.get(id)?.mergedInto){if(seen.has(id))return null;seen.add(id);id=people.get(id).mergedInto;}return people.has(id)?id:null;};}
 function advance(input,data,favorites){
  const state=normalize(input),resolve=resolveFor(data),watch=[...new Set(favorites.map(f=>f.id))],oldWatch=new Set(state.watch),eligible=new Set(watch.filter(id=>oldWatch.has(id)).map(resolve).filter(Boolean));
  const rows=data.competitions.flatMap(c=>c.rows),cursor=rows.reduce((n,r)=>Math.max(n,ID.test(r.resultId)?Number(r.resultId.slice(6)):0),Number.isSafeInteger(data.athleteRegistry.nextResult)?data.athleteRegistry.nextResult-1:0);
  const additions=state.enabled&&state.cursor!==null?rows.filter(r=>Number(r.resultId.slice(6))>state.cursor&&eligible.has(resolve(r.athleteId))).map(r=>({resultId:r.resultId,read:false,watch:watch.filter(id=>oldWatch.has(id)&&resolve(id)===resolve(r.athleteId))})):[];
  const known=new Map([...state.items,...additions].map(i=>[i.resultId,i]));state.items=[...known.values()].sort((a,b)=>Number(b.resultId.slice(6))-Number(a.resultId.slice(6))).slice(0,LIMIT);
  state.cursor=Math.max(state.cursor||0,cursor);state.watch=watch;return state;
 }
 function visible(state,data,favorites){
  const resolve=resolveFor(data),ids=new Set(favorites.map(f=>resolve(f.id)).filter(Boolean)),rows=new Map(data.competitions.flatMap(item=>item.rows.map(result=>[result.resultId,{item,result}])));
  return normalize(state).items.flatMap(i=>{const e=rows.get(i.resultId);return e&&ids.has(resolve(e.result.athleteId))&&i.watch.some(id=>favorites.some(f=>f.id===id)&&resolve(id)===resolve(e.result.athleteId))?[{...i,...e}]:[];});
 }
 function read(storage){try{return normalize(JSON.parse(storage?.getItem(KEY)||'null'));}catch{return empty();}}
 const model={KEY,LIMIT,empty,normalize,advance,visible,read};if(typeof module==='object'&&module.exports){module.exports=model;return;}
 let data,favorites=[],openProfile,state,storage;
 const $=id=>document.getElementById(id),node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 function save(){try{if(!storage)throw Error('storage');storage.setItem(KEY,JSON.stringify(state));}catch{if($('notifications-status'))$('notifications-status').textContent='Ilmoitukset toimivat tällä sivulla, mutta selain ei salli niiden tallentamista.';}}
 function render(){
  const list=$('notifications-list');if(!list||!data)return;const items=visible(state,data,favorites),unread=items.filter(i=>!i.read).length;
  $('notifications-enabled').checked=state.enabled;$('notifications-count').textContent=String(unread);$('notifications-count').hidden=!unread;$('notifications-read').disabled=!unread;$('notifications-clear').disabled=!state.items.length;list.replaceChildren();
  $('notifications-empty').hidden=!!items.length;
  for(const e of items){const li=node('li');li.className=e.read?'notification-read':'notification-unread';const title=node('button',e.result.name);title.type='button';title.translate='no';title.addEventListener('click',()=>{const saved=state.items.find(i=>i.resultId===e.resultId);if(saved)saved.read=true;save();render();openProfile(e.result.athleteId);});const detail=node('p',e.item.title+' · '+e.item.details+' · '+e.result.category+' '+e.result.weight+' kg · '+e.result.place+'.');detail.translate='no';li.append(title,detail);if(!e.read)li.append(node('span','Uusi tulos'));list.append(li);}
 }
 function update(next,nextFavorites){data=next;favorites=nextFavorites||favorites;const before=JSON.stringify(state);state=advance(state,data,favorites);if(JSON.stringify(state)!==before)save();render();}
 root.PAINI_NOTIFICATIONS={mount(next,selected,open){if(!state){try{storage=localStorage;}catch{}state=read(storage);openProfile=open;
   $('notifications-enabled')?.addEventListener('change',()=>{state.enabled=$('notifications-enabled').checked;state=advance(state,data,favorites);save();render();});
   $('notifications-read')?.addEventListener('click',()=>{state.items.forEach(i=>i.read=true);save();render();});$('notifications-clear')?.addEventListener('click',()=>{state.items=[];save();render();});
   window.addEventListener('paini-data-ready',()=>update(window.PAINI_SHARED_DATA,window.PAINI_HOME?.favoriteAthletes()||favorites));
   window.addEventListener('storage',e=>{if(e.key!==KEY&&e.key!==null)return;state=read(storage);update(data,favorites);});
  }update(next,selected);},update};
})(typeof window==='undefined'?globalThis:window);
