"use strict";
(() => {
  const $ = selector => document.querySelector(selector), R = window.PainiRegistry;
  let data, selectedId = "", pending = null, dirty = false;
  const say = (text, kind = "") => { $("#registry-status").textContent = text; $("#registry-status").dataset.kind = kind; };
  const people = () => data.athleteRegistry.athletes.filter(a => !a.mergedInto);
  const entries = id => data.competitions.flatMap(item => item.rows.filter(row => row.athleteId === id).map(row => ({item, row})));
  function index() {
    const map = new Map(people().map(a => [a.id, { athlete:a, names:new Set([a.name]), clubs:new Set(), count:0 }]));
    data.athleteRegistry.athletes.filter(a => a.mergedInto).forEach(a => {
      const entry = map.get(R.resolve(data, a.id));
      if (entry) { entry.names.add(a.id); entry.names.add(a.name); }
    });
    R.rows(data).forEach(row => { const x = map.get(row.athleteId); x.names.add(row.name); x.clubs.add(row.club); x.count++; }); return map;
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
    renderList(); renderEditor();
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
  $("#only-unreviewed").addEventListener("change", renderList);
  $("#person-list").addEventListener("change", () => { cancel(); selectedId = $("#person-list").value; renderEditor(); });
  $("#target-search").addEventListener("input", () => { cancel(); renderTargets(); });
  ["#target-person", "#person-name", "#person-reviewed", "#split-name"].forEach(selector => $(selector).addEventListener("input", cancel));
  $("#save-person").addEventListener("click", () => {
    const name = $("#person-name").value.trim(), reviewed = $("#person-reviewed").checked, id = selectedId;
    preview("Tallennetaan nimi ”" + name + "” tunnukselle " + id + ". Tila: " + (reviewed ? "tarkistettu" : "tarkistamaton") + ". Lähdetulosten nimet säilyvät ennallaan.", () => R.updatePerson(data, id, name, reviewed));
  });
  $("#preview-merge").addEventListener("click", () => {
    const sourceId = $("#target-person").value, targetId = selectedId, records = index();
    if (!records.has(sourceId)) return say("Valitse ensin siirrettävä merkintä.", "error");
    preview("Siirretään kaikki " + records.get(sourceId).count + " tulosta merkinnältä ”" + label(records.get(sourceId)) + "” merkinnälle ”" + label(records.get(targetId)) + "”. Säilyvä tunnus: " + targetId + ". Yhdistämisen jälkeen merkintä on tarkistamaton. Hyväksy vain, jos tiedät merkintöjen tarkoittavan samaa henkilöä.", () => R.merge(data, sourceId, targetId), targetId);
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
    ["#person-search", "#person-list", "#only-unreviewed"].forEach(selector => { $(selector).disabled = false; }); render();
    say("Rekisteri luettu. Alkuperäiset nimi–seura-ryhmät ovat tarkistamattomia. Mitään henkilöitä ei ole vahvistettu automaattisesti.", "success");
  } catch (error) { say("Rekisteriä ei voitu avata: " + error.message + " Pidä data.js, athlete-registry.js, painijat.html, painijat.js ja style.css samassa kansiossa.", "error"); }
})();
