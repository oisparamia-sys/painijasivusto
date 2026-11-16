"use strict";
(() => {
  let initialized = false,trial=null,dataPromise=null;
  const dataBase=new URL('.',document.currentScript?.src || location.href);
  function loadTrial() {
    if(dataPromise)return dataPromise;
    dataPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=new URL('ottelut-data.js?fresh='+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),dataBase).href;
      script.onload=()=>{
        const value=window.PAINI_BOUTS_DATA;
        if(value?.version!==2 || !Array.isArray(value.competitions) || !Array.isArray(value.participants) || !Array.isArray(value.matches) || !Array.isArray(value.excluded)) {script.remove();reject(Error('Otteluaineiston muoto ei kelpaa'));return;}
        resolve(value);
      };
      script.onerror=()=>{script.remove();reject(Error('Otteluaineisto ei latautunut'));};
      document.head.append(script);
    }).catch(error=>{dataPromise=null;throw error;});
    return dataPromise;
  }
  const labels = {YPV:'Ylivoimainen pistevoitto',PV:'Pistevoitto',SV:'Selätys',VFA:'Selätys',VPO:'Pistevoitto',VPO1:'Pistevoitto',VSU:'Ylivoimainen pistevoitto',VSU1:'Ylivoimainen pistevoitto',VP:'Pistevoitto',VT:'Selätys',GS:'Ylivoimainen pistevoitto',FI:'Voitto vastustajan loukkaantumisen vuoksi',LOUK:'Voitto vastustajan loukkaantumisen vuoksi'};
  const words = value => String(value).normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('fi').match(/[\p{L}\p{N}]+/gu) || [];
  function distance(a,b) {
    const table=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
    for(let i=0;i<=a.length;i++)table[i][0]=i;
    for(let j=0;j<=b.length;j++)table[0][j]=j;
    for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++) {
      table[i][j]=Math.min(table[i-1][j]+1,table[i][j-1]+1,table[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
      if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])table[i][j]=Math.min(table[i][j],table[i-2][j-2]+1);
    }
    return table[a.length][b.length];
  }
  function matchesName(person,query) {
    const queryWords=words(query),nameWords=words(person.searchName);
    return queryWords.every(q=>nameWords.some(n=>n.startsWith(q)||q.length>=4&&distance(q,n)<=(q.length>=8?2:1)));
  }
  function matchesStrictly(person,query) {
    const queryWords=words(query),nameWords=words(person.searchName);
    // Other wrestlers remain selectable, but need an exact word or a clear prefix.
    return queryWords.length>0 && queryWords.every(q=>nameWords.some(n=>q===n || q.length>=3&&n.startsWith(q)));
  }
  function prepare(data,registry) {
    if(!registry || !data?.athleteRegistry)throw Error('Painijarekisteri puuttuu');
    const competitions=new Map(trial.competitions.map(c=>[c.key,c]));
    if(competitions.size!==trial.competitions.length)throw Error('Toistuva koekilpailu');
    const currentRows=new Map();
    for(const saved of trial.competitions) {
      const current=data.competitions.find(c=>c.source===saved.key);
      if(!current)throw Error('Koekilpailu puuttuu aineistosta');
      for(const row of current.rows)currentRows.set(row.resultId,{...row,competition:saved.key});
    }
    const records=new Map(data.athleteRegistry.athletes.map(a=>[a.id,a]));
    const people=new Map(),byResult=new Map();
    for(const saved of trial.participants) {
      const current=currentRows.get(saved.resultId);
      if(!current || current.competition!==saved.competition || current.category!==saved.category || current.weight!==saved.weight)throw Error('Kokeen tulosrivi muuttui');
      const id=registry.resolve(data,current.athleteId);
      if(!id || registry.resolve(data,saved.athleteId)!==id)throw Error('Kokeen painijatunnus muuttui');
      const record=records.get(id);if(!record || record.mergedInto)throw Error('Painijatunnus puuttuu');
      if(!people.has(id))people.set(id,{id,name:record.name,clubs:new Set(),competitions:new Set(),searchName:record.name});
      const person=people.get(id);person.clubs.add(current.club);person.competitions.add(saved.competition);person.searchName+=' '+current.name;
      byResult.set(saved.resultId,person);
    }
    const ids=new Set();
    const matches=trial.matches.map(m=>{
      const red=byResult.get(m.red),blue=byResult.get(m.blue),winner=byResult.get(m.winner),competition=competitions.get(m.competition);
      if(!competition||!red||!blue||red.id===blue.id||![red,blue].includes(winner)||ids.has(m.id))throw Error('Ottelun painijat tai tunnukset eivät täsmää');
      if(currentRows.get(m.red).competition!==m.competition || currentRows.get(m.blue).competition!==m.competition)throw Error('Ottelun kilpailu ei täsmää');
      if(!labels[m.code] || m.points!==null && (!Array.isArray(m.points)||m.points.length!==2||!m.points.every(n=>Number.isInteger(n)&&n>=0)))throw Error('Ottelutulos ei kelpaa');
      const url=new URL(m.source);
      if(url.protocol!=='https:' || url.hostname!=='turniereklassisch.ringerdb.de' || url.username || url.password)throw Error('Lähdeosoite ei kelpaa');
      ids.add(m.id);return {...m,competition,red,blue,winner};
    });
    const excluded=trial.excluded.map(m=>({competition:m.competition,people:new Set(m.people.map(id=>byResult.get(id)?.id).filter(Boolean))}));
    return {competitions:[...competitions.values()].sort((a,b)=>b.year-a.year||a.details.localeCompare(b.details,'fi')),people:[...people.values()].sort((a,b)=>a.name.localeCompare(b.name,'fi')),matches,excluded};
  }
  async function init(data,registry) {
    if(initialized)return;
    trial=await loadTrial();
    if(!['bouts-competition','bouts-coverage-summary','bouts-coverage-list','bouts-checked-at'].every(id=>document.getElementById(id)))throw Error('Sivun versio ei vastaa ottelukokeilua');
    const prepared=prepare(data,registry);
    const $=s=>document.querySelector(s);
    const people=new Map(prepared.people.map(p=>[p.id,p]));
    let mode='single',a=null,b=null,scope='';
    const inScope=match=>!scope||match.competition.key===scope;
    const scopedPeople=()=>prepared.people.filter(p=>!scope||p.competitions.has(scope));
    function opponentCounts() {
      const counts=new Map();
      for(const match of prepared.matches.filter(inScope)) {
        const other=match.red.id===a?match.blue.id:match.blue.id===a?match.red.id:null;
        if(other)counts.set(other,(counts.get(other)||0)+1);
      }
      return counts;
    }
    function suggestions(letter,query) {
      const prioritize=letter==='b'&&mode==='pair'&&people.has(a);
      const counts=prioritize?opponentCounts():new Map();
      const exact=person=>words(person.name).join(' ')===words(query).join(' ');
      const candidates=scopedPeople().filter(person=>{
        if(!prioritize)return matchesName(person,query);
        if(person.id===a)return false;
        return counts.has(person.id)?matchesName(person,query):matchesStrictly(person,query);
      });
      if(prioritize)candidates.sort((left,right)=>{
        // A complete exact name remains easy to select even without recorded bouts.
        const tier=person=>exact(person)?0:counts.has(person.id)?1:2;
        return tier(left)-tier(right)||left.name.localeCompare(right.name,'fi');
      });
      return {candidates,counts,prioritize};
    }
    function picker(letter,changed) {
      const input=$('#bout-search-'+letter),list=$('#bout-options-'+letter),box=$('#bout-picker-'+letter);
      let options=[],active=-1;
      function close() {list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;}
      function highlight() {
        [...list.children].forEach((li,i)=>li.setAttribute('aria-selected',String(i===active)));
        if(active>=0) {input.setAttribute('aria-activedescendant',list.children[active].id);list.children[active].scrollIntoView?.({block:'nearest'});}
        else input.removeAttribute('aria-activedescendant');
      }
      function select(person) {input.value=person.name;close();changed(person.id);}
      function show() {
        const found=suggestions(letter,input.value);
        options=found.candidates;active=-1;list.replaceChildren();
        for(const person of options) {
          const li=document.createElement('li');li.id='bout-option-'+letter+'-'+person.id;li.setAttribute('role','option');li.setAttribute('aria-selected','false');
          const name=document.createElement('span');name.textContent=person.name;
          const club=document.createElement('small');club.textContent=[...person.clubs].join(', ');li.append(name,club);
          if(found.prioritize) {
            const history=document.createElement('small'),count=found.counts.get(person.id)||0;
            history.className=count?'bout-opponent-note':'bout-no-history';
            history.textContent=count?'Aiempi vastustaja · '+count+' ottelua tässä aineistossa':'Ei keskinäisiä otteluita tässä aineistossa';
            li.append(history);
          }
          li.addEventListener('mousedown',event=>event.preventDefault());
          li.addEventListener('click',()=>select(person));list.append(li);
        }
        list.hidden=options.length===0;input.setAttribute('aria-expanded',String(options.length>0));
        input.removeAttribute('aria-activedescendant');
        const knownCount=options.filter(p=>found.counts.has(p.id)).length;
        $('#bouts-suggestions-status').textContent=options.length
          ?found.prioritize?options.length+' ehdotusta, joista '+knownCount+' aiempia vastustajia tässä aineistossa.':options.length+' sopivaa painijaa.'
          :found.prioritize?'Nimellä ei löytynyt ehdotuksia. Muista painijoista kirjoita nimi tai vähintään kolme kirjainta nimen alusta.':'Nimellä ei löytynyt painijaa valituista kilpailuista.';
      }
      input.addEventListener('focus',show);
      input.addEventListener('input',()=>{changed(null);show();});
      input.addEventListener('keydown',event=>{
        if(event.key==='Escape'||event.key==='Tab'){close();return;}
        if(event.key==='ArrowDown'||event.key==='ArrowUp') {
          event.preventDefault();if(list.hidden)show();if(!options.length)return;
          active=event.key==='ArrowDown'?(active+1)%options.length:(active<=0?options.length-1:active-1);highlight();
        } else if(event.key==='Enter'&&!list.hidden&&options.length) {event.preventDefault();select(options[active>=0?active:0]);}
      });
      document.addEventListener('click',event=>{if(!box.contains(event.target))close();});
      return {set(person){input.value=person?.name || '';close();},close};
    }
    const pa=picker('a',id=>{a=id;pb.close();render();}),pb=picker('b',id=>{b=id;render();});
    function setMode(next) {
      mode=next;pa.close();pb.close();
      document.querySelectorAll('input[name=bouts-mode]').forEach(input=>input.checked=input.value===mode);
      $('#bout-picker-b').hidden=mode!=='pair';$('#bouts-swap').hidden=mode!=='pair';
      const help=$('#bouts-opponent-help');if(help)help.hidden=mode!=='pair';render();
    }
    function statistic(label,value) {
      const box=document.createElement('div');box.className='bout-stat';
      const name=document.createElement('span');name.textContent=label;
      const number=document.createElement('strong');number.textContent=String(value);box.append(name,number);return box;
    }
    function render() {
      const person=people.get(a),opponent=people.get(b),pair=mode==='pair';
      const title=$('#bouts-result-title'),notice=$('#bouts-result-status'),stats=$('#bouts-statistics'),tbody=$('#bouts-results'),table=$('#bouts-table-wrap'),omitted=$('#bouts-omitted');
      tbody.replaceChildren();stats.replaceChildren();stats.hidden=true;table.hidden=true;omitted.hidden=true;
      $('#bouts-swap').disabled=!person||!opponent||a===b;
      if(!person) {title.textContent='Valitse painija';notice.textContent='Valitse painija nähdäksesi mukana olevat ottelut.';return;}
      if(pair&&!opponent) {title.textContent=person.name;notice.textContent='Valitse myös vastustaja keskinäistä vertailua varten.';return;}
      if(pair&&a===b) {title.textContent='Valitse kaksi eri painijaa';notice.textContent='Painijaa ei voi verrata itseensä. Valitse toinen vastustaja.';return;}
      title.textContent=pair?person.name+' – '+opponent.name:person.name;
      const relevant=row=>[row.red.id,row.blue.id].includes(a)&&(!pair||[row.red.id,row.blue.id].includes(b));
      const date=competition=>{
        const m=competition.details.match(/(\d{1,2})[./](\d{1,2})[./](20\d{2})/);
        return m?Date.UTC(Number(m[3]),Number(m[2])-1,Number(m[1])):0;
      };
      const matches=prepared.matches.filter(m=>inScope(m)&&relevant(m)).sort((x,y)=>date(y.competition)-date(x.competition)||x.round.localeCompare(y.round,'fi',{numeric:true}));
      const missing=prepared.excluded.filter(m=>(!scope||m.competition===scope)&&m.people.has(a)&&(!pair||m.people.has(b))).length;
      if(missing) {omitted.hidden=false;omitted.textContent='Tästä valinnasta jäi pois '+missing+' ottelua lähderistiriidan, puuttuvan tunnistuksen tai tarkistettavan voittotavan vuoksi. Ne eivät sisälly alla oleviin lukuihin.';}
      notice.textContent=matches.length?matches.length+' ottelua valituissa kilpailuissa. Voitot ja tappiot koskevat vain alla näkyviä otteluita.':pair?'Valinnalla ei löytynyt aineistoon mukaan otettuja otteluita. Tämä ei tarkoita, etteivät painijat olisi koskaan kohdanneet.':'Tälle painijalle ei löytynyt mukaan otettuja otteluita valituista kilpailuista. Muiden kilpailujen ottelut eivät vielä ole mukana.';
      const wins=matches.filter(m=>m.winner.id===a).length;
      stats.append(statistic('Otteluita',matches.length),statistic(pair?person.name+' · voitot':'Voittoja',wins),statistic(pair?opponent.name+' · voitot':'Tappioita',matches.length-wins));stats.hidden=false;
      for(const match of matches) {
        const ownRed=match.red.id===a,other=ownRed?match.blue:match.red;
        const points=match.points?(ownRed?match.points:[match.points[1],match.points[0]]):null;
        const row=document.createElement('tr');row.dataset.boutId=match.id;
        const values=[match.competition.title+' · '+match.competition.details,match.round+' · '+match.category+' '+match.weight+' kg',person.name,other.name,match.winner.id===a?'Voitto':'Tappio',labels[match.code],points?points.join('–'):'Pisteitä ei ilmoitettu'];
        values.forEach((value,index)=>{
          const cell=document.createElement('td');cell.textContent=value;
          if(index===4) {const badge=document.createElement('span');badge.className=match.winner.id===a?'bout-win':'bout-loss';badge.textContent=value;cell.replaceChildren(badge);}
          row.append(cell);
        });
        const source=document.createElement('td'),link=document.createElement('a');link.href=match.source;link.textContent='Ottelulista ↗';link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label','Avaa lähde: '+person.name+' ja '+other.name+', '+match.round);source.append(link);row.append(source);
        const headers=$('#bouts-results').closest('table').querySelectorAll('thead th');
        [...row.cells].forEach((cell,i)=>cell.dataset.label=headers[i].textContent);
        tbody.append(row);
      }
      table.hidden=matches.length===0;
    }
    const selectCompetition=$('#bouts-competition');
    selectCompetition.replaceChildren();
    const all=document.createElement('option');all.value='';all.textContent='Kaikki mukana olevat kilpailut';selectCompetition.append(all);
    for(const competition of prepared.competitions) {
      const option=document.createElement('option');option.value=competition.key;option.textContent=competition.title+' · '+competition.details;selectCompetition.append(option);
    }
    selectCompetition.addEventListener('change',()=>{scope=selectCompetition.value;pa.close();pb.close();$('#bouts-suggestions-status').textContent='Kilpailurajaus päivitetty.';render();});
    $('#bouts-coverage-summary').textContent=prepared.competitions.length+' kilpailua vuosilta '+Math.min(...prepared.competitions.map(c=>c.year))+'–'+Math.max(...prepared.competitions.map(c=>c.year))+'. Mukana '+prepared.matches.length+' ottelua ja '+prepared.people.length+' painijaa. Tämä ei vielä ole painijoiden koko otteluhistoria.';
    const coverage=$('#bouts-coverage-list');coverage.replaceChildren();
    for(const competition of prepared.competitions) {
      const li=document.createElement('li');li.textContent=(competition.checkedAt?'Tarkistettu '+new Intl.DateTimeFormat('fi-FI',{dateStyle:'short',timeZone:'Europe/Helsinki'}).format(new Date(competition.checkedAt))+' · ':'')+competition.title+' · '+competition.details+' — mukana '+competition.stats.accepted+' ottelua, pois jäi '+competition.stats.excluded+' ottelua. Vain toisessa luettelossa '+competition.stats.unmatchedNumbered+', muita lähdehuomioita '+competition.stats.unreadable+'.';coverage.append(li);
    }
    const search=trial.searchSummary;
    if($('#bouts-report-link'))$('#bouts-report-link').hidden=!search;
    if(search && $('#bouts-search-summary'))$('#bouts-search-summary').textContent='Viimeisin haku: '+search.attempted+' kilpailua tarkistettavana, '+search.updated+' päivitetty, '+search.preserved+' säilytetty aiemmasta aineistosta, '+search.failed+' ilman vahvistettuja otteluita. Kaikkien kilpailujen tietoja ei ole välttämättä saatavilla.';
    $('#bouts-checked-at').textContent='Viimeisin otteluhaku '+new Intl.DateTimeFormat('fi-FI',{dateStyle:'short',timeZone:'Europe/Helsinki'}).format(new Date(trial.checkedAt))+'.';
    document.querySelectorAll('input[name=bouts-mode]').forEach(input=>input.addEventListener('change',()=>{if(input.checked)setMode(input.value);}));
    $('#bouts-swap').addEventListener('click',()=>{[a,b]=[b,a];pa.set(people.get(a));pb.set(people.get(b));$('#bouts-suggestions-status').textContent='Painijat vaihdettu keskenään.';render();});
    $('#bouts-clear').addEventListener('click',()=>{a=null;b=null;pa.set(null);pb.set(null);$('#bouts-suggestions-status').textContent='Valinnat tyhjennetty.';render();$('#bout-search-a').focus();});
    $('#bouts-example').addEventListener('click',()=>{
      // Use original result IDs, so a later canonical name change cannot select another person.
      const example=trial.matches.find(m=>m.red==='tulos-000502'&&m.blue==='tulos-000503');
      const match=example&&prepared.matches.find(m=>m.id===example.id);
      if(!match)return;
      scope=match.competition.key;$('#bouts-competition').value=scope;
      a=match.red.id;b=match.blue.id;pa.set(people.get(a));pb.set(people.get(b));setMode('pair');$('#bouts-suggestions-status').textContent='Esimerkkipari valittu.';
    });
    initialized=true;$('#bouts-load-status').hidden=true;$('#bouts-retry').hidden=true;$('#bouts-app').hidden=false;render();
  }
  window.PAINI_BOUTS=Object.freeze({init});
})();
