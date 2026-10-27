"use strict";
    function parseLigaDB(text) {
      const lines = text.replace(/^\uFEFF/, "").replace(/\0/g, "").replace(/\r\n?/g, "\n").split("\n");
      const firstGroup = lines.findIndex(line => /^\s*\d+(?:[.,]\d+)?\s*kg\s*\t/i.test(line));
      if (firstGroup < 0) throw new Error("Sarjoja ei löytynyt. Valitse nimenomaan tab-eroteltu tulosluettelo, ei ottelutiedostoa tai HTML-sivua.");
      const header = lines.slice(0, firstGroup).map(line => line.trim()).filter(Boolean);
      if (!header.length) throw new Error("Tiedostosta puuttuu kilpailun nimi.");
      const dateLine = header.find(line => /\d{1,2}[./]\d{1,2}[./]\d{4}/.test(line) && line !== header[0]) || "";
      const rows = [];
      const seen = new Set();
      let group = null;
      let skipped = 0;
      const unexpected = [];

      lines.slice(firstGroup).forEach((line, index) => {
        if (!line.trim()) return;
        const cells = line.split("\t").map(cell => cell.trim());
        if (/^\s*\d+(?:[.,]\d+)?\s*kg\s*\t/i.test(line)) {
          const weight = cells[0].match(/^(\d+(?:[.,]\d+)?)\s*kg$/i);
          if (!weight || !cells[1]) throw new Error("Yhden sarjan painoluokka tai ikäluokka puuttuu.");
          group = { weight: weight[1].replace(",", "."), category: cells[1] };
          return;
        }
        while (cells.length && cells[0] === "") cells.shift();
        if (!cells.length) return;
        if (/^tyhj[äa]$/i.test(cells[0])) { skipped++; return; }
        const place = cells[0].match(/^(\d+)\.$/);
        if (!group || !place || cells.length < 3 || !cells[1] || !cells[2] || Number(place[1]) < 1) {
          unexpected.push(firstGroup + index + 1);
          return;
        }
        const row = { place: Number(place[1]), name: cells[1], club: cells[2], ...group };
        const key = JSON.stringify(row);
        if (seen.has(key)) { skipped++; return; }
        seen.add(key);
        rows.push(row);
      });

      if (unexpected.length) throw new Error("Tiedoston rivin " + unexpected[0] + " rakennetta ei tunnistettu. Tuonti keskeytettiin, jotta tuloksia ei jäisi huomaamatta pois.");
      if (!rows.length) throw new Error("Tiedostosta ei löytynyt sijoituksia. Kilpailussa saattaa olla vasta osallistujalistat.");
      return { title: header[0], details: dateLine, rows, skipped };
    }

    function decodeFile(buffer) {
      try { return { text: new TextDecoder("utf-8", { fatal: true }).decode(buffer), encoding: "UTF-8" }; }
      catch { return { text: new TextDecoder("windows-1252").decode(buffer), encoding: "Windows-1252" }; }
    }


(() => {
const $=s=>document.querySelector(s),R=window.PainiRegistry;
let data,next=null,items=[],running=false,stop=false,dirty=false;
const say=t=>$('#status').textContent=t;
const norm=s=>R.norm(s),signature=c=>JSON.stringify(c.rows.map(r=>[r.name,r.club,r.category,r.weight,r.place]).map(r=>JSON.stringify(r)).sort());
async function api(path){const r=await fetch('/api/'+path);const j=await r.json();if(!r.ok)throw Error(j.error||'Lähde ei vastaa');return j;}
function error(url,message){const li=document.createElement('li');li.textContent=url+' — '+message;$('#errors').append(li);}
function controls(){const checked=items.filter(i=>i.box.checked).length;$('#preview').disabled=running||!checked;$('#select-new').disabled=running;$('#clear').disabled=running;$('#scan').disabled=running||dirty;$('#stop').disabled=!running;$('#summary').textContent=items.length+' uutta tai muuttunutta kilpailua · '+checked+' valittu';}
function validateSource(response){const item=parseLigaDB(response.text);if(item.skipped)throw Error('Tiedostossa on ohitettuja rivejä; tarkista käsin.');const categories=[...new Set(item.rows.map(r=>r.category))];item.categoryStyles={};item.styleSources={};for(const category of categories){const matches=response.pages.filter(p=>norm(p.category)===norm(category));if(matches.length!==1)throw Error('Sarjan lähdevastaavuus puuttuu: '+category);const p=matches[0];if(item.rows.filter(r=>r.category===category).length!==p.count)throw Error('Sarjan tulosmäärä ei täsmää: '+category);item.categoryStyles[category]=p.style;item.styleSources[category]=p.url;}if(item.rows.length!==response.pages.reduce((n,p)=>n+p.count,0))throw Error('Kilpailun kokonaistulosmäärä ei täsmää');return {...item,source:response.source,textSource:response.textSource,fileInfo:'LigaDB · automaattihaku · '+new Date().toISOString().slice(0,10)};}
$('#scan').onclick=async()=>{running=true;stop=false;items=[];next=null;$('#results').replaceChildren();$('#errors').replaceChildren();$('#confirmation').hidden=true;controls();let urls=[],done=0,unchanged=0;const years=$('#year').value==='all'?[2022,2023,2024,2025,2026]:[Number($('#year').value)];for(const year of years){if(stop)break;say('Luetaan vuoden '+year+' kilpailuluetteloa…');try{urls.push(...await api('catalog?year='+year));}catch(e){error(String(year),e.message);}}urls=[...new Set(urls)];const existing=new Map(data.competitions.map(c=>[R.compKey(c),c]));const seen=new Set();let cursor=0;
async function worker(){while(!stop&&cursor<urls.length){const url=urls[cursor++];try{const item=validateSource(await api('competition?url='+encodeURIComponent(url))),key=R.compKey(item);if(seen.has(key))throw Error('Sama kilpailu löytyy usealla lähdeosoitteella');seen.add(key);const previous=existing.get(key);if(previous&&signature(previous)===signature(item)){unchanged++;}else{const card=document.createElement('article'),label=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.onchange=()=>{next=null;$('#confirmation').hidden=true;controls();};label.append(box,document.createTextNode((previous?'Päivitys: ':'Uusi: ')+item.title+' · '+item.details+' · '+item.rows.length+' tulosta'));const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.textContent='Alkuperäinen tulossivu';card.append(label,a);if(!previous){const sameDate=data.competitions.filter(c=>norm(c.details)===norm(item.details));if(sameDate.length){const p=document.createElement('p');p.textContent='Tarkista mahdollinen kaksoiskilpailu: '+sameDate.map(c=>c.title).join(', ');card.append(p);}}$('#results').append(card);items.push({item,box});}}catch(e){error(url,e.message);}done++;say('Tarkistettu '+done+'/'+urls.length+' · ennallaan '+unchanged);}}
try{await Promise.all([worker(),worker(),worker()]);}finally{running=false;controls();say((stop?'Haku keskeytetty. ':'Haku valmis. ')+done+'/'+urls.length+' tarkistettu; '+unchanged+' ennallaan. Virhelistan kilpailuja ei tuoda.');}};
$('#stop').onclick=()=>{stop=true;say('Keskeytetään käynnissä olevien lähdepyyntöjen jälkeen…');};$('#select-new').onclick=()=>{next=null;$('#confirmation').hidden=true;items.forEach(i=>{i.box.checked=!data.competitions.some(c=>R.compKey(c)===R.compKey(i.item));});controls();};$('#clear').onclick=()=>{items.forEach(i=>i.box.checked=false);next=null;$('#confirmation').hidden=true;controls();};$('#auto').onchange=()=>{next=null;$('#confirmation').hidden=true;};
$('#preview').onclick=()=>{try{const incoming=items.filter(i=>i.box.checked).map(i=>i.item);next=R.importCompetitions(data,incoming,{autoMergeNameClub:$('#auto').checked});$('#changes').textContent=incoming.length+' kilpailua tuodaan. Ennen: '+data.competitions.length+' kilpailua, '+R.rows(data).length+' tulosta. Jälkeen: '+next.competitions.length+' kilpailua, '+R.rows(next).length+' tulosta. Alkuperäiset profiiliyhdistämiset säilyvät; muutetun kilpailun poistuvat rivit korvautuvat lähteen tuloksilla.';$('#confirmation').hidden=false;$('#confirmation').scrollIntoView();}catch(e){say(e.message);}};
$('#cancel').onclick=()=>{next=null;$('#confirmation').hidden=true;};$('#accept').onclick=()=>{if(!next)return;data=next;next=null;dirty=true;$('#confirmation').hidden=true;items=[];$('#results').replaceChildren();$('#download').disabled=false;controls();say('Muutokset hyväksyttiin. Lataa päivitetty data.js ja siirrä se projektikansioon.');};$('#download').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([R.exportSource(data)],{type:'text/javascript;charset=utf-8'}));a.href=url;a.download='data.js';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
try{R.validate(window.PAINI_SHARED_DATA);data=JSON.parse(JSON.stringify(window.PAINI_SHARED_DATA));$('#scan').disabled=false;say('Luettu '+data.competitions.length+' kilpailua ja '+R.rows(data).length+' tulosta. Valitse vuodet ja aloita haku.');}catch(e){say('Avaaminen epäonnistui: '+e.message+' Pidä hakutiedostot samassa kansiossa data.js- ja athlete-registry.js-tiedostojen kanssa.');}
})();
