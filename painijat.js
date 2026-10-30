"use strict";
(() => {
  const $ = selector => document.querySelector(selector), R = window.PainiRegistry;
  let data, selectedId = "", pending = null, dirty = false;
  let duplicatePage = 0;
  let strongPage = 0;
  let kllPage = 0;
  const selectedPairs = new Map();
  const duplicatePageSize = 10;
  const say = (text, kind = "") => { $("#registry-status").textContent = text; $("#registry-status").dataset.kind = kind; };
  const people = () => data.athleteRegistry.athletes.filter(a => !a.mergedInto);
  const entries = id => index().get(id)?.results || [];
  // Registry operations return new data objects; caches belong to one snapshot.
  let indexedData = null, indexedRecords = null, groupedData = null, groupedRecords = null;
  let autoData = null, autoPlan = null;
  function nameClubPlan() {
    if (autoData !== data) { autoPlan = R.nameClubPlan(data); autoData = data; }
    return autoPlan;
  }
  function index() {
    if (indexedData === data) return indexedRecords;
    const allPeople = new Map(data.athleteRegistry.athletes.map(a => [a.id,a]));
    const resolved = new Map();
    const resolve = id => {
      const path = []; let current = id;
      while (!resolved.has(current) && allPeople.get(current)?.mergedInto) { path.push(current); current = allPeople.get(current).mergedInto; }
      current = resolved.get(current) || current; path.forEach(old => resolved.set(old,current)); resolved.set(id,current); return current;
    };
    const map = new Map(people().map(a => [a.id, { athlete:a, names:new Set([a.name]), matchNames:new Set([a.name]), clubs:new Set(), count:0, results:[] }]));
    data.athleteRegistry.athletes.filter(a => a.mergedInto).forEach(a => {
      const entry = map.get(resolve(a.id));
      if (entry) { entry.names.add(a.id); entry.names.add(a.name); entry.matchNames.add(a.name); }
    });
    data.competitions.forEach(item => item.rows.forEach(row => {
      const x = map.get(row.athleteId); x.names.add(row.name); x.matchNames.add(row.name); x.clubs.add(row.club); x.count++; x.results.push({item,row});
    })); indexedData = data; indexedRecords = map; return map;
  }
  let relationData = null, relationKeys = new Set();
  function knownDifferent(a,b) {
    if (relationData !== data) {
      relationKeys = new Set(R.differentPairs(data).map(pair=>JSON.stringify([...pair].sort())));
      relationData = data;
    }
    return relationKeys.has(JSON.stringify([a,b].sort()));
  }
  function duplicateGroups() {
    if (groupedData === data) return groupedRecords;
    const byName = new Map();
    [...index().values()].filter(x => x.count > 0).forEach(entry => {
      // Different spellings/accents are not guessed to be the same name.
      const ownKeys = new Set();
      entry.matchNames.forEach(name => {
        const key = R.norm(name);
        if (ownKeys.has(key)) return; ownKeys.add(key);
        if (!byName.has(key)) byName.set(key, {names:new Set(), records:new Map()});
        const group = byName.get(key); group.names.add(name); group.records.set(entry.athlete.id,entry);
      });
    });
    const byMembership = new Map();
    byName.forEach(group => {
      if (group.records.size < 2) return;
      const ids = [...group.records.keys()];
      if (!ids.some((id,i) => ids.slice(i+1).some(other => !knownDifferent(id,other)))) return;
      const key = [...group.records.keys()].sort().join("|");
      if (!byMembership.has(key)) byMembership.set(key,{names:new Set(),records:group.records});
      group.names.forEach(name => byMembership.get(key).names.add(name));
    });
    groupedRecords = [...byMembership.values()].map(group => ({
      names:[...group.names].sort((a,b)=>a.localeCompare(b,"fi")),
      records:[...group.records.values()].sort((a,b)=>a.athlete.id.localeCompare(b.athlete.id))
    })).sort((a,b)=>a.names[0].localeCompare(b.names[0],"fi"));
    groupedData = data; return groupedRecords;
  }
  function node(tag,text,className) {
    const el = document.createElement(tag); if (text !== undefined) el.textContent = text;
    if (className) el.className = className; return el;
  }
  function choosePerson(id) {
    cancel(); selectedId = id;
    $("#person-search").value = id; $("#only-unreviewed").checked = false;
    renderList(); renderEditor(); $("#editor-title").focus();
  }
  function startMerge(sourceId,targetId) {
    const records = index();
    if (!records.has(sourceId) || !records.has(targetId) || sourceId === targetId) return say("Valitse kaksi eri aktiivista tunnusta.","error");
    choosePerson(targetId);
    $("#target-search").value = sourceId; renderTargets(); $("#target-person").value = sourceId;
    preview("Siirretään kaikki " + records.get(sourceId).count + " tulosta merkinnältä ”" + label(records.get(sourceId)) + "” merkinnälle ”" + label(records.get(targetId)) + "”. Säilyvä tunnus: " + targetId + ". Yhdistämisen jälkeen merkintä on tarkistamaton. Hyväksy vain, jos tiedät merkintöjen tarkoittavan samaa henkilöä.", () => R.merge(data, sourceId, targetId), targetId);
  }
  function renderDuplicates() {
    renderDifferentPeople();
    const groups = duplicateGroups(), query = R.norm($("#duplicate-search").value);
    const found = groups.filter(group => R.norm([
      ...group.names,...group.records.flatMap(entry => [entry.athlete.id,...entry.names,...entry.clubs,
        ...entry.results.flatMap(({item}) => [item.title,item.details])])
    ].join(" ")).includes(query));
    const pages = Math.max(1,Math.ceil(found.length/duplicatePageSize)); duplicatePage = Math.min(duplicatePage,pages-1);
    const start = duplicatePage*duplicatePageSize, shown = found.slice(start,start+duplicatePageSize), parent = $("#duplicate-groups"); parent.replaceChildren();
    $("#duplicate-count").textContent = found.length ? found.length + " mahdollista nimiryhmää. Näytetään " + (start+1) + "–" + (start+shown.length) + "." : "Mahdollisia kaksoismerkintöjä ei löytynyt näillä hakuehdoilla.";
    $("#duplicate-page").textContent = "Sivu " + (duplicatePage+1) + "/" + pages;
    $("#duplicate-prev").disabled = duplicatePage === 0; $("#duplicate-next").disabled = duplicatePage >= pages-1;
    shown.forEach((group,i) => {
      const card = node("article",undefined,"duplicate-group"), heading = node("h3",group.names.join(" / "));
      card.append(heading,node("p",group.records.length+" aktiivista tunnusta · vertaa lähdetiedot ennen yhdistämistä. Kapealla näytöllä voit vierittää vertailua sivusuunnassa","hint"));
      const comparisonValues = entry => ({
        clubs: [...entry.clubs],
        competitions: [...new Map(entry.results.map(({item}) => [R.compKey(item),item])).values()].map(item => item.title+" · "+item.details),
        categories: [...new Set(entry.results.map(({row}) => row.category))],
        weights: [...new Set(entry.results.map(({row}) => row.weight+" kg"))]
      });
      const shared = new Map();
      group.records.forEach(entry => Object.entries(comparisonValues(entry)).forEach(([field,values]) => {
        new Set(values.map(value => R.norm(value))).forEach(value => {
          const key = JSON.stringify([field,value]);
          if (!shared.has(key)) shared.set(key,new Set());
          shared.get(key).add(entry.athlete.id);
        });
      }));
      card.append(node("p","Korostettu tieto esiintyy vähintään kahdessa tämän ryhmän merkinnässä. Samat tiedot eivät yksin todista, että kyseessä on sama henkilö.","hint"));
      const scroll = node("div",undefined,"comparison-scroll");
      const columns = node("div",undefined,"duplicate-records");
      columns.style.setProperty("--comparison-count", String(group.records.length));
      group.records.forEach(entry => {
        const record = node("div",undefined,"duplicate-record"); record.dataset.athleteId = entry.athlete.id;
        const header = node("div",undefined,"comparison-cell");
        header.append(node("h4",entry.athlete.name),node("p",entry.athlete.id),
          node("p",entry.athlete.status === "reviewed" ? "Tarkistettu merkintä" : "Tarkistamaton tulosryhmä","hint"));
        const field = (label, values, fieldKey) => {
          const cell = node("div",undefined,"comparison-cell");
          cell.append(node("h5",label));
          const list = node("ul"); values.forEach(value => {
            const li = node("li",value);
            const matches = shared.get(JSON.stringify([fieldKey,R.norm(value)]));
            if (matches?.size > 1) {
              li.className = "shared-comparison-value";
              const badge = node("span","Yhteinen · " + matches.size + " merkintää","shared-comparison-label");
              const others = [...matches].filter(id => id !== entry.athlete.id);
              badge.setAttribute("aria-label", "Sama tieto myös tunnuksilla " + others.join(", "));
              li.append(document.createTextNode(" "),badge);
            }
            list.append(li);
          });
          cell.append(list); return cell;
        };
        const competitions = [...new Map(entry.results.map(({item}) => [R.compKey(item),item])).values()];
        record.append(header,
          field("Seurat / paikkakunnat lähteessä", [...entry.clubs], "clubs"),
          field("Kilpailut ja päivämäärät", competitions.map(item => item.title+" · "+item.details), "competitions"),
          field("Ikäluokat", [...new Set(entry.results.map(({row}) => row.category))], "categories"),
          field("Painoluokat", [...new Set(entry.results.map(({row}) => row.weight+" kg"))], "weights"),
          node("p",entry.count + " tulosta · " + competitions.length + " kilpailua","comparison-cell"));
        const details = node("details",undefined,"comparison-cell"), resultList = node("ul"); details.append(node("summary","Näytä kaikki tulokset"));
        entry.results.forEach(({item,row}) => resultList.append(node("li",item.title+" · "+item.details+" · "+row.name+" · "+row.club+" · "+row.category+" · "+row.weight+" kg · sija "+row.place+" · "+row.resultId)));
        details.append(resultList); record.append(details);
        const actions = node("div",undefined,"comparison-cell");
        const open = node("button","Avaa tämä merkintä"); open.type = "button"; open.addEventListener("click",()=>choosePerson(entry.athlete.id)); actions.append(open); record.append(actions); columns.append(record);
      });
      scroll.append(columns);
      card.append(scroll);
      const quick = node("div",undefined,"actions");
      for (let a=0;a<group.records.length;a++) for (let b=a+1;b<group.records.length;b++) {
        const pair=[group.records[a],group.records[b]];
        if (knownDifferent(pair[0].athlete.id,pair[1].athlete.id)) continue;
        const [targetEntry,sourceEntry]=preferredPair(pair[0],pair[1]);
        const button=node("button","Yhdistä " + sourceEntry.athlete.id + " → " + targetEntry.athlete.id);
        button.type="button";button.className="quick-merge";
        button.addEventListener("click",()=>startMerge(sourceEntry.athlete.id,targetEntry.athlete.id));
        quick.append(button);
      }
      card.append(node("p","Pikayhdistäminen säilyttää ensisijaisesti tarkistetun tunnuksen, muuten eniten tuloksia sisältävän tunnuksen. Voit vaihtaa suunnan alla olevista valinnoista.","hint"),quick);
      const controls = node("div",undefined,"duplicate-merge"), targetLabel=node("label","Säilytettävä tunnus"),sourceLabel=node("label","Siirrettävä tunnus");
      const target=node("select"),source=node("select"); target.id="duplicate-target-"+i; source.id="duplicate-source-"+i;
      target.className="duplicate-target"; source.className="duplicate-source"; targetLabel.htmlFor=target.id; sourceLabel.htmlFor=source.id;
      group.records.forEach(entry=>target.add(new Option(label(entry),entry.athlete.id)));
      const updateSources=()=>{
        const previous=source.value; source.replaceChildren(new Option("Valitse siirrettävä merkintä",""));
        group.records.filter(entry=>entry.athlete.id!==target.value).forEach(entry=>source.add(new Option(label(entry),entry.athlete.id)));
        source.value=[...source.options].some(option=>option.value===previous)?previous:"";
      };
      target.addEventListener("change",()=>{cancel();updateSources();}); source.addEventListener("change",cancel); updateSources();
      const merge=node("button","Esikatsele näiden yhdistäminen");merge.type="button";merge.className="duplicate-preview";
      merge.addEventListener("click",()=>{if(!source.value)return say("Valitse siirrettävä tunnus vertailun alta.","error");startMerge(source.value,target.value);});
      const separate = node("button","Merkitse nämä eri henkilöiksi"); separate.type="button"; separate.className="different-preview";
      separate.addEventListener("click",()=>{
        if (!source.value) return say("Valitse kaksi vertailtavaa tunnusta yllä olevista valinnoista.","error");
        preview("Merkitään " + source.value + " ja " + target.value + " eri henkilöiksi. Näiden kahden välistä kaksoismerkintäehdotusta ei enää näytetä. Tulokset ja tunnukset säilyvät ennallaan. Hyväksy vain, jos tiedät kyseessä olevan eri henkilöt.",()=>R.setDifferent(data,source.value,target.value),target.value);
      });
      const relation = node("p",undefined,"hint");
      const updateRelation = () => {
        const known = source.value && knownDifferent(source.value,target.value);
        separate.disabled = !!known;
        merge.disabled = !!known;
        relation.textContent = known ? "Nämä tunnukset on jo merkitty eri henkilöiksi. Merkinnän voi perua alla kohdassa Eri henkilöiksi merkityt." : "Valitse molemmat tunnukset ennen yhdistämistä tai eri henkilöiksi merkitsemistä.";
      };
      target.addEventListener("change",updateRelation); source.addEventListener("change",updateRelation); updateRelation();
      controls.append(targetLabel,target,sourceLabel,source,merge,separate,relation);card.append(controls);parent.append(card);
    });
  }
  function renderDifferentPeople() {
    const parent = $("#different-people-list"); parent.replaceChildren();
    const pairs = R.differentPairs(data);
    $("#different-people-count").textContent = pairs.length + " tarkistettua tunnusparia.";
    const query = R.norm($("#duplicate-search").value);
    const records = index();
    pairs.filter(pair => R.norm(pair.map(id => records.has(id) ? label(records.get(id)) : id).join(" ")).includes(query)).slice(0,100).forEach(([a,b]) => {
      const li = node("li");
      li.append(node("p",[a,b].map(id=>records.has(id)?label(records.get(id)):id).join(" / ")));
      const button = node("button","Peru eri henkilöiksi merkitseminen");button.type="button";button.className="different-restore";
      button.addEventListener("click",()=>preview("Poistetaan eri henkilöiden merkintä tunnusten " + a + " ja " + b + " väliltä. Mahdollinen kaksoismerkintäehdotus palaa tarkistettavaksi. Tunnuksia ei yhdistetä.",()=>R.setDifferent(data,a,b,false),a));
      li.append(button);parent.append(li);
    });
  }
  function isKll(item) { return /\bkll\b|koululiikuntaliit/i.test(item.title); }
  function kllCandidates() {
    const found=new Map();
    duplicateGroups().forEach(group=>{
      for(let i=0;i<group.records.length;i++)for(let j=i+1;j<group.records.length;j++){
        const a=group.records[i],b=group.records[j];
        if(knownDifferent(a.athlete.id,b.athlete.id))continue;
        let kll,club;
        if(a.results.some(e=>isKll(e.item)) && !a.results.some(e=>!isKll(e.item)) && b.results.some(e=>!isKll(e.item))){kll=a;club=b;}
        else if(b.results.some(e=>isKll(e.item)) && !b.results.some(e=>!isKll(e.item)) && a.results.some(e=>!isKll(e.item))){kll=b;club=a;}
        else continue;
        const key=[a.athlete.id,b.athlete.id].sort().join("|");
        found.set(key,{kll,club});
      }
    });return [...found.values()];
  }
  function renderKll() {
    const query=R.norm($("#kll-search").value);
    const candidates=kllCandidates().filter(p=>R.norm(label(p.kll)+" "+label(p.club)).includes(query));
    const pages=Math.max(1,Math.ceil(candidates.length/10));kllPage=Math.min(kllPage,pages-1);
    $("#kll-count").textContent=candidates.length+" tarkistettavaa paria. Sama nimi ei yksin varmista henkilöllisyyttä.";
    $("#kll-page").textContent="Sivu "+(kllPage+1)+" / "+pages;
    $("#kll-prev").disabled=kllPage===0;$("#kll-next").disabled=kllPage===pages-1;
    const parent=$("#kll-list");parent.replaceChildren();
    candidates.slice(kllPage*10,kllPage*10+10).forEach(pair=>{
      const card=node("article",undefined,"kll-pair");card.append(node("h3",pair.kll.athlete.name));
      const wrap=node("div",undefined,"table-wrap"),table=node("table",undefined,"kll-table");table.setAttribute("aria-label","KLL- ja seuraprofiilin vertailu: "+pair.kll.athlete.name);
      const head=node("thead"),hr=node("tr");["Tieto","KLL-merkintä","Seuraprofiili"].forEach(text=>{const th=node("th",text);th.scope="col";hr.append(th);});head.append(hr);table.append(head);
      const body=node("tbody");
      const values=(entry,type)=>{
        if(type==="profile")return [entry.athlete.name,entry.athlete.id];
        const records=type==="source"&&entry===pair.club?entry.results.filter(e=>!isKll(e.item)):entry.results;
        if(type==="source")return [...new Set(records.map(e=>e.row.club))];
        if(type==="competition")return [...new Set(records.map(e=>e.item.title+" · "+e.item.details))];
        if(type==="category")return [...new Set(records.map(e=>e.row.category))];
        if(type==="weight")return [...new Set(records.map(e=>e.row.weight+" kg"))];
        return [entry.count+" tulosta koko profiilissa"];
      };
      [["Nimi ja tunnus","profile"],["Paikkakunta / seura lähteessä","source"],["Kilpailut ja päivämäärät","competition"],["Ikäluokat","category"],["Painoluokat","weight"],["Tulosmäärä","count"]].forEach(([title,type])=>{
        const tr=node("tr"),th=node("th",title);th.scope="row";tr.append(th);
        const left=values(pair.kll,type),right=values(pair.club,type);
        [left,right].forEach((items,i)=>{
          const td=node("td"),list=node("ul");items.forEach(value=>{
            const li=node("li",value);
            if(["category","weight"].includes(type) && (i?left:right).some(other=>R.norm(other)===R.norm(value))){li.className="shared-comparison-value";li.append(node("span","Sama lähdetieto","shared-comparison-label"));}
            list.append(li);
          });td.append(list);tr.append(td);
        });body.append(tr);
      });table.append(body);wrap.append(table);card.append(wrap);
      const [target,source]=preferredPair(pair.kll,pair.club);
      card.append(node("p","Yhdistettäessä säilyy "+target.athlete.id+". Alkuperäiset paikkakunta- ja seuratiedot säilyvät tulosriveillä.","hint"));
      const actions=node("div",undefined,"actions"),merge=node("button","Yhdistä nämä profiilit"),different=node("button","Nämä ovat eri henkilöt");merge.type="button";different.type="button";merge.className="kll-merge";different.className="kll-different";
      merge.addEventListener("click",()=>startMerge(source.athlete.id,target.athlete.id));
      different.addEventListener("click",()=>preview("Merkitään "+pair.kll.athlete.id+" ja "+pair.club.athlete.id+" eri henkilöiksi. Tuloksia ei siirretä. Päätöksen voi perua.",()=>R.setDifferent(data,pair.kll.athlete.id,pair.club.athlete.id),target.athlete.id));
      actions.append(merge,different);card.append(actions);parent.append(card);
    });
  }
  function renderAutoSummary() {
    const plan=nameClubPlan();
    $("#auto-summary").textContent=plan.groups.length+" yhdistettävää ryhmää · "+plan.mergedProfiles+" poistuvaa erillistä profiilia · "+plan.movedResults+" siirtyvää tulosta. Tarkistettavaksi jää "+plan.skipped.length+" moniselitteistä tai eri henkilöiksi merkittyä ryhmää.";
    $("#auto-name-club").disabled=!plan.groups.length;
  }
  function preferredPair(a,b) {
    const rank = x => x.athlete.status === "reviewed" ? 1 : 0;
    return [a,b].sort((x,y)=>rank(y)-rank(x)||y.count-x.count||x.athlete.id.localeCompare(y.athlete.id));
  }
  function strongEvidence(a,b) {
    if (!a.count || !b.count || knownDifferent(a.athlete.id,b.athlete.id)) return null;
    const names = new Set([...a.matchNames].map(R.norm));
    if (![...b.matchNames].some(name=>names.has(R.norm(name)))) return null;
    const comps = new Set(a.results.map(e=>R.compKey(e.item)));
    if (b.results.some(e=>comps.has(R.compKey(e.item)))) return null;
    for (const left of a.results) for (const right of b.results) {
      if (/\bkll\b|koululiikuntaliit/i.test(left.item.title+" "+right.item.title)) continue;
      const yearA=left.item.details.match(/\b20\d{2}\b/),yearB=right.item.details.match(/\b20\d{2}\b/);
      if (!yearA || !yearB || Math.abs(Number(yearA[0])-Number(yearB[0]))>1) continue;
      if (R.norm(left.row.club)!==R.norm(right.row.club) || R.norm(left.row.category)!==R.norm(right.row.category) || R.norm(left.row.weight)!==R.norm(right.row.weight)) continue;
      return {club:left.row.club,category:left.row.category,weight:left.row.weight, left,right};
    }
    return null;
  }
  function strongCandidates() {
    const found = new Map();
    duplicateGroups().forEach(group=>{
      for(let i=0;i<group.records.length;i++) for(let j=i+1;j<group.records.length;j++) {
        const a=group.records[i],b=group.records[j],key=[a.athlete.id,b.athlete.id].sort().join("|");
        if(found.has(key)) continue;
        const evidence=strongEvidence(a,b);if(!evidence)continue;
        const [target,source]=preferredPair(a,b);found.set(key,{key,target,source,evidence});
      }
    });return [...found.values()];
  }
  function selectionStatus() {
    $("#strong-selected").textContent = selectedPairs.size + " tarkistettua paria valittu. Sama tunnus voi olla vain yhdessä erän parissa.";
    $("#strong-apply").disabled = !selectedPairs.size;
  }
  function renderStrong() {
    const query=R.norm($("#strong-search").value);
    const candidates=strongCandidates().filter(p=>R.norm(label(p.target)+" "+label(p.source)).includes(query));
    const pages=Math.max(1,Math.ceil(candidates.length/10));strongPage=Math.min(strongPage,pages-1);
    $("#strong-count").textContent=candidates.length+" vahvaa ehdotusta. Tarkista kilpailut ennen valintaa.";
    $("#strong-page").textContent="Sivu "+(strongPage+1)+" / "+pages;
    $("#strong-prev").disabled=strongPage===0;$("#strong-next").disabled=strongPage===pages-1;
    const list=$("#strong-list");list.replaceChildren();
    candidates.slice(strongPage*10,strongPage*10+10).forEach(pair=>{
      const card=node("article",undefined,"strong-pair");
      const labelEl=node("label"),box=node("input");box.type="checkbox";box.className="strong-select";box.checked=selectedPairs.has(pair.key);
      labelEl.append(box,node("span",pair.target.athlete.name+" · "+pair.source.athlete.id+" → "+pair.target.athlete.id));card.append(labelEl);
      const e=pair.evidence;
      card.append(node("p","Täsmäävät: nimi · seura "+e.club+" · ikäluokka "+e.category+" · painoluokka "+e.weight+" kg"));
      card.append(node("p",e.left.item.title+" · "+e.left.item.details+" / "+e.right.item.title+" · "+e.right.item.details));
      card.append(node("p","Säilyy: "+label(pair.target)+". Siirretään: "+label(pair.source),"hint"));
      box.addEventListener("change",()=>{
        cancel();
        if(box.checked){
          const ids=[pair.target.athlete.id,pair.source.athlete.id];
          if([...selectedPairs.values()].some(p=>ids.includes(p.target.athlete.id)||ids.includes(p.source.athlete.id))){box.checked=false;return say("Sama tunnus on jo valitussa parissa. Yhdistä ensin valittu pari ja tarkista jäljelle jäävä ehdotus uudelleen.","error");}
          selectedPairs.set(pair.key,pair);
        }else selectedPairs.delete(pair.key);
        selectionStatus();
      });
      const compare=node("button","Vertaa kaikkia tuloksia");compare.type="button";
      compare.addEventListener("click",()=>{$("#duplicate-search").value=pair.target.athlete.id;duplicatePage=0;renderDuplicates();$("#duplicates-title").scrollIntoView({block:"start"});});
      const merge=node("button","Yhdistä tämä pari");merge.type="button";merge.className="strong-merge";merge.addEventListener("click",()=>startMerge(pair.source.athlete.id,pair.target.athlete.id));
      card.append(compare,merge);list.append(card);
    });selectionStatus();
  }
  function label(entry) {
    return entry.athlete.name + " · " + entry.athlete.id + " · " + [...entry.clubs].join(", ") + " · " + entry.count + " tulosta" + (entry.athlete.status === "reviewed" ? " · tarkistettu" : " · tarkistamaton");
  }
  function filtered(query, unreviewed = false) {
    const q = R.norm(query);
    return [...index().values()].filter(x => (!unreviewed || x.athlete.status === "unreviewed") &&
      R.norm([x.athlete.id, ...x.names, ...x.clubs].join(" ")).includes(q))
      .sort((a,b) => a.athlete.name.localeCompare(b.athlete.name,"fi") || a.athlete.id.localeCompare(b.athlete.id));
  }
  function cancel() { pending = null; $("#confirm-panel").hidden = true; $("#export-registry").disabled = !data; $("#undo-registry").disabled = !data || !data.athleteRegistry.history.length; }
  function renderList() {
    const found = filtered($("#person-search").value, $("#only-unreviewed").checked), select = $("#person-list");
    select.replaceChildren();
    found.slice(0,100).forEach(x => select.add(new Option(label(x), x.athlete.id)));
    select.value = selectedId;
    $("#person-count").textContent = found.length + " merkintää. " + (found.length > 100 ? "Näytetään ensimmäiset 100; tarkenna hakua." : "Valitse merkintä listasta.");
  }
  function renderTargets() {
    const previous = $("#target-person").value, query = $("#target-search").value.trim();
    $("#target-person").replaceChildren(new Option(query ? "Valitse siirrettävä merkintä" : "Kirjoita ensin hakusana", ""));
    if (query) filtered(query).filter(x => x.athlete.id !== selectedId).slice(0,100).forEach(x => $("#target-person").add(new Option(label(x), x.athlete.id)));
    $("#target-person").value = previous;
  }
  function renderEditor() {
    const person = people().find(a => a.id === selectedId); $("#editor").hidden = !person;
    if (!person) return;
    const own = entries(person.id), originalNames = [...new Set(own.map(x => x.row.name))];
    $("#person-details").textContent = person.id + " · " + own.length + " tulosta · " + (person.status === "reviewed" ? "Tarkistettu" : "Tarkistamaton tulosryhmä");
    $("#original-names").textContent = "Nimet lähteissä: " + (originalNames.join(", ") || "Ei nykyisiä tuloksia");
    $("#person-name").value = person.name; $("#person-reviewed").checked = person.status === "reviewed";
    $("#split-name").value = person.name; $("#target-search").value = ""; renderTargets();
    const parent = $("#identity-rows"); parent.replaceChildren();
    own.forEach(({item, row}) => {
      const tr = document.createElement("tr"), cell = document.createElement("td"), box = document.createElement("input");
      box.type = "checkbox"; box.value = row.resultId; box.setAttribute("aria-label", "Erota: " + row.name + ", " + item.title + ", " + item.details + ", " + row.category + " " + row.weight + " kg, sija " + row.place);
      box.addEventListener("change", cancel); cell.append(box); tr.append(cell);
      [item.title + " · " + item.details, row.name + " · " + row.club, row.category + " · " + row.weight + " kg · " + row.place + ".", row.resultId].forEach(text => { const td = document.createElement("td"); td.textContent = text; tr.append(td); });
      parent.append(tr);
    });
  }
  function render() {
    cancel(); const all = people();
    $("#registry-summary").textContent = data.competitions.length + " kilpailua · " + R.rows(data).length + " tulosta · " + all.length + " aktiivista tunnusta · " + all.filter(a => a.status === "unreviewed").length + " tarkistamatonta merkintää";
    $("#unsaved").textContent = dirty ? "Työaineistossa on muutoksia. Lataa päivitetty data.js ennen sivun sulkemista." : "Ei tallentamattomia muutoksia.";
    const list = $("#changes-list"); list.replaceChildren();
    data.athleteRegistry.history.slice(-20).reverse().forEach(h => { const li = document.createElement("li"); li.textContent = h.label + " · " + h.at; list.append(li); });
    renderAutoSummary(); selectedPairs.clear(); renderList(); renderEditor(); renderDuplicates(); renderStrong(); renderKll();
  }
  function preview(text, compute, nextId = selectedId) {
    try {
      const next = compute(); // Validate and compute on a copy before asking the editor to apply it.
      pending = { next, nextId }; $("#confirm-text").textContent = text;
      $("#confirm-overview").textContent = text.split("\n")[0];
      $("#confirm-details").open = !text.includes("\n");
      $("#confirm-panel").hidden = false; $("#export-registry").disabled = true; $("#undo-registry").disabled = true;
      $("#confirm-heading").focus({preventScroll:true});
      $("#confirm-panel").scrollIntoView({block:"start"});
    } catch (error) { say(error.message, "error"); }
  }
  $("#kll-search").addEventListener("input",()=>{cancel();kllPage=0;renderKll();});
  $("#kll-prev").addEventListener("click",()=>{cancel();kllPage--;renderKll();});
  $("#kll-next").addEventListener("click",()=>{cancel();kllPage++;renderKll();});
  $("#auto-name-club").addEventListener("click",()=>{
    if(!data)return;
    const plan=nameClubPlan();if(!plan.groups.length)return;
    const lines=plan.groups.map(g=>g.name+" · "+g.club+": "+g.sources.join(", ")+" → "+g.target+" ("+g.results+" tulosta)");
    preview("Yhdistetään automaattisesti "+plan.groups.length+" ryhmää samalla koko nimellä ja seuralla. "+plan.mergedProfiles+" erillistä profiilia yhdistyy ja "+plan.movedResults+" tulosta siirtyy.\n\n"+lines.join("\n")+"\n\nKoko ajon voi perua yhdellä painalluksella. Hyväksymisen jälkeen lataa päivitetty data.js.",()=>R.autoMergeNameClub(data),plan.groups[0].target);
  });
  $("#strong-search").addEventListener("input",()=>{cancel();strongPage=0;renderStrong();});
  $("#strong-prev").addEventListener("click",()=>{cancel();strongPage--;renderStrong();});
  $("#strong-next").addEventListener("click",()=>{cancel();strongPage++;renderStrong();});
  $("#strong-apply").addEventListener("click",()=>{
    const pairs=[...selectedPairs.values()];if(!pairs.length)return;
    const mapping=pairs.map(p=>[p.source.athlete.id,p.target.athlete.id]);
    const text="Yhdistetään "+pairs.length+" itse tarkistamaasi paria:\n"+pairs.map(p=>p.source.athlete.name+": "+p.source.athlete.id+" → "+p.target.athlete.id+" ("+p.source.count+" siirtyvää tulosta)").join("\n")+"\nKoko erän voi perua yhdellä Peru viimeisin muutos -painalluksella. Tallenna lopuksi data.js.";
    preview(text,()=>R.mergeMany(data,mapping),pairs[0].target.athlete.id);
  });
  $("#person-search").addEventListener("input", renderList);
  $("#duplicate-search").addEventListener("input",()=>{cancel();duplicatePage=0;renderDuplicates();});
  $("#duplicate-prev").addEventListener("click",()=>{cancel();duplicatePage--;renderDuplicates();});
  $("#duplicate-next").addEventListener("click",()=>{cancel();duplicatePage++;renderDuplicates();});
  $("#only-unreviewed").addEventListener("change", renderList);
  $("#person-list").addEventListener("change", () => { cancel(); selectedId = $("#person-list").value; renderEditor(); });
  $("#target-search").addEventListener("input", () => { cancel(); renderTargets(); });
  ["#target-person", "#person-name", "#person-reviewed", "#split-name"].forEach(selector => $(selector).addEventListener("input", cancel));
  $("#save-person").addEventListener("click", () => {
    const name = $("#person-name").value.trim(), reviewed = $("#person-reviewed").checked, id = selectedId;
    preview("Tallennetaan nimi ”" + name + "” tunnukselle " + id + ". Tila: " + (reviewed ? "tarkistettu" : "tarkistamaton") + ". Lähdetulosten nimet säilyvät ennallaan.", () => R.updatePerson(data, id, name, reviewed));
  });
  $("#preview-merge").addEventListener("click", () => {
    startMerge($("#target-person").value,selectedId);
  });
  $("#preview-split").addEventListener("click", () => {
    const ids = [...document.querySelectorAll("#identity-rows input:checked")].map(box => box.value), name = $("#split-name").value.trim(), source = selectedId;
    preview("Erotetaan " + ids.length + " valittua tulosta tunnukselta " + source + " uudelle tarkistamattomalle tunnukselle nimellä ”" + name + "”. Muut tulokset pysyvät nykyisellä tunnuksella.", () => R.split(data, source, ids, name));
  });
  $("#apply-identity").addEventListener("click", () => {
    if (!pending) return;
    data = pending.next; selectedId = pending.nextId; dirty = true; render();
    say("Muutos hyväksytty työaineistoon. Voit perua sen tai ladata päivitetyn data.js-tiedoston.", "success");
  });
  $("#cancel-identity").addEventListener("click", () => { cancel(); say("Esikatselu hylättiin. Aineisto säilyi ennallaan."); });
  $("#undo-registry").addEventListener("click", () => {
    if (pending || !data) return;
    try { data = R.undo(data); dirty = true; render(); say("Viimeisin muutos peruttiin. Lataa data.js tallentaaksesi myös perumisen.", "success"); }
    catch (error) { say(error.message, "error"); }
  });
  $("#export-registry").addEventListener("click", () => {
    if (pending || !data) return;
    try {
      const source = R.exportSource(data), url = URL.createObjectURL(new Blob([source], {type:"text/javascript;charset=utf-8"}));
      const a = document.createElement("a"); a.href = url; a.download = "data.js"; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
      say("data.js-lataus aloitettiin. Tarkista lataus ja korvaa projektikansion data.js. Muutokset eivät vielä ole GitHubissa. Älä käytä vanhassa ylläpitovälilehdessä olevaa aineistoa tämän päälle.", "success");
    } catch (error) { say("Vienti ei onnistunut: " + error.message,"error"); }
  });
  window.addEventListener("beforeunload", event => { if (dirty) { event.preventDefault(); event.returnValue = ""; } });
  try {
    R.validate(window.PAINI_SHARED_DATA); data = window.PAINI_SHARED_DATA;
    ["#person-search", "#person-list", "#only-unreviewed", "#duplicate-search", "#strong-search", "#kll-search"].forEach(selector => { $(selector).disabled = false; }); render();
    say("Rekisteri luettu. Mahdollisten kaksoismerkintöjen lista auttaa vertailussa. Nykyiset yhdistämiset ja tarkistustilat säilyvät; ehdotukset eivät muuta aineistoa.", "success");
  } catch (error) { say("Rekisteriä ei voitu avata: " + error.message + " Pidä data.js, athlete-registry.js, painijat.html, painijat.js ja style.css samassa kansiossa.", "error"); }
})();
