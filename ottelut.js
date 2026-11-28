"use strict";
(() => {
  let initialized = false,trial=null,dataPromise=null,lastExamplePair=null;
  let readState=()=>null,restoreState=()=>{},template=null;
  const dataBase=typeof document==='undefined'?null:new URL('.',document.currentScript?.src || location.href);
  function randomExample(matches,previous=null,random=Math.random){
    const pairs=new Map();for(const match of matches){const ids=[match.red.id,match.blue.id].sort();if(!ids[0]||!ids[1]||ids[0]===ids[1])continue;const key=JSON.stringify(ids);if(!pairs.has(key))pairs.set(key,{key,red:ids[0],blue:ids[1]});}
    const available=[...pairs.values()],choices=available.length>1?available.filter(pair=>pair.key!==previous):available;
    return choices.length?{...choices[Math.min(choices.length-1,Math.floor(random()*choices.length))],onlyPair:available.length===1}:null;
  }
  function unpack(value) {
    if(value?.version!==3 || !['competitions','participants','matches','excluded'].every(k=>Array.isArray(value[k])))throw Error('Otteluaineiston muoto ei kelpaa');
    const competitions=value.competitions;
    const key=i=>{if(!Number.isInteger(i)||!competitions[i])throw Error('Kilpailuviittaus puuttuu');return competitions[i].key;};
    const participants=value.participants.map(p=>({resultId:p[0],athleteId:p[1],competition:key(p[2]),category:p[3],weight:p[4]}));
    const person=i=>{if(!Number.isInteger(i)||!participants[i])throw Error('Painijaviittaus puuttuu');return participants[i].resultId;};
    // Each weight-class source is shared by many bouts. Resolve it only once.
    const sources=new Map();
    const source=(competition,file)=>{
      const cacheKey=competition+'|'+file;
      if(!sources.has(cacheKey))sources.set(cacheKey,new URL(file,key(competition)).href);
      return sources.get(cacheKey);
    };
    const matches=value.matches.map(m=>({id:m[0],competition:key(m[1]),category:m[2],weight:m[3],round:m[4],red:person(m[5]),blue:person(m[6]),winner:person(m[7]),code:m[8],points:m[9],source:source(m[1],m[10])}));
    const excluded=value.excluded.map(e=>({competition:key(e[0]),people:e[1].map(person)}));
    return {version:2,checkedAt:value.checkedAt,competitions,participants,matches,excluded,searchSummary:value.searchSummary,coverageMissing:value.coverageMissing};
  }
  function loadTrial() {
    if(dataPromise)return dataPromise;
    dataPromise=(async()=>{
      if(window.PAINI_DATA_ACCESS)return unpack(await window.PAINI_DATA_ACCESS.bouts());
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
    let previous=Array.from({length:b.length+1},(_,i)=>i),beforePrevious;
    for(let i=1;i<=a.length;i++) {
      const current=[i];
      for(let j=1;j<=b.length;j++) {
        current[j]=Math.min(previous[j]+1,current[j-1]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));
        if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])current[j]=Math.min(current[j],beforePrevious[j-2]+1);
      }
      beforePrevious=previous;previous=current;
    }
    return previous[b.length];
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
  // Search unique words once, then intersect their wrestler postings. Cached
  // token matches also make deleting and retyping a query inexpensive.
  function createSearch(people) {
    const postings=new Map(),lengths=new Map(),all=new Set(people.map(p=>p.id)),cache=new Map();
    for(const person of people)for(const word of person.nameWords){
      if(!postings.has(word)){
        postings.set(word,new Set());
        if(!lengths.has(word.length))lengths.set(word.length,[]);
        lengths.get(word.length).push(word);
      }
      postings.get(word).add(person.id);
    }
    function tokenMatches(token,strict) {
      const key=(strict?'strict:':'fuzzy:')+token;
      if(cache.has(key)){const found=cache.get(key);cache.delete(key);cache.set(key,found);return found;}
      const found=new Set(),matchedWords=new Set();
      for(const word of postings.keys())if(strict?(token.length>=3?word.startsWith(token):word===token):word.startsWith(token))matchedWords.add(word);
      if(!strict&&token.length>=4){
        const tolerance=token.length>=8?2:1;
        for(let length=token.length-tolerance;length<=token.length+tolerance;length++)for(const word of lengths.get(length)||[])
          if(!matchedWords.has(word)&&distance(token,word)<=tolerance)matchedWords.add(word);
      }
      for(const word of matchedWords)for(const id of postings.get(word))found.add(id);
      cache.set(key,found);if(cache.size>64)cache.delete(cache.keys().next().value);
      return found;
    }
    return {find(queryWords,strict=false){
      if(!queryWords.length)return strict?new Set():all;
      const sets=queryWords.map(token=>tokenMatches(token,strict)).sort((a,b)=>a.size-b.size);
      return new Set([...sets[0]].filter(id=>sets.every(set=>set.has(id))));
    }};
  }
  function boutOutcome(match,athleteId) {
    if(match.identityConflict||match.red.id===match.blue.id||![match.red.id,match.blue.id].includes(athleteId)||![match.red.id,match.blue.id].includes(match.winner?.id))return 'neutral';
    return match.winner.id===athleteId?'win':'loss';
  }
  function yearlyBouts(matches,athleteId) {
    const years=new Map();
    for(const match of matches){
      const year=Number.isInteger(match.competition.year)?String(match.competition.year):'Ei päivämäärää';
      if(!years.has(year))years.set(year,{year,win:0,loss:0,neutral:0,total:0});
      const row=years.get(year);row[boutOutcome(match,athleteId)]++;row.total++;
    }
    return [...years.values()].sort((a,b)=>/^\d{4}$/.test(a.year)?(/^\d{4}$/.test(b.year)?Number(a.year)-Number(b.year):-1):1);
  }
  function renderYearlyBouts(matches,athleteId) {
    const section=document.querySelector('#bouts-yearly');if(!section)return;
    section.hidden=!matches.length;
    const bars=section.querySelector('#bouts-yearly-bars'),body=section.querySelector('#bouts-yearly-rows');bars.replaceChildren();body.replaceChildren();
    const rows=yearlyBouts(matches,athleteId),max=Math.max(1,...rows.map(row=>row.total));
    for(const row of rows){
      const line=document.createElement('div');line.className='yearly-line';
      const label=document.createElement('span');label.textContent=row.year;
      const track=document.createElement('div');track.className='yearly-track';
      for(const outcome of ['win','loss','neutral']){
        const segment=document.createElement('span');segment.className='yearly-segment bout-year-'+outcome;segment.style.width=(row[outcome]/max*100)+'%';track.append(segment);
      }
      const total=document.createElement('strong');total.textContent=row.total;line.append(label,track,total);bars.append(line);
      const tr=document.createElement('tr');[row.year,row.win,row.loss,row.neutral,row.total].forEach((value,i)=>{const cell=document.createElement(i?'td':'th');if(!i)cell.scope='row';cell.textContent=value;tr.append(cell);});body.append(tr);
    }
  }
  function prepare(data,registry,bouts=trial) {
    if(!registry || !data?.athleteRegistry)throw Error('Painijarekisteri puuttuu');
    const competitions=new Map(bouts.competitions.map(c=>[c.key,c]));
    if(competitions.size!==bouts.competitions.length)throw Error('Toistuva koekilpailu');
    const currentRows=new Map(),currentCompetitions=new Map(data.competitions.map(c=>[c.source,c]));
    for(const saved of bouts.competitions) {
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
    for(const saved of bouts.participants) {
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
    const ids=new Set(),verifiedSources=new Set();
    const matches=bouts.matches.map(m=>{
      const red=byResult.get(m.red),blue=byResult.get(m.blue),winner=byResult.get(m.winner),competition=competitions.get(m.competition);
      if(!competition||!red||!blue||m.red===m.blue||![red,blue].includes(winner)||ids.has(m.id))throw Error('Ottelun painijat tai tunnukset eivät täsmää');
      if(currentRows.get(m.red).competition!==m.competition || currentRows.get(m.blue).competition!==m.competition)throw Error('Ottelun kilpailu ei täsmää');
      if(!labels[m.code] || m.points!==null && (!Array.isArray(m.points)||m.points.length!==2||!m.points.every(n=>Number.isInteger(n)&&n>=0)))throw Error('Ottelutulos ei kelpaa');
      if(!verifiedSources.has(m.source)){
        const url=new URL(m.source);
        if(url.protocol!=='https:' || url.hostname!=='turniereklassisch.ringerdb.de' || url.username || url.password)throw Error('Lähdeosoite ei kelpaa');
        verifiedSources.add(m.source);
      }
      ids.add(m.id);return {...m,competition,red,blue,winner,identityConflict:red.id===blue.id};
    });
    const excluded=bouts.excluded.map(m=>({competition:m.competition,people:new Set(m.people.map(id=>byResult.get(id)?.id).filter(Boolean))}));
    return {competitions:[...competitions.values()].sort((a,b)=>b.year-a.year||a.details.localeCompare(b.details,'fi')),people:[...people.values()].sort((a,b)=>a.name.localeCompare(b.name,'fi')),matches,excluded};
  }
  let pickerController=null;
  async function init(data,registry) {
    if(initialized)return;
    if(!template)template=document.getElementById("bouts-view").cloneNode(true);
    pickerController?.abort();pickerController=new AbortController();
    trial=await loadTrial();
    if(!['bouts-competition','bouts-results'].every(id=>document.getElementById(id)))throw Error('Sivun versio ei vastaa ottelukokeilua');
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
    for(const matches of byPerson.values())matches.sort((x,y)=>y.competition.sortDate-x.competition.sortDate||collator.compare(x.round,y.round));
    const searchIndex=createSearch(prepared.people),scopeCache=new Map();
    let mode='single',a=null,b=null,scope='',opponentKey=null,opponentCache;
    let resultPage=0,currentMatches=[],renderCurrentPage=()=>{};
    // An older cached HTML page has no paging controls: keep all bouts reachable.
    const pageSize=document.querySelector('.bouts-pagination')?50:Number.MAX_SAFE_INTEGER;
    const chosenYear=()=>$('#bouts-year')?.value||'';
    const inScope=match=>(!scope||match.competition.key===scope)&&(!chosenYear()||String(match.competition.year)===chosenYear());
    const scopedPeople=()=>{const key=scope+'|'+chosenYear();if(!scopeCache.has(key))scopeCache.set(key,prepared.people.filter(p=>(!scope||p.competitions.has(scope))&&(!chosenYear()||(byPerson.get(p.id)||[]).some(inScope))));return scopeCache.get(key);};
    function opponentCounts() {
      const key=a+'|'+scope+'|'+chosenYear();if(key===opponentKey)return opponentCache;
      const counts=new Map();
      for(const match of (byPerson.get(a)||[]).filter(inScope)) {
        const other=match.red.id===a?match.blue.id:match.blue.id===a?match.red.id:null;
        if(other&&other!==a)counts.set(other,(counts.get(other)||0)+1);
      }
      opponentKey=key;opponentCache=counts;return counts;
    }
    function suggestions(letter,query) {
      const prioritize=letter==='b'&&mode==='pair'&&people.has(a);
      const counts=prioritize?opponentCounts():new Map();
      const queryWords=words(query),exactQuery=queryWords.join(' ');
      const exact=person=>person.exactName===exactQuery;
      const matching=searchIndex.find(queryWords),strict=prioritize?searchIndex.find(queryWords,true):null;
      const candidates=scopedPeople().filter(person=>{
        if(!prioritize)return matching.has(person.id);
        if(person.id===a)return false;
        return counts.has(person.id)?matching.has(person.id):strict.has(person.id);
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
      document.addEventListener('click',event=>{if(!box.contains(event.target))close();},{signal:pickerController.signal});
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
    function render() {
      const person=people.get(a),opponent=people.get(b),pair=mode==='pair';
      const title=$('#bouts-result-title'),notice=$('#bouts-result-status'),stats=$('#bouts-statistics'),tbody=$('#bouts-results'),table=$('#bouts-table-wrap'),omitted=$('#bouts-omitted');
      tbody.replaceChildren();stats.replaceChildren();stats.hidden=true;table.hidden=true;omitted.hidden=true;
      renderYearlyBouts([],a);
      resultPage=0;currentMatches=[];document.querySelectorAll('.bouts-pagination').forEach(nav=>nav.hidden=true);
      $('#bouts-swap').disabled=!person||!opponent||a===b;
      if(!person) {title.textContent='Valitse painija';notice.textContent='Valitse painija nähdäksesi mukana olevat ottelut.';return;}
      if(pair&&!opponent) {title.textContent=person.name;notice.textContent='Valitse myös vastustaja keskinäistä vertailua varten.';return;}
      if(pair&&a===b) {title.textContent='Valitse kaksi eri painijaa';notice.textContent='Painijaa ei voi verrata itseensä. Valitse toinen vastustaja.';return;}
      title.textContent=pair?person.name+' – '+opponent.name:person.name;
      const relevant=row=>[row.red.id,row.blue.id].includes(a)&&(!pair||[row.red.id,row.blue.id].includes(b));
      const matches=(byPerson.get(a)||[]).filter(m=>inScope(m)&&relevant(m));
      const missing=(excludedByPerson.get(a)||[]).filter(m=>(!scope||m.competition===scope)&&m.people.has(a)&&(!pair||m.people.has(b))).length;
      if(missing) {omitted.hidden=false;omitted.textContent='Tästä valinnasta jäi pois '+missing+' ottelua lähderistiriidan, puuttuvan tunnistuksen tai tarkistettavan voittotavan vuoksi. Ne eivät sisälly alla oleviin lukuihin.';}
      notice.textContent=matches.length?matches.length+' ottelua valituissa kilpailuissa. Voitot ja tappiot koskevat kaikkia hakuehtoja vastaavia otteluita.':pair?'Valinnalla ei löytynyt aineistoon mukaan otettuja otteluita. Tämä ei tarkoita, etteivät painijat olisi koskaan kohdanneet.':'Tälle painijalle ei löytynyt mukaan otettuja otteluita valituista kilpailuista. Muiden kilpailujen ottelut eivät vielä ole mukana.';
      const conflicts=matches.filter(m=>m.identityConflict).length;
      if(conflicts)notice.textContent+=' '+conflicts+' ottelussa molemmat samannimiset osallistujat ovat samassa profiilissa. Nämä ottelut odottavat henkilöiden erottamista eikä niitä lasketa voittoihin tai tappioihin.';
      const wins=matches.filter(m=>!m.identityConflict&&m.winner.id===a).length;
      stats.append(statistic('Otteluita',matches.length),statistic(pair?person.name+' · voitot':'Voittoja',wins),statistic(pair?opponent.name+' · voitot':'Tappioita',matches.length-wins-conflicts));if(conflicts)stats.append(statistic("Erota henkilöt",conflicts));stats.hidden=false;
      renderYearlyBouts(matches,a);
      currentMatches=matches;
      renderCurrentPage=()=>{
        tbody.replaceChildren();
        const first=resultPage*pageSize;
        const fragment=document.createDocumentFragment();
        for(const match of currentMatches.slice(first,first+pageSize)) {
          const ownRed=match.red.id===a,other=ownRed?match.blue:match.red;
          const points=match.points?(ownRed?match.points:[match.points[1],match.points[0]]):null;
          const row=document.createElement('tr');row.dataset.boutId=match.id;row.dataset.outcome=boutOutcome(match,a);
          const values=[match.competition.title+' · '+match.competition.details,match.round+' · '+match.category+' '+match.weight+' kg',person.name,other.name,match.identityConflict?'Erota samannimiset':match.winner.id===a?'Voitto':'Tappio',labels[match.code],points?points.join('–'):'Pisteitä ei ilmoitettu'];
          values.forEach((value,index)=>{
            const cell=document.createElement('td');cell.textContent=value;if(index<4)cell.translate='no';
            if(index===4) {const badge=document.createElement('span');badge.className=match.identityConflict?'':match.winner.id===a?'bout-win':'bout-loss';badge.textContent=value;cell.replaceChildren(badge);}
            row.append(cell);
          });
          const source=document.createElement('td'),link=document.createElement('a');link.href=match.source;link.textContent='Ottelulista ↗';link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label','Avaa lähde: '+person.name+' ja '+other.name+', '+match.round);source.append(link);row.append(source);
          [...row.cells].forEach((cell,i)=>cell.dataset.label=headers[i]);
          fragment.append(row);
        }
        tbody.append(fragment);
        document.querySelectorAll('.bouts-pagination').forEach(nav=>nav.hidden=currentMatches.length<=pageSize);
        document.querySelectorAll('.bouts-prev').forEach(button=>button.disabled=resultPage===0);
        document.querySelectorAll('.bouts-next').forEach(button=>button.disabled=first+pageSize>=currentMatches.length);
        document.querySelectorAll('.bouts-page').forEach(label=>label.textContent='Sivu '+(resultPage+1)+' / '+Math.ceil(currentMatches.length/pageSize));
        table.hidden=currentMatches.length===0;
      };
      renderCurrentPage();
    }
    function turnPage(direction){
      const next=resultPage+direction;
      if(next<0||next*pageSize>=currentMatches.length)return;
      resultPage=next;renderCurrentPage();$('#bouts-result-title').focus();
    }
    document.querySelectorAll('.bouts-prev').forEach(button=>button.addEventListener('click',()=>turnPage(-1)));
    document.querySelectorAll('.bouts-next').forEach(button=>button.addEventListener('click',()=>turnPage(1)));
    const selectCompetition=$('#bouts-competition');
    selectCompetition.replaceChildren();
    const all=document.createElement('option');all.value='';all.textContent='Kaikki mukana olevat kilpailut';selectCompetition.append(all);
    for(const competition of prepared.competitions) {
      const option=document.createElement('option');option.value=competition.key;option.textContent=competition.title+' · '+competition.details;selectCompetition.append(option);
    }
    $('#bouts-year')?.addEventListener('change',()=>{pa.close();pb.close();render();});
    selectCompetition.addEventListener('change',()=>{scope=selectCompetition.value;pa.close();pb.close();$('#bouts-suggestions-status').textContent='Kilpailurajaus päivitetty.';render();});
    document.querySelectorAll('input[name=bouts-mode]').forEach(input=>input.addEventListener('change',()=>{if(input.checked)setMode(input.value);}));
    $('#bouts-swap').addEventListener('click',()=>{[a,b]=[b,a];pa.set(people.get(a));pb.set(people.get(b));$('#bouts-suggestions-status').textContent='Painijat vaihdettu keskenään.';render();});
    $('#bouts-clear').addEventListener('click',()=>{a=null;b=null;pa.set(null);pb.set(null);$('#bouts-suggestions-status').textContent='Valinnat tyhjennetty.';render();$('#bout-search-a').focus();});
    $('#bouts-example').addEventListener('click',()=>{
      const selected=randomExample(prepared.matches.filter(inScope),lastExamplePair);
      if(!selected){$('#bouts-suggestions-status').textContent='Näillä rajauksilla ei löydy vahvistettua keskinäistä ottelua. Kokeile muita rajauksia.';return;}
      lastExamplePair=selected.key;a=selected.red;b=selected.blue;pa.set(people.get(a));pb.set(people.get(b));setMode('pair');
      $('#bouts-suggestions-status').textContent=selected.onlyPair?'Rajauksissa on vain yksi keskenään otellut pari.':'Satunnainen keskenään otellut pari valittu.';
    });
    readState=()=>({mode,a,b,scope,year:chosenYear(),page:resultPage,queryA:$('#bout-search-a').value,queryB:$('#bout-search-b').value});
    restoreState=state=>{
      if (!state || typeof state !== 'object') return;
      const resolve=id=>typeof id==='string'?registry.resolve(data,id):null;
      a=resolve(state.a);b=resolve(state.b);
      if(!people.has(a))a=null;if(!people.has(b))b=null;
      scope=prepared.competitions.some(c=>c.key===state.scope)?state.scope:'';
      if($('#bouts-year'))$('#bouts-year').value=state.year||'';
      selectCompetition.value=scope;pa.set(people.get(a));pb.set(people.get(b));
      if(!state.a&&typeof state.queryA==='string')$('#bout-search-a').value=state.queryA;
      if(!state.b&&typeof state.queryB==='string')$('#bout-search-b').value=state.queryB;
      setMode(state.mode==='pair'?'pair':'single');
      if(Number.isSafeInteger(state.page)&&state.page>0&&currentMatches.length){resultPage=Math.min(state.page,Math.floor((currentMatches.length-1)/pageSize));renderCurrentPage();}
      const missing=(state.a&&!a)||(state.b&&!b);
      if(missing)$('#bouts-suggestions-status').textContent='Aiemmin valittua painijaa ei löydy päivitetystä otteluaineistosta. Valitse painija uudelleen.';
      else if(state.scope&&!scope)$('#bouts-suggestions-status').textContent='Aiempi kilpailurajaus ei ole saatavilla. Näytetään kaikki mukana olevat kilpailut.';
    };
    initialized=true;$('#bouts-load-status').hidden=true;$('#bouts-retry').hidden=true;$('#bouts-app').hidden=false;render();
  }
  if(typeof module==='object'&&module.exports){module.exports={randomExample,unpack,prepare,words,distance,matchesName,matchesStrictly,createSearch,boutOutcome,yearlyBouts};return;}
  window.PAINI_BOUTS=Object.freeze({isReady:()=>initialized,snapshot:()=>trial,validate:(data,registry,packed)=>prepare(data,registry,packed.version===2?packed:unpack(packed)),reset:packed=>{
    pickerController?.abort();pickerController=null;
    if(template)document.getElementById('bouts-view').replaceChildren(...template.cloneNode(true).childNodes);
    initialized=false;trial=null;dataPromise=packed?Promise.resolve(packed.version===2?packed:unpack(packed)):null;readState=()=>null;restoreState=()=>{};
  },init,getState:()=>readState(),restore:state=>restoreState(state)});
})();
