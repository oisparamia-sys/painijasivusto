"use strict";
(() => {
  let report = null, missing = false;
  const $=s=>document.querySelector(s);
  const time=value=>{const date=new Date(value);return value&&Number.isFinite(date.getTime())?new Intl.DateTimeFormat('fi-FI',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Helsinki'}).format(date):'ei tiedossa';};
  function render() {
    const data=window.PAINI_SHARED_DATA;
    const publicInfo=$('#data-update-info');
    if(publicInfo&&data?.competitions){
      const count=data.competitions.reduce((n,c)=>n+c.rows.length,0);
      const matches=report&&report.competitions===data.competitions.length&&report.results===count;
      publicInfo.textContent=data.competitions.length+' kilpailua · '+count.toLocaleString('fi-FI')+' tulosta. Aineistotiedosto tallennettu: '+time(data.exportedAt||data.updatedAt)+'. '+(matches?'Automaattihaku tarkistettu: '+time(report.checkedAt)+'.':report?'Hakutiedot päivittyvät julkaisun valmistuttua.':'');
    }
    const summary=$('#scan-report-summary');if(!summary)return;
    if(!report){summary.textContent=missing?'Hakuraporttia ei vielä ole saatavilla. Käynnistä päivitetty automaattihaku kerran GitHub Actionsissa.':'Luetaan hakuraporttia…';return;}
    const blocked=report.errors.filter(e=>!e.error.startsWith('Osittainen tuonti:'));
    const legacy=report.errors.filter(e=>e.error.startsWith('Osittainen tuonti:')&&!blocked.some(b=>b.source===e.source));
    const partial=Array.isArray(report.partial)?report.partial:[];
    summary.textContent='Haku tarkistettu '+time(report.checkedAt)+'. Lisätty yhteensä '+report.added+' kilpailua, päivitetty '+report.changed+', ennallaan '+report.unchanged+'. Osittaisia kilpailuja '+(partial.length+legacy.length)+'. Tuomatta jääneitä lähteitä '+blocked.length+'. Raportin aineistossa '+report.competitions+' kilpailua ja '+report.results.toLocaleString('fi-FI')+' tulosta.';
    const partialLines=partial.map(c=>c.title+' · '+c.details+' — mukana '+c.rows+' tulosta ('+({added:'lisätty tällä haulla',updated:'päivitetty tällä haulla',unchanged:'jo aineistossa, ennallaan'}[c.status]||'aineistossa')+'). Puuttuvat painoluokat: '+c.notes.map(n=>n.category+' '+n.weight+' kg').join(', '));
    partialLines.push(...legacy.map(e=>e.source+' — '+e.error+' (Vanhan raportin huomio; tuonnin tila vahvistuu seuraavalla haulla.)'));
    for(const [selector,values] of [['#scan-changes',report.changes.filter(c=>!c.partial).map(c=>(c.kind==='added'?'Lisätty: ':'Päivitetty: ')+c.title+' · '+c.details+' · '+c.rows+' tulosta')],['#scan-partial',partialLines],['#scan-errors',blocked.map(e=>e.source+' — '+e.error)]]){
      const list=$(selector);if(!list)continue;list.replaceChildren();for(const value of values.length?values:['Ei merkintöjä.']){const li=document.createElement('li');li.textContent=value;list.append(li);}
    }
  }
  window.addEventListener('paini-data-ready',render);window.addEventListener('load',render);render();
  fetch('haun-tila.json?fresh='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Raportti puuttuu');return r.json();}).then(value=>{
    if(value.version!==1||!Array.isArray(value.changes)||!Array.isArray(value.errors)||!['competitions','results','added','changed','unchanged'].every(k=>Number.isInteger(value[k])&&value[k]>=0))throw Error('Raportti ei kelpaa');
    report=value;render();
  }).catch(()=>{missing=true;render();});
})();
