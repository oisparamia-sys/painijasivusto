"use strict";
(() => {
  const $ = selector => document.querySelector(selector), R = window.PainiRegistry;
  let data, selectedId = "", pending = null, dirty = false;
  let duplicatePage = 0;
  const duplicatePageSize = 10;
  const say = (text, kind = "") => { $("#registry-status").textContent = text; $("#registry-status").dataset.kind = kind; };
  const people = () => data.athleteRegistry.athletes.filter(a => !a.mergedInto);
  const entries = id => data.competitions.flatMap(item => item.rows.filter(row => row.athleteId === id).map(row => ({item, row})));
  function index() {
    const map = new Map(people().map(a => [a.id, { athlete:a, names:new Set([a.name]), matchNames:new Set([a.name]), clubs:new Set(), count:0, results:[] }]));
    data.athleteRegistry.athletes.filter(a => a.mergedInto).forEach(a => {
      const entry = map.get(R.resolve(data, a.id));
      if (entry) { entry.names.add(a.id); entry.names.add(a.name); entry.matchNames.add(a.name); }
    });
    data.competitions.forEach(item => item.rows.forEach(row => {
      const x = map.get(row.athleteId); x.names.add(row.name); x.matchNames.add(row.name); x.clubs.add(row.club); x.count++; x.results.push({item,row});
    })); return map;
  }
  function duplicateGroups() {
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
      const key = [...group.records.keys()].sort().join("|");
      if (!byMembership.has(key)) byMembership.set(key,{names:new Set(),records:group.records});
      group.names.forEach(name => byMembership.get(key).names.add(name));
    });
    return [...byMembership.values()].map(group => ({
      names:[...group.names].sort((a,b)=>a.localeCompare(b,"fi")),
      records:[...group.records.values()].sort((a,b)=>a.athlete.id.localeCompare(b.athlete.id))
    })).sort((a,b)=>a.names[0].localeCompare(b.names[0],"fi"));
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
      card.append(heading,node("p",group.records.length+" aktiivista tunnusta · vertaa lähdetiedot ennen yhdistämistä","hint"));
      const columns = node("div",undefined,"duplicate-records");
      group.records.forEach(entry => {
        const record = node("div",undefined,"duplicate-record"); record.dataset.athleteId = entry.athlete.id;
        record.append(node("h4",entry.athlete.name),node("p",entry.athlete.id),
          node("p",entry.athlete.status === "reviewed" ? "Tarkistettu merkintä" : "Tarkistamaton tulosryhmä","hint"),
          node("p","Seura / paikkakunta lähteessä: " + [...entry.clubs].join(", ")));
        const competitions = [...new Map(entry.results.map(({item}) => [R.compKey(item),item])).values()];
        record.append(node("p",entry.count + " tulosta · " + competitions.length + " kilpailua"));
        const list = node("ul"); competitions.forEach(item => list.append(node("li",item.title+" · "+item.details))); record.append(list);
        const details = node("details"), resultList = node("ul"); details.append(node("summary","Näytä kaikki tulokset"));
        entry.results.forEach(({item,row}) => resultList.append(node("li",item.title+" · "+item.details+" · "+row.name+" · "+row.club+" · "+row.category+" · "+row.weight+" kg · sija "+row.place+" · "+row.resultId)));
        details.append(resultList); record.append(details);
        const open = node("button","Avaa tämä merkintä"); open.type = "button"; open.addEventListener("click",()=>choosePerson(entry.athlete.id)); record.append(open); columns.append(record);
      });
      card.append(columns);
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
      controls.append(targetLabel,target,sourceLabel,source,merge);card.append(controls);parent.append(card);
    });
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
    renderList(); renderEditor(); renderDuplicates();
  }
  function preview(text, compute, nextId = selectedId) {
    try {
      const next = compute(); // Validate and compute on a copy before asking the editor to apply it.
      pending = { next, nextId }; $("#confirm-text").textContent = text;
      $("#confirm-panel").hidden = false; $("#export-registry").disabled = true; $("#undo-registry").disabled = true;
      $("#apply-identity").focus();
    } catch (error) { say(error.message, "error"); }
  }
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
    R.validate(window.PAINI_SHARED_DATA); data = JSON.parse(JSON.stringify(window.PAINI_SHARED_DATA));
    ["#person-search", "#person-list", "#only-unreviewed", "#duplicate-search"].forEach(selector => { $(selector).disabled = false; }); render();
    say("Rekisteri luettu. Mahdollisten kaksoismerkintöjen lista auttaa vertailussa. Nykyiset yhdistämiset ja tarkistustilat säilyvät; ehdotukset eivät muuta aineistoa.", "success");
  } catch (error) { say("Rekisteriä ei voitu avata: " + error.message + " Pidä data.js, athlete-registry.js, painijat.html, painijat.js ja style.css samassa kansiossa.", "error"); }
})();
