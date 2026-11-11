"use strict";
(() => {
  // Keep browser and Actions reports in agreement. Unknown failures need review.
  const groups = [
    {key:'waiting', title:'Lähteestä puuttuvat vahvistetut tulokset', description:'Lähteessä on osallistujalista tai tulosluettelo ilman vahvistettuja sijoituksia. Tuloksia ei päätellä osallistujalistasta.'},
    {key:'source', title:'Lähde ei lataudu', description:'Lähdesivua ei saatu ladattua. Syynä voi olla esimerkiksi puuttuva sivu tai yhteysongelma.'},
    {key:'review', title:'Tiedot vaativat tarkistamista', description:'Lähteen rakenne, määrät tai muut tiedot vaativat tarkistamista ennen tuontia.'}
  ];
  function classifyError(entry) {
    const message=String(entry.error || '').trim();
    if (['Lähteessä on vain osallistujalistat, ei vahvistettuja tuloksia','Tulosluetteloissa ei ole vielä vahvistettuja sijoituksia','Osallistujalla ei ole vahvistettua sijoitusta'].includes(message)) return 'waiting';
    if (/HTTP Error \d{3}\b|<urlopen error|\b(?:timed out|timeout|ENOTFOUND|ECONNRESET|ECONNREFUSED|EAI_AGAIN)\b|Temporary failure in name resolution|Remote end closed connection/i.test(message)) return 'source';
    return 'review';
  }
  function groupErrors(errors) {
    const result={waiting:[],source:[],review:[]};
    for (const entry of errors) if (!String(entry.error || '').startsWith('Osittainen tuonti:')) result[classifyError(entry)].push(entry);
    return result;
  }
  const errorLine=entry=>entry.source+' — '+(entry.error || 'Virheen syy puuttuu raportista; tarkista lähde käsin.');
  function renderMarkdown(state) {
    const grouped=groupErrors(state.errors), partial=state.partial || [];
    const list=items=>items.length?items.map(item=>'- '+item).join('\n'):'Ei merkintöjä.';
    return '# Kilpailuhaku\n\nLisätty '+state.added+', päivitetty '+state.changed+', ennallaan '+state.unchanged+'. Osittaisia kilpailuja '+partial.length+'.\n\n'+
      groups.map(g=>g.title+': '+grouped[g.key].length+'.').join(' ')+'\n\n'+
      '## Lisätyt ja päivitetyt (täydellinen tuonti)\n\n'+list(state.changes.filter(c=>!c.partial).map(c=>c.title+' · '+c.details))+'\n\n'+
      '## Osittain tuodut kilpailut\n\n'+list(partial.map(c=>c.title+' · '+c.details+' · mukana '+c.rows+' tulosta; pois jäivät: '+c.notes.map(n=>n.category+' '+n.weight+' kg').join(', ')))+'\n\n'+
      groups.map(g=>'## '+g.title+' ('+grouped[g.key].length+')\n\n'+g.description+'\n\n'+list(grouped[g.key].map(errorLine))).join('\n\n')+'\n';
  }
  if (typeof module==='object' && module.exports) {
    module.exports={classifyError,groupErrors,renderMarkdown};
    return;
  }
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
  function sourceLink(source, label) {
    try {
      const url=new URL(source);
      if (url.protocol!=='https:' || url.username || url.password || url.port || !['turniereklassisch.ringerdb.de','www.ringerdb.de','ringerdb.de'].includes(url.hostname)) return null;
      const link=document.createElement('a');
      link.href=url.href;link.textContent=label;link.target='_blank';link.rel='noopener noreferrer';
      link.title='Avaa kilpailun alkuperäinen lähde uudessa välilehdessä';
      return link;
    } catch {return null;}
  }
  function listItem(value) {
    const li=document.createElement('li');
    if (typeof value==='string') {li.textContent=value;return li;}
    if (value.sourceFirst) {
      li.append(sourceLink(value.source,value.source) || document.createTextNode(String(value.source || 'Lähde puuttuu')));
      li.append(document.createTextNode(' — '+value.text));
    } else {
      li.textContent=value.text;
      const link=sourceLink(value.source,'Avaa lähde ↗');
      if (link) li.append(document.createTextNode(' · '),link);
    }
    return li;
  }
  const errorItem=entry=>({source:entry.source,sourceFirst:true,text:entry.error || 'Virheen syy puuttuu raportista; tarkista lähde käsin.'});
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
    const grouped=groupErrors(report.errors);
    const blocked=groups.flatMap(g=>grouped[g.key]);
    const legacy=report.errors.filter(e=>e.error.startsWith('Osittainen tuonti:')&&!blocked.some(b=>b.source===e.source));
    const partial=Array.isArray(report.partial)?report.partial:[];
    summary.textContent='Haku tarkistettu '+time(report.checkedAt)+'. Lisätty yhteensä '+report.added+' kilpailua, päivitetty '+report.changed+', ennallaan '+report.unchanged+'. Osittaisia kilpailuja '+(partial.length+legacy.length)+'. '+groups.map(g=>g.title+': '+grouped[g.key].length+'.').join(' ')+' Raportin aineistossa '+report.competitions+' kilpailua ja '+report.results.toLocaleString('fi-FI')+' tulosta.';
    for (const g of groups) { const count=$('#scan-'+g.key+'-count'); if(count)count.textContent=String(grouped[g.key].length); }
    const partialLines=partial.map(c=>({source:c.source,text:c.title+' · '+c.details+' — mukana '+c.rows+' tulosta ('+({added:'lisätty tällä haulla',updated:'päivitetty tällä haulla',unchanged:'jo aineistossa, ennallaan'}[c.status]||'aineistossa')+'). Puuttuvat painoluokat: '+c.notes.map(n=>n.category+' '+n.weight+' kg').join(', ')}));
    partialLines.push(...legacy.map(e=>({...errorItem(e),text:e.error+' (Vanhan raportin huomio; tuonnin tila vahvistuu seuraavalla haulla.)'})));
    for(const [selector,values] of [['#scan-changes',report.changes.filter(c=>!c.partial).map(c=>({source:c.source,text:(c.kind==='added'?'Lisätty: ':'Päivitetty: ')+c.title+' · '+c.details+' · '+c.rows+' tulosta'}))],['#scan-partial',partialLines],...groups.map(g=>['#scan-'+g.key,grouped[g.key].map(errorItem)]),['#scan-errors',blocked.map(errorItem)]]){
      const list=$(selector);if(!list)continue;
      list.replaceChildren(...(values.length?values:['Ei merkintöjä.']).map(listItem));
    }
  }
  window.addEventListener('paini-data-ready',render);window.addEventListener('load',render);render();
  async function check(force=false) {
    if (checking || (!force && Date.now()-lastCheck<15000)) return;
    checking=true;lastCheck=Date.now();
    const button=$('#scan-report-reload'), status=$('#scan-report-status');
    if(button){button.disabled=true;button.textContent='Haetaan raporttia…';}
    if(status)status.textContent='Haetaan viimeisintä tallennettua hakuraporttia…';
    const controller=new AbortController();
    const timeout=window.setTimeout(()=>controller.abort(),15000);
    try {
      const response=await fetch('haun-tila.json?fresh='+Date.now(),{cache:'no-store',signal:controller.signal});
      if (!response.ok) throw Error('Raportti puuttuu');
      const value=await response.json();
      if(value.version!==1||!Array.isArray(value.changes)||!Array.isArray(value.errors)||!['competitions','results','added','changed','unchanged'].every(k=>Number.isInteger(value[k])&&value[k]>=0))throw Error('Raportti ei kelpaa');
      report=value;missing=false;checkFailed=false;render();
      if(status)status.textContent='Viimeisin tallennettu raportti haettu. Tämä painike ei käynnistä kilpailuhakua.';
      return value;
    } catch {
      missing=true;checkFailed=true;render();
      if(status)status.textContent=report?'Uusinta raporttia ei voitu hakea. Alla näkyy aiemmin haettu raportti. Yritä uudelleen.':'Raporttia ei voitu hakea. Tarkista verkkoyhteys ja yritä uudelleen. Jos raporttia ei ole vielä luotu, käynnistä kilpailuhaku GitHub Actionsissa.';
      return null;
    }
    finally {
      window.clearTimeout(timeout);checking=false;
      if(button){button.disabled=false;button.textContent='Hae uusin raportti';}
    }
  }
  $('#scan-report-reload')?.addEventListener('click',()=>check(true));
  const firstCheck=check(true);
  if ($('#refresh-data')) window.PAINI_STARTUP_REPORT=firstCheck;
  // Poll only the public page. Admin tabs may contain unsaved work and never reload here.
  if ($('#refresh-data')) {
    window.addEventListener('focus',()=>check());
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
    window.setInterval(()=>{if(!document.hidden)check();},120000);
  }
})();
