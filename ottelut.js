"use strict";
(() => {
  let initialized = false,trial=null,dataPromise=null;
  let readState=()=>null,restoreState=()=>{};
  const dataBase=new URL('.',document.currentScript?.src || location.href);
  function unpack(value) {
    if(value?.version!==3 || !['competitions','participants','matches','excluded'].every(k=>Array.isArray(value[k])))throw Error('Otteluaineiston muoto ei kelpaa');
    const competitions=value.competitions;
    const key=i=>{if(!Number.isInteger(i)||!competitions[i])throw Error('Kilpailuviittaus puuttuu');return competitions[i].key;};
    const participants=value.participants.map(p=>({resultId:p[0],athleteId:p[1],competition:key(p[2]),category:p[3],weight:p[4]}));
    const person=i=>{if(!Number.isInteger(i)||!participants[i])throw Error('Painijaviittaus puuttuu');return participants[i].resultId;};
    const matches=value.matches.map(m=>({id:m[0],competition:key(m[1]),category:m[2],weight:m[3],round:m[4],red:person(m[5]),blue:person(m[6]),winner:person(m[7]),code:m[8],points:m[9],source:new URL(m[10],competitions[m[1]].key).href}));
    const excluded=value.excluded.map(e=>({competition:key(e[0]),people:e[1].map(person)}));
    return {version:2,checkedAt:value.checkedAt,competitions,participants,matches,excluded,searchSummary:value.searchSummary,coverageMissing:value.coverageMissing};
  }
  function loadTrial() {
    if(dataPromise)return dataPromise;
    dataPromise=(async()=>{
      const manifestResponse=await fetch(new URL('ottelut-manifest.json',dataBase),{cache:'no-cache'});
      if(!manifestResponse.ok)throw Error('Otteluaineiston versiotieto ei latautunut');
      const manifest=await manifestResponse.json();
      if(manifest.version!==1 || manifest.file!=='ottelut-public.json' || !/^[a-f0-9]{64}$/.test(manifest.revision))throw Error('Otteluaineiston versiotieto ei kelpaa');
      const url=new URL(manifest.file,dataBase);url.searchParams.set('v',manifest.revision);
      const response=await fetch(url);
      if(!response.ok)throw Error('Otteluaineisto ei latautunut');
      const value=await response.json();
      if(value.checkedAt!==manifest.checkedAt)throw Error('Otteluaineiston versiot eivät täsmää. Yritä uudelleen julkaisun valmistuttua.');
      return unpack(value);
    })().catch(error=>{dataPromise=null;throw error;});
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
  function matchesName(person,queryWords) {
    const nameWords=person.nameWords;
    return queryWords.every(q=>nameWords.some(n=>n.startsWith(q)||q.length>=4&&distance(q,n)<=(q.length>=8?2:1)));
  }
  function matchesStrictly(person,queryWords) {
    const nameWords=person.nameWords;
    // Other wrestlers remain selectable, but need an exact word or a clear prefix.
    return queryWords.length>0 && queryWords.every(q=>nameWords.some(n=>q===n || q.length>=3&&n.startsWith(q)));
  }
  function prepare(data,registry) {
    if(!registry || !data?.athleteRegistry)throw Error('Painijarekisteri puuttuu');
    const competitions=new Map(trial.competitions.map(c=>[c.key,c]));
    if(competitions.size!==trial.competitions.length)throw Error('Toistuva koekilpailu');
    const currentRows=new Map(),currentCompetitions=new Map(data.competitions.map(c=>[c.source,c]));
    for(const saved of trial.competitions) {
      const current=currentCompetitions.get(saved.key);
      if(!current)throw Error('Koekilpailu puuttuu aineistosta');
      for(const row of current.rows)currentRows.set(row.resultId,{...row,competition:saved.key});
    }
    const records=new Map(data.athleteRegistry.athletes.map(a=>[a.id,a]));
    const resolved=new Map();
    function resolve(id) {
      if(resolved.has(id))return resolved.get(id);
      const visited=new Set();let person=records.get(id);
      while(person?.mergedInto) {
        if(visited.has(person.id))throw Error('Painijatunnuksissa on yhdistämissilmukka');
        visited.add(person.id);person=records.get(person.mergedInto);
      }
      const result=person?.id || null;resolved.set(id,result);
      for(const alias of visited)resolved.set(alias,result);
      return result;
    }
    const people=new Map(),byResult=new Map();
    for(const saved of trial.participants) {
      const current=currentRows.get(saved.resultId);
      if(!current || current.competition!==saved.competition || current.category!==saved.category || current.weight!==saved.weight)throw Error('Kokeen tulosrivi muuttui');
      const id=resolve(current.athleteId);
      if(!id || !records.has(saved.athleteId))throw Error('Kokeen painijatunnus muuttui');
      const record=records.get(id);if(!record || record.mergedInto)throw Error('Painijatunnus puuttuu');
      if(!people.has(id))people.set(id,{id,name:record.name,clubs:new Set(),competitions:new Set(),searchNames:new Set([record.name])});
      const person=people.get(id);person.clubs.add(current.club);person.competitions.add(saved.competition);person.searchNames.add(current.name);
      byResult.set(saved.resultId,person);
    }
    for(const person of people.values()){person.nameWords=[...new Set([...person.searchNames].flatMap(words))];person.exactName=words(person.name).join(' ');delete person.searchNames;}
    const ids=new Set();
    const matches=trial.matches.map(m=>{
      const red=byResult.get(m.red),blue=byResult.get(m.blue),winner=byResult.get(m.winner),competition=competitions.get(m.competition);
      if(!competition||!red||!blue||m.red===m.blue||![red,blue].includes(winner)||ids.has(m.id))throw Error('Ottelun painijat tai tunnukset eivät täsmää');
      if(currentRows.get(m.red).competition!==m.competition || currentRows.get(m.blue).competition!==m.competition)throw Error('Ottelun kilpailu ei täsmää');
      if(!labels[m.code] || m.points!==null && (!Array.isArray(m.points)||m.points.length!==2||!m.points.every(n=>Number.isInteger(n)&&n>=0)))throw Error('Ottelutulos ei kelpaa');
      const url=new URL(m.source);
      if(url.protocol!=='https:' || url.hostname!=='turniereklassisch.ringerdb.de' || url.username || url.password)throw Error('Lähdeosoite ei kelpaa');
      ids.add(m.id);return {...m,competition,red,blue,winner,identityConflict:red.id===blue.id};
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
    const byPerson=new Map(),excludedByPerson=new Map();
    const add=(index,id,row)=>{if(!index.has(id))index.set(id,[]);index.get(id).push(row);};
    for(const match of prepared.matches){add(byPerson,match.red.id,match);if(match.blue.id!==match.red.id)add(byPerson,match.blue.id,match);}
    for(const row of prepared.excluded)for(const id of row.people)add(excludedByPerson,id,row);
    const collator=new Intl.Collator('fi',{numeric:true});
    const date=competition=>{const m=competition.details.match(/(\d{1,2})[./](\d{1,2})[./](20\d{2})/);return m?Date.UTC(Number(m[3]),Number(m[2])-1,Number(m[1])):0;};
    for(const competition of prepared.competitions)competition.sortDate=date(competition);
    let mode='single',a=null,b=null,scope='';
    const inScope=match=>!scope||match.competition.key===scope;
    const scopedPeople=()=>prepared.people.filter(p=>!scope||p.competitions.has(scope));
    function opponentCounts() {
      const counts=new Map();
      for(const match of (byPerson.get(a)||[]).filter(inScope)) {
        const other=match.red.id===a?match.blue.id:match.blue.id===a?match.red.id:null;
        if(other&&other!==a)counts.set(other,(counts.get(other)||0)+1);
      }
      return counts;
    }
    function suggestions(letter,query) {
      const prioritize=letter==='b'&&mode==='pair'&&people.has(a);
      const counts=prioritize?opponentCounts():new Map();
      const queryWords=words(query),exactQuery=queryWords.join(' ');
      const exact=person=>person.exactName===exactQuery;
      const candidates=scopedPeople().filter(person=>{
        if(!prioritize)return matchesName(person,queryWords);
        if(person.id===a)return false;
        return counts.has(person.id)?matchesName(person,queryWords):matchesStrictly(person,queryWords);
      });
      if(!prioritize&&queryWords.length)candidates.sort((left,right)=>Number(exact(right))-Number(exact(left)));
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
        options=found.candidates.slice(0,30);active=-1;list.replaceChildren();
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
        $('#bouts-suggestions-status').textContent=found.candidates.length>options.length ? 'Näytetään '+options.length+' / '+found.candidates.length+' ehdotusta. Tarkenna nimeä nähdäksesi muut.' : options.length
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
    const headers=[...$('#bouts-results').closest('table').querySelectorAll('thead th')].map(th=>th.textContent);
    const dateFormatter=new Intl.DateTimeFormat('fi-FI',{dateStyle:'short',timeZone:'Europe/Helsinki'});
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
      const matches=(byPerson.get(a)||[]).filter(m=>inScope(m)&&relevant(m)).sort((x,y)=>y.competition.sortDate-x.competition.sortDate||collator.compare(x.round,y.round));
      const missing=(excludedByPerson.get(a)||[]).filter(m=>(!scope||m.competition===scope)&&m.people.has(a)&&(!pair||m.people.has(b))).length;
      if(missing) {omitted.hidden=false;omitted.textContent='Tästä valinnasta jäi pois '+missing+' ottelua lähderistiriidan, puuttuvan tunnistuksen tai tarkistettavan voittotavan vuoksi. Ne eivät sisälly alla oleviin lukuihin.';}
      notice.textContent=matches.length?matches.length+' ottelua valituissa kilpailuissa. Voitot ja tappiot koskevat vain alla näkyviä otteluita.':pair?'Valinnalla ei löytynyt aineistoon mukaan otettuja otteluita. Tämä ei tarkoita, etteivät painijat olisi koskaan kohdanneet.':'Tälle painijalle ei löytynyt mukaan otettuja otteluita valituista kilpailuista. Muiden kilpailujen ottelut eivät vielä ole mukana.';
      const conflicts=matches.filter(m=>m.identityConflict).length;
      if(conflicts)notice.textContent+=' '+conflicts+' ottelussa molemmat samannimiset osallistujat ovat samassa profiilissa. Nämä ottelut odottavat henkilöiden erottamista eikä niitä lasketa voittoihin tai tappioihin.';
      const wins=matches.filter(m=>!m.identityConflict&&m.winner.id===a).length;
      stats.append(statistic('Otteluita',matches.length),statistic(pair?person.name+' · voitot':'Voittoja',wins),statistic(pair?opponent.name+' · voitot':'Tappioita',matches.length-wins-conflicts));if(conflicts)stats.append(statistic("Erota henkilöt",conflicts));stats.hidden=false;
      for(const match of matches) {
        const ownRed=match.red.id===a,other=ownRed?match.blue:match.red;
        const points=match.points?(ownRed?match.points:[match.points[1],match.points[0]]):null;
        const row=document.createElement('tr');row.dataset.boutId=match.id;
        const values=[match.competition.title+' · '+match.competition.details,match.round+' · '+match.category+' '+match.weight+' kg',person.name,other.name,match.identityConflict?'Erota samannimiset':match.winner.id===a?'Voitto':'Tappio',labels[match.code],points?points.join('–'):'Pisteitä ei ilmoitettu'];
        values.forEach((value,index)=>{
          const cell=document.createElement('td');cell.textContent=value;if(index<4)cell.translate='no';
          if(index===4) {const badge=document.createElement('span');badge.className=match.identityConflict?'':match.winner.id===a?'bout-win':'bout-loss';badge.textContent=value;cell.replaceChildren(badge);}
          row.append(cell);
        });
        const source=document.createElement('td'),link=document.createElement('a');link.href=match.source;link.textContent='Ottelulista ↗';link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label','Avaa lähde: '+person.name+' ja '+other.name+', '+match.round);source.append(link);row.append(source);
        [...row.cells].forEach((cell,i)=>cell.dataset.label=headers[i]);
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
    $('#bouts-coverage-summary').textContent=prepared.competitions.length+' kilpailua vuosilta '+Math.min(...prepared.competitions.map(c=>c.year))+'–'+Math.max(...prepared.competitions.map(c=>c.year))+'. Mukana '+prepared.matches.length.toLocaleString('fi-FI')+' ottelua ja '+prepared.people.length+' painijaa. Tämä ei vielä ole painijoiden koko otteluhistoria.';
    const coverage=$('#bouts-coverage-list');coverage.replaceChildren();
    for(const competition of prepared.competitions) {
      const li=document.createElement('li');li.textContent=(competition.checkedAt?'Tarkistettu '+dateFormatter.format(new Date(competition.checkedAt))+' · ':'')+competition.title+' · '+competition.details+' — mukana '+competition.stats.accepted+' ottelua, pois jäi '+competition.stats.excluded+' ottelua. Vain toisessa luettelossa '+competition.stats.unmatchedNumbered+', muita lähdehuomioita '+competition.stats.unreadable+'.';coverage.append(li);
    }
    if(Array.isArray(trial.coverageMissing)){
      const box=document.createElement('details'),heading=document.createElement('summary');
      heading.textContent='Koko aineiston kilpailut ilman vahvistettuja otteluita ('+trial.coverageMissing.length+')';box.append(heading);
      const note=document.createElement('p');note.textContent='Tämä luettelo koskee kaikkia vuosia 2022–2026. Viimeisimmän haun yhteenveto voi koskea vain yhtä vuotta. Mukana olevista kilpailuistakin voi puuttua yksittäisiä otteluita.';box.append(note);
      const list=document.createElement('ul');
      for(const missing of trial.coverageMissing){const li=document.createElement('li');li.textContent=missing.title+' · '+missing.details+' — '+missing.reason;
        const url=new URL(missing.source);if(url.protocol==='https:'&&url.hostname==='turniereklassisch.ringerdb.de'&&!url.username&&!url.password){const link=document.createElement('a');link.href=url.href;link.textContent=' Avaa lähde ↗';link.target='_blank';link.rel='noopener noreferrer';li.append(link);}list.append(li);}
      box.append(list);$('#bouts-coverage-summary').after(box);
    }
    const search=trial.searchSummary;
    if($('#bouts-report-link'))$('#bouts-report-link').hidden=!search;
    if(search && $('#bouts-search-summary'))$('#bouts-search-summary').textContent='Viimeisin haku: '+search.attempted+' kilpailua käsitelty, '+search.updated+' päivitetty, '+search.preserved+' säilytetty aiemmasta aineistosta, '+search.failed+' ilman vahvistettuja otteluita. Kaikkien kilpailujen tietoja ei ole välttämättä saatavilla.';
    $('#bouts-checked-at').textContent='Viimeisin otteluhaku '+dateFormatter.format(new Date(trial.checkedAt))+'.';
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
    readState=()=>({mode,a,b,scope,queryA:$('#bout-search-a').value,queryB:$('#bout-search-b').value});
    restoreState=state=>{
      if (!state || typeof state !== 'object') return;
      const resolve=id=>typeof id==='string'?registry.resolve(data,id):null;
      a=resolve(state.a);b=resolve(state.b);
      if(!people.has(a))a=null;if(!people.has(b))b=null;
      scope=prepared.competitions.some(c=>c.key===state.scope)?state.scope:'';
      selectCompetition.value=scope;pa.set(people.get(a));pb.set(people.get(b));
      if(!state.a&&typeof state.queryA==='string')$('#bout-search-a').value=state.queryA;
      if(!state.b&&typeof state.queryB==='string')$('#bout-search-b').value=state.queryB;
      setMode(state.mode==='pair'?'pair':'single');
      const missing=(state.a&&!a)||(state.b&&!b);
      if(missing)$('#bouts-suggestions-status').textContent='Aiemmin valittua painijaa ei löydy päivitetystä otteluaineistosta. Valitse painija uudelleen.';
      else if(state.scope&&!scope)$('#bouts-suggestions-status').textContent='Aiempi kilpailurajaus ei ole saatavilla. Näytetään kaikki mukana olevat kilpailut.';
    };
    initialized=true;$('#bouts-load-status').hidden=true;$('#bouts-retry').hidden=true;$('#bouts-app').hidden=false;render();
  }
  window.PAINI_BOUTS=Object.freeze({init,getState:()=>readState(),restore:state=>restoreState(state)});
})();
