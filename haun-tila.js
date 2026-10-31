"use strict";
(() => {
  let report = null, missing = false, checkFailed = false, checking = false, lastCheck = -Infinity;
  const $=s=>document.querySelector(s);
  const time=value=>{const date=new Date(value);return value&&Number.isFinite(date.getTime())?new Intl.DateTimeFormat('fi-FI',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Helsinki'}).format(date):'ei tiedossa';};
  function hasNewData(data) {
    if (!report || !Array.isArray(data?.competitions)) return false;
    // checkedAt changes on every scan; only updatedAt identifies changed data.
    const currentTimes=[data.updatedAt,data.exportedAt].map(Date.parse).filter(Number.isFinite);
    const loadedAt=currentTimes.length ? Math.max(...currentTimes) : null;
    const publishedAt=Date.parse(report.updatedAt);
    if (loadedAt !== null && Number.isFinite(publishedAt)) return publishedAt > loadedAt;
    return report.competitions !== data.competitions.length || report.results !== data.competitions.reduce((n,c)=>n+c.rows.length,0);
  }
  function renderRefresh(data) {
    const box=$('#data-refresh-box'), notice=$('#data-refresh-status');
    if (!box || !notice) return;
    const available=hasNewData(data); box.dataset.updateAvailable=String(available);
    if (available) notice.textContent='Uusi aineisto on saatavilla: '+report.competitions+' kilpailua ja '+report.results.toLocaleString('fi-FI')+' tulosta. Paina Päivitä tiedot.';
    else if (checkFailed) notice.textContent='Päivityksiä ei voitu tarkistaa. Voit yrittää ladata uusimman sivun Päivitä tiedot -painikkeesta.';
    else if (report && data?.competitions) notice.textContent='Käytössä on uusin tarkistettu aineisto. Tarkistettu '+time(report.checkedAt)+'.';
  }
  function render() {
    const data=window.PAINI_SHARED_DATA;
    renderRefresh(data);
    const publicInfo=$('#data-update-info');
    if(publicInfo&&data?.competitions){
      const count=data.competitions.reduce((n,c)=>n+c.rows.length,0);
      const matches=report&&!hasNewData(data)&&report.competitions===data.competitions.length&&report.results===count;
      publicInfo.textContent=data.competitions.length+' kilpailua · '+count.toLocaleString('fi-FI')+' tulosta. Aineistotiedosto tallennettu: '+time(data.exportedAt||data.updatedAt)+'. '+(matches?'Automaattihaku tarkistettu: '+time(report.checkedAt)+'.':report?(hasNewData(data)?'Uusi aineisto on saatavilla. Paina sivun yläosan Päivitä tiedot -painiketta.':'Hakutiedot päivittyvät julkaisun valmistuttua.'):'');
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
  async function check(force=false) {
    if (checking || (!force && Date.now()-lastCheck<15000)) return;
    checking=true;lastCheck=Date.now();
    const controller=new AbortController();
    const timeout=window.setTimeout(()=>controller.abort(),15000);
    try {
      const response=await fetch('haun-tila.json?fresh='+Date.now(),{cache:'no-store',signal:controller.signal});
      if (!response.ok) throw Error('Raportti puuttuu');
      const value=await response.json();
      if(value.version!==1||!Array.isArray(value.changes)||!Array.isArray(value.errors)||!['competitions','results','added','changed','unchanged'].every(k=>Number.isInteger(value[k])&&value[k]>=0))throw Error('Raportti ei kelpaa');
      report=value;missing=false;checkFailed=false;render();
    } catch {missing=true;checkFailed=true;render();}
    finally {window.clearTimeout(timeout);checking=false;}
  }
  check(true);
  // Poll only the public page. Admin tabs may contain unsaved work and never reload here.
  if ($('#refresh-data')) {
    window.addEventListener('focus',()=>check());
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
    window.setInterval(()=>{if(!document.hidden)check();},120000);
  }
})();
