"use strict";
const $ = selector => document.querySelector(selector);
const boutsBase = new URL('.', document.currentScript?.src || location.href);
let boutsLoading = null;
let pendingBoutsState = null;
function loadBouts() {
  if (boutsLoading) return boutsLoading;
  const notice = $('#bouts-load-status'), retry = $('#bouts-retry');
  if (notice) { notice.hidden = false; notice.textContent = 'Ladataan ottelukokeilua…'; }
  if (retry) retry.hidden = true;
  boutsLoading = new Promise((resolve,reject) => {
    const script = document.createElement('script');
    script.src = new URL('ottelut.js?fresh='+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),boutsBase).href;
    script.onload = () => {
      try {
        if (!window.PAINI_BOUTS) throw Error('Ottelukokeilu puuttuu');
        Promise.resolve(window.PAINI_BOUTS.init(sharedData,window.PainiRegistry)).then(() => {
          if (pendingBoutsState) { window.PAINI_BOUTS.restore(pendingBoutsState); pendingBoutsState = null; }
          resolve(true);
        },reject).catch(reject);
      } catch (error) { script.remove(); reject(error); }
    };
    script.onerror = () => {script.remove();reject(Error('Ottelukokeilu ei latautunut'));};
    document.head.append(script);
  }).catch(() => {
    boutsLoading = null;
    if (notice) { notice.hidden=false; notice.textContent='Ottelukokeilua ei voitu avata. Tarkista verkkoyhteys ja että käytössä on uusin sivuversio. Tuloshaku toimii edelleen.'; }
    if (retry) retry.hidden=false;
    return false;
  });
  return boutsLoading;
}
const sharedData = window.PAINI_SHARED_DATA;
const sharedReady = sharedData && sharedData.version === 1 &&
  Array.isArray(sharedData.competitions) && sharedData.competitions.every(valid) &&
  new Set(sharedData.competitions.map(identity)).size === sharedData.competitions.length;
const sharedCompetitions = sharedReady ? sharedData.competitions : [];
const competitions = [...sharedCompetitions];
// Competition data is immutable for the lifetime of this page.
const competitionDates = new WeakMap();
let registryReady = false;
try { window.PainiRegistry.validate(sharedData); registryReady = true; } catch { /* Results remain readable if the registry has not loaded. */ }
const athleteRecords = new Map((registryReady ? sharedData.athleteRegistry.athletes : []).map(a => [a.id, a]));

let profileState = null;
let profileOpener = null;
let resultsScroll = null;
let profileReturnView = "results";
const featureViewNames=["home","clubs","club","compare"];
let restoreGeneration = 0;
const defaultPageTitle = document.title;
const resultsPerPage = 50;
let resultsPage = 0;
let lastResultsPage = 0;

function status(message, kind = "") {
  $("#status").hidden = false;
  $("#status").textContent = message;
  $("#status").dataset.kind = kind;
}
function valid(value) {
  return value && typeof value.title === "string" && value.title.trim() &&
    typeof value.details === "string" && typeof value.fileInfo === "string" &&
    Array.isArray(value.rows) && value.rows.length > 0 &&
    value.rows.every(row => row && Number.isInteger(row.place) && row.place > 0 &&
      ["name", "club", "category", "weight"].every(key =>
        typeof row[key] === "string" && row[key].trim()));
}
function identity(item) {
  return JSON.stringify([item.title, item.details].map(value =>
    value.trim().replace(/\s+/g, " ").toLocaleLowerCase("fi")));
}
function options(select, values, label) {
  const previous = select.value;
  select.replaceChildren(new Option(label, ""));
  [...new Set(values)].sort((a,b) => a.localeCompare(b,"fi"))
    .forEach(value => select.add(new Option(value, value)));
  if ([...select.options].some(option => option.value === previous)) {
    select.value = previous;
  }
}
function refresh(selected = "") {
  const select = $("#competition");
  select.replaceChildren(new Option("Kaikki kilpailut", ""));
  competitions.forEach(item => select.add(new Option(
    item.title + (item.details ? " · " + item.details : ""), identity(item)
  )));
  select.value = selected;
  $("#competition-search").value = competitions.find(item => identity(item) === selected)?.title || "";
  refreshFilters();
}
function selectedCompetitions() {
  const selected = $("#competition").value;
  return selected ? competitions.filter(item => identity(item) === selected) : competitions;
}
function refreshFilters() {
  const chosen = competitions.find(item => identity(item) === $("#competition").value);
  $("#competition-report-error").hidden = !chosen || typeof window.PAINI_OPEN_FEEDBACK !== "function";
  if (chosen) $("#competition-search").value = chosen.title + (chosen.details ? " · " + chosen.details : "");
  const allItems = selectedCompetitions();
  const years = allItems.map(resultYear);
  options($("#result-year"), years, "Kaikki vuodet");
  // Näytä vuodet uusimmasta vanhimpaan, päivämäärättömät lopussa.
  const yearSelect = $("#result-year");
  [...yearSelect.options].slice(1).sort((a,b) => {
    if (a.value === "Ei päivämäärää") return 1;
    if (b.value === "Ei päivämäärää") return -1;
    return Number(b.value) - Number(a.value);
  }).forEach(option => yearSelect.append(option));
  const items = yearFilteredCompetitions();
  const style = $("#result-style").value;
  const rows = items.flatMap(item => style ? item.rows.filter(row => resultStyle(item, row) === style) : item.rows);
  options($("#club"), rows.map(row => row.club), "Kaikki seurat");
  options($("#category"), rows.map(row => row.category), "Kaikki ikäluokat");
  $("#selection").textContent = items.length === 1
      ? "Valittuna: " + items[0].title + (items[0].details ? " · " + items[0].details : "")
      : "Haussa mukana " + items.length + " kilpailua.";
  $("#data-summary").textContent = sharedCompetitions.length + " yhteistä kilpailua, " +
    sharedCompetitions.reduce((sum, item) => sum + item.rows.length, 0).toLocaleString("fi-FI") +
    " kilpailusijoitusta.";
  const sourceLine = $("#source-line");
  sourceLine.replaceChildren();
  if (items.length === 1 && items[0].source) {
    try {
      const url = new URL(items[0].source);
      if (url.protocol === "https:" && url.hostname === "turniereklassisch.ringerdb.de") {
        const link = document.createElement("a");
        link.href = url.href; link.target = "_blank"; link.rel = "noopener noreferrer";
        link.textContent = "Avaa alkuperäinen tulossivu ↗";
        sourceLine.append(link);
      }
    } catch { /* Virheellistä lähdelinkkiä ei näytetä. */ }
  }
  sourceLine.hidden = !sourceLine.childElementCount;
  const partialNote = $("#partial-results-note");
  partialNote.replaceChildren();
  const partialItems = items.filter(item=>partialNotes(item).length);
  partialNote.hidden = !partialItems.length;
  if (items.length === 1 && partialItems.length) {
    const item = items[0];
    partialNote.append(partialBadge(item));
    const text = document.createElement("p");
    text.textContent = "Kilpailussa on puutteellisia tai tarkistettavia tietoja. Alla näkyy, mitä on tuotu ja mitä on jätetty pois. Puuttuvia sijoituksia ei ole päätelty:";
    const list = document.createElement("ul");
    partialNotes(item).forEach(note=>{
      const li = document.createElement("li");
      li.textContent = note.category + " · " + note.weight + " kg — " + (Number.isInteger(note.included) ? "Tuotuja sijoituksia: " + note.included + "; tuomatta jääneitä osallistujia: " + note.excluded + ". " : "Painoluokka on jätetty pois tuonnista. ") + (note.reason || "Kaikille osallistujille ei löytynyt vahvistettua sijoitusta.");
      list.append(li);
    });
    partialNote.append(text,list);
    const link = originalResultsLink(item); if(link)partialNote.append(link);
  } else if (partialItems.length) {
    partialNote.textContent = "Haussa on mukana " + partialItems.length + " kilpailua, joiden tulokset ovat osittaiset. Näet puuttuvat painoluokat valitsemalla kilpailun.";
  }
  render();
}
function render(keepPage = false) {
  if (keepPage !== true) resultsPage = 0;
  const query = $("#search").value.trim();
  const tokens = searchWords(query.toLocaleLowerCase("fi"));
  const style = $("#result-style").value, club = $("#club").value;
  const category = $("#category").value, order = $("#result-sort").value;
  const matchedNames = new Map();
  function matchesName(name) {
    if (!matchedNames.has(name)) matchedNames.set(name, matchesSearchWords(searchWords(name), tokens));
    return matchedNames.get(name);
  }
  const fragment = document.createDocumentFragment();
  const entries = [];
  for (const item of yearFilteredCompetitions()) {
    const competitionMatches = tokens.length && matchesCompetitionQuery(item.title + " " + item.details, query);
    for (const result of item.rows) {
      if (club && result.club !== club || category && result.category !== category) continue;
      if (style && resultStyle(item, result) !== style) continue;
      const canonicalName = athleteRecords.get(result.athleteId)?.name || "";
      if (tokens.length && !competitionMatches && !matchesName(result.name) && !matchesName(canonicalName) &&
          !matchesCompetitionQuery([result.name, canonicalName, result.club, result.category, item.title, item.details].join(" "), query)) continue;
      entries.push({item, result});
    }
  }
  entries.sort((a,b) => compareResults(a,b,order));
  const count = entries.length;
  lastResultsPage = Math.max(0,Math.ceil(count/resultsPerPage)-1);
  resultsPage = Math.max(0,Math.min(resultsPage,lastResultsPage));
  const first = resultsPage*resultsPerPage;
  const visible = entries.slice(first,first+resultsPerPage);
  $("#result-range").hidden = count === 0;
  $("#result-range").textContent = count ? "Näytetään tulokset " + (first+1) + "–" + (first+visible.length) + " / " + count + ". Haku ja rajaukset koskevat koko aineistoa." : "";
  document.querySelectorAll(".result-pagination").forEach(el => { el.hidden = count <= resultsPerPage; });
  document.querySelectorAll(".result-page").forEach(el => { el.textContent = "Sivu " + (resultsPage+1) + " / " + (lastResultsPage+1); });
  document.querySelectorAll(".results-prev").forEach(button => { button.disabled = resultsPage === 0; });
  document.querySelectorAll(".results-next").forEach(button => { button.disabled = resultsPage === lastResultsPage; });
  visible.forEach(({item, result}) => {
      const row = document.createElement("tr");
      row.dataset.resultId = result.resultId;
      const cell = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = "place " + ({1:"gold",2:"silver",3:"bronze"}[result.place] || "");
      badge.textContent = result.place + ".";
      cell.append(badge); row.append(cell);
      const nameCell = document.createElement("td");
      const nameButton = document.createElement("button");
      nameButton.type = "button";
      nameButton.className = "name-button";
      nameButton.textContent = result.name;
      nameButton.dataset.athleteId = result.athleteId || "";
      nameButton.disabled = !registryReady;
      nameButton.dataset.name = normalizePerson(result.name);
      nameButton.dataset.club = normalizePerson(result.club);
      nameButton.setAttribute("aria-label", "Näytä tulokset: " + result.name + ", " + result.club);
      nameButton.addEventListener("click", () => openProfile(result.athleteId, nameButton));
      nameCell.append(nameButton); row.append(nameCell);
      [result.club, result.category, result.weight + " kg", item.title, item.details || "–", styleLabel(item, result)]
        .forEach((value,index) => {
          const td = document.createElement("td");
          td.textContent = value; if(index < 5){const original=document.createElement("span");original.translate="no";original.textContent=value;td.replaceChildren(original);} if(index === 3 && partialNotes(item).length)td.append(partialBadge(item)); row.append(td);
        });
      labelResultRow(row, "results");
      fragment.append(row);
  });
  $("#results").replaceChildren(fragment);
  $("#count").textContent = count === 1 ? "1 kilpailusijoitus" : count.toLocaleString("fi-FI") + " kilpailusijoitusta";
  $("#empty").hidden = count > 0;
  if (profileState) renderProfile();
  // The directory has its own filters and is rendered when its tab is opened.
}
function normalizePerson(value) {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("fi");
}
function profileCompetitions() {
  return competitions;
}
function competitionDate(item) {
  const cached = competitionDates.get(item);
  if (cached !== undefined) return cached;
  const match = (item.details || item.title).match(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/);
  if (!match) { competitionDates.set(item, -Infinity); return -Infinity; }
  const day = Number(match[1]), month = Number(match[2]), year = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  const result = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? timestamp : -Infinity;
  competitionDates.set(item, result);
  return result;
}
function openProfile(athleteId, opener = null, updateUrl = true) {
  if (!registryReady) return;
  athleteId = window.PainiRegistry.resolve(sharedData, athleteId);
  if (!athleteId || !athleteRecords.has(athleteId)) return;
  restoreGeneration++;
  if (!profileState) {resultsScroll = {x: window.scrollX, y: window.scrollY};profileReturnView=featureViewNames.find(view=>document.getElementById(view+"-view")&&!document.getElementById(view+"-view").hidden)||(!$("#competition-view").hidden?"competitions":!$("#bouts-view").hidden?"bouts":"results");}
  if (opener) profileOpener = opener;
  $("#back-to-results").textContent={club:"Takaisin seuran profiiliin",clubs:"Takaisin seuroihin",home:"Takaisin etusivulle",competitions:"Takaisin kilpailuihin",bouts:"Takaisin otteluihin"}[profileReturnView]||"← Takaisin hakutuloksiin";
  clearProfileLinkError();
  profileState = { athleteId, year: "", sort: "newest" };
  $("#wrestler-report-error").hidden = typeof window.PAINI_OPEN_FEEDBACK !== "function";
  if (updateUrl) writeProfileRoute(athleteId);
  featureViewNames.forEach(view=>{const el=document.getElementById(view+"-view");if(el)el.hidden=true;});
  ["home","clubs","compare"].forEach(view=>document.getElementById("nav-"+view)?.setAttribute("aria-pressed","false"));
  $("#search-view").hidden = true;
  $("#competition-view").hidden = true;
  if ($("#bouts-view")) $("#bouts-view").hidden = true;
  $("#nav-bouts")?.setAttribute("aria-pressed", "false");
  $("#nav-results").setAttribute("aria-pressed", "true");
  $("#nav-competitions").setAttribute("aria-pressed", "false");
  if(document.getElementById("site-title"))$("#site-title").hidden=false;
  if(document.getElementById("search-intro"))$("#search-intro").hidden=true;
  $("#wrestler-view").hidden = false;
  renderProfile();
  $("#wrestler-title").focus();
}
function closeProfile(updateUrl = true) {
  if (updateUrl) writeSectionRoute(profileReturnView);
  const target = profileOpener?.isConnected ? profileOpener : $("#search");
  showView(profileReturnView,false,false);
  target.focus({preventScroll: true});
  const saved = resultsScroll;
  const generation = ++restoreGeneration;
  if (saved) {
    window.scrollTo({left: saved.x, top: saved.y, behavior: "instant"});
    requestAnimationFrame(() => {
      if (!profileState && generation === restoreGeneration)
        window.scrollTo({left: saved.x, top: saved.y, behavior: "instant"});
    });
  }
  profileOpener = null;
}
function renderProfile() {
  if (!profileState) return;
  const athlete = athleteRecords.get(profileState.athleteId);
  const allEntries = [];
  profileCompetitions().forEach(item => item.rows.forEach(result => {
    if (result.athleteId === athlete.id) allEntries.push({ item, result });
  }));
  const yearSelect = $("#wrestler-year");
  options(yearSelect, allEntries.map(e => resultYear(e.item)), "Kaikki vuodet");
  [...yearSelect.options].slice(1).sort((a,b) => {
    if (a.value === "Ei päivämäärää") return 1;
    if (b.value === "Ei päivämäärää") return -1;
    return Number(b.value)-Number(a.value);
  }).forEach(option => yearSelect.append(option));
  yearSelect.value = profileState.year;
  if (yearSelect.selectedIndex < 0) { yearSelect.value = ""; profileState.year = ""; }
  const entries = allEntries.filter(e => !profileState.year || resultYear(e.item) === profileState.year);
  const originalNames = new Set(allEntries.map(e => e.result.name));
  const nameKeys = new Set([...originalNames, athlete.name].map(normalizePerson));
  const alternativesById = new Map();
  profileCompetitions().forEach(item => item.rows.forEach(result => {
    if (result.athleteId !== athlete.id && nameKeys.has(normalizePerson(result.name))) {
      const other = athleteRecords.get(result.athleteId);
      if (other && !other.mergedInto) {
        if (!alternativesById.has(other.id)) alternativesById.set(other.id, { athlete: other, clubs: new Set() });
        alternativesById.get(other.id).clubs.add(result.club);
      }
    }
  }));
  $("#wrestler-sort").value = profileState.sort || "newest";
  entries.sort((a,b) => compareResults(a,b,profileState.sort || "newest") || a.item.title.localeCompare(b.item.title,"fi") || a.result.place-b.result.place);
  $("#wrestler-title").textContent = athlete.name;
  document.title = athlete.name + " – Painijatulokset";
  $("#wrestler-share-url").value = profileAddress(athlete.id);
  $("#share-status").textContent = "";
  $("#wrestler-id").textContent = athlete.id + " · " + (athlete.status === "reviewed" ? "Ylläpito tarkistanut yhdistämisen" : "Tarkistamaton tulosryhmä");
  $("#wrestler-aliases").textContent = "Nimet lähdetuloksissa: " + [...originalNames].join(", ");
  $("#wrestler-club").textContent = "Seurat tuloksissa: " + [...new Set(entries.map(e => e.result.club))].sort((a,b) => a.localeCompare(b,"fi")).join(", ");
  $("#wrestler-scope").textContent = (profileState.year ? (profileState.year === "Ei päivämäärää" ? "Tulokset ilman tunnistettua päivämäärää." : "Vuoden " + profileState.year + " tulokset.") : "Kaikkien vuosien tulokset.") + " Yhteenveto, sijoitusten jakauma ja tuloslista koskevat valittua vuotta. Päähaun rajaukset eivät vaikuta tähän näkymään.";
  const summary = $("#wrestler-summary");
  summary.replaceChildren();
  const stats = [
    ["Kilpailuja", new Set(entries.map(entry => identity(entry.item))).size],
    ["Tulosrivejä", entries.length],
    ["1. sijoja", entries.filter(entry => entry.result.place === 1).length],
    ["2. sijoja", entries.filter(entry => entry.result.place === 2).length],
    ["3. sijoja", entries.filter(entry => entry.result.place === 3).length]
  ];
  stats.forEach(([label, number]) => {
    const card = document.createElement("div");
    const term = document.createElement("dt"), value = document.createElement("dd");
    term.textContent = label; value.textContent = String(number);
    card.append(term, value); summary.append(card);
  });
  renderPlacementChart(entries);
  renderYearlyPlacements(allEntries);
  window.PAINI_FEATURES?.profile(allEntries,athlete.id);
  const tbody = $("#wrestler-results");
  const fragment = document.createDocumentFragment();
  entries.forEach(({item, result}) => {
    const row = document.createElement("tr"), cell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "place " + ({1:"gold",2:"silver",3:"bronze"}[result.place] || "");
    badge.textContent = result.place + ".";
    cell.append(badge); row.append(cell);
    [item.title, item.details || "–", result.category, result.weight + " kg"].forEach((value,index) => {
      const td = document.createElement("td"); td.textContent = value; {const original=document.createElement("span");original.translate="no";original.textContent=value;td.replaceChildren(original);} if(index === 0 && partialNotes(item).length)td.append(partialBadge(item)); row.append(td);
    });
    const sourceCell = document.createElement("td");
    sourceCell.textContent = "–";
    if (item.source) {
      try {
        const url = new URL(item.source);
        if (url.protocol === "https:" && url.hostname === "turniereklassisch.ringerdb.de") {
          const link = document.createElement("a");
          link.href = url.href; link.target = "_blank"; link.rel = "noopener noreferrer";
          link.textContent = "Tulossivu ↗";
          link.setAttribute("aria-label", "Alkuperäinen tulossivu: " + item.title);
          sourceCell.replaceChildren(link);
        }
      } catch { /* Virheellistä linkkiä ei näytetä. */ }
    }
    row.append(sourceCell);
    const styleCell = document.createElement("td"); styleCell.textContent = styleLabel(item, result); row.append(styleCell);
    labelResultRow(row, "wrestler-results"); fragment.append(row);
  });
  tbody.replaceChildren(fragment);
  $("#wrestler-empty").hidden = entries.length > 0;
  const alternatives = $("#same-name-options");
  alternatives.replaceChildren();
  [...alternativesById.values()].sort((a,b) => a.athlete.name.localeCompare(b.athlete.name,"fi")).forEach(({athlete: other, clubs}) => {
    const button = document.createElement("button");
    button.type = "button"; button.textContent = other.name + " · " + [...clubs].join(", ") + " · " + other.id;
    button.addEventListener("click", () => openProfile(other.id)); alternatives.append(button);
  });
  $("#same-name-clubs").hidden = alternativesById.size === 0;
}

function showView(view, focus = true, updateUrl = true) {
  if(featureViewNames.includes(view)&&!document.getElementById(view+"-view"))view="results";
  if (updateUrl) writeSectionRoute(view);
  document.title = defaultPageTitle;
  profileState = null;
  profileOpener = null;
  $("#wrestler-view").hidden = true;
  $("#search-view").hidden = view !== "results";
  $("#competition-view").hidden = view !== "competitions";
  if ($("#bouts-view")) $("#bouts-view").hidden = view !== "bouts";
  $("#nav-bouts")?.setAttribute("aria-pressed", String(view === "bouts"));
  $("#nav-results").setAttribute("aria-pressed", String(view === "results"));
  $("#nav-competitions").setAttribute("aria-pressed", String(view === "competitions"));
  if(document.getElementById("site-title"))$("#site-title").hidden=view==="home";
  if(document.getElementById("search-intro"))$("#search-intro").hidden=view!=="results";
  featureViewNames.forEach(name=>{const el=document.getElementById(name+"-view");if(el)el.hidden=view!==name;});
  ["home","clubs","compare"].forEach(name=>document.getElementById("nav-"+name)?.setAttribute("aria-pressed",String(view===name||name==="clubs"&&view==="club")));
  window.PAINI_FEATURES?.onView(view);
  if (view === "competitions") renderCompetitionList();
  if (view === "bouts") loadBouts();
  if (focus) $(featureViewNames.includes(view)?(view==="club"?"#club-title":"#"+view+"-heading"):view === "bouts" ? "#bouts-heading" : view === "results" ? "#results-heading" : "#competition-heading").focus();
}
function openCompetition(item) {
  $("#result-style").value = "";
  $("#competition").value = identity(item);
  $("#search").value = "";
  $("#club").value = "";
  $("#category").value = "";
  refreshFilters();
  showView("results");
}
const {searchWords, matchesSearchWords, matchesCompetitionQuery, competitionTier, yearlyPlacements} = window.PAINI_UTILS;
function renderCompetitionList() {
  const query = normalizePerson($("#competition-query").value);
  const sort = $("#competition-sort").value;
  const filtered = competitions.filter(item =>
    matchesCompetitionQuery(item.title + " " + item.details, query)
  );
  filtered.sort((a, b) => {
    if (sort === "importance") { const difference=competitionTier(a.title)-competitionTier(b.title); if(difference) return difference; }
    if (sort !== "name") {
      const left = competitionDate(a), right = competitionDate(b);
      if (left !== right) {
        if (left === -Infinity) return 1;
        if (right === -Infinity) return -1;
        return sort === "oldest" ? left - right : right - left;
      }
    }
    return a.title.localeCompare(b.title, "fi") || a.details.localeCompare(b.details, "fi");
  });
  const list = $("#competition-list");
  const fragment = document.createDocumentFragment();
  filtered.forEach(item => {
    const card = document.createElement("li");
    const title = document.createElement("h3");
    title.textContent = item.title;
    const details = document.createElement("p");
    details.className = "hint";
    details.textContent = item.details || "Päivämäärää ja paikkaa ei tunnistettu.";
    const counts = document.createElement("p");
    const clubs = new Set(item.rows.map(row => normalizePerson(row.club))).size;
    counts.textContent = item.rows.length + " tulosriviä · " + clubs + " seuraa";
    const origin = document.createElement("p");
    origin.className = "hint";
    origin.textContent = "Sivuston kilpailuaineisto";
    const actions = document.createElement("div");
    actions.className = "competition-actions";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "competition-open";
    button.textContent = "Näytä tulokset";
    button.setAttribute("aria-label", "Näytä tulokset: " + item.title + " " + item.details);
    button.addEventListener("click", () => openCompetition(item));
    actions.append(button);
    if (item.source) {
      try {
        const url = new URL(item.source);
        if (url.protocol === "https:" && url.hostname === "turniereklassisch.ringerdb.de") {
          const link = document.createElement("a");
          link.href = url.href; link.target = "_blank"; link.rel = "noopener noreferrer";
          link.textContent = "Alkuperäinen tulossivu ↗";
          actions.append(link);
        }
      } catch { /* Virheellistä lähdelinkkiä ei näytetä. */ }
    }
    card.append(title);
    if(partialNotes(item).length) {
      card.append(partialBadge(item));
      const hint=document.createElement("p");hint.className="hint";hint.textContent="Osa painoluokista puuttuu. Näytä tulokset nähdäksesi puuttuvat luokat.";card.append(hint);
    }
    card.append(details, counts, origin, actions);
    fragment.append(card);
  });
  list.replaceChildren(fragment);
  $("#competition-count").textContent = filtered.length + " kilpailua · " +
    filtered.reduce((sum, item) => sum + item.rows.length, 0) + " tulosriviä";
  $("#competition-empty").hidden = filtered.length > 0;
}

// Searchable competition chooser. Filtering never changes identities or source data.
function competitionPicker({inputId, rootId, listId, panelId, countId, allowAll, choose, changed}) {
  const input = document.getElementById(inputId), root = document.getElementById(rootId);
  const list = document.getElementById(listId), panel = document.getElementById(panelId), count = document.getElementById(countId);
  let choices = [], active = -1;
  function close() {
    panel.hidden = true; active = -1; input.setAttribute("aria-expanded","false");
    input.removeAttribute("aria-activedescendant");
    list.querySelectorAll('[aria-selected="true"]').forEach(option => option.setAttribute("aria-selected","false"));
  }
  function highlight(index) {
    if (!choices.length) return;
    active = (index + choices.length) % choices.length;
    [...list.children].forEach((option,i) => option.setAttribute("aria-selected",String(i === active)));
    const option = list.children[active]; input.setAttribute("aria-activedescendant",option.id);
    option.scrollIntoView({block:"nearest"});
  }
  function select(index) {
    if (index < 0 || index >= choices.length) return;
    const item = choices[index]; close(); choose(item);
  }
  function show() {
    const query = input.value.trim();
    const matches = competitions.filter(item => matchesCompetitionQuery(item.title+" "+item.details,query));
    const tokens = searchWords(query);
    const quality = item => {
      const words = searchWords(item.title+" "+item.details);
      return tokens.reduce((score,token) => score + (words.includes(token) ? 3 : words.some(word => word.startsWith(token)) ? 2 : words.some(word => word.includes(token)) ? 1 : 0),0);
    };
    matches.sort((a,b) => quality(b)-quality(a) || competitionDate(b)-competitionDate(a) || a.title.localeCompare(b.title,"fi") || a.details.localeCompare(b.details,"fi"));
    choices = allowAll && !query ? [null,...matches] : matches; active = -1;
    list.replaceChildren(); input.removeAttribute("aria-activedescendant");
    choices.forEach((item,index) => {
      const option = document.createElement("li"); option.id = listId+"-"+index;
      option.setAttribute("role","option"); option.setAttribute("aria-selected","false");
      const title = document.createElement("strong"); title.textContent = item?.title || "Kaikki kilpailut"; if(item)title.translate="no"; option.append(title);
      const details = document.createElement("span"); details.textContent = item ? item.details : "Poista kilpailurajaus"; if(item)details.translate="no"; option.append(details);
      option.addEventListener("mousedown",event => event.preventDefault());
      option.addEventListener("click",() => select(index)); list.append(option);
    });
    count.textContent = matches.length ? matches.length+" sopivaa kilpailua. Valitse kilpailu tai käytä nuolinäppäimiä ja Enteriä." : "Kilpailuja ei löytynyt. Kokeile lyhyempää hakua tai pelkkää paikkakuntaa.";
    panel.hidden = false; input.setAttribute("aria-expanded","true");
  }
  input.addEventListener("input",() => { if (changed) changed(); show(); });
  input.addEventListener("focus",show);
  input.addEventListener("click",() => { if (panel.hidden) show(); });
  input.addEventListener("keydown",event => {
    if (event.key === "Escape") { event.preventDefault(); close(); }
    else if (event.key === "Tab") close();
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); if (panel.hidden) show();
      highlight(active === -1 ? (event.key === "ArrowDown" ? 0 : choices.length-1) : active+(event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter" && !panel.hidden) { event.preventDefault(); select(active < 0 ? 0 : active); }
  });
  document.addEventListener("pointerdown",event => { if (!root.contains(event.target)) close(); });
  document.addEventListener("focusin",event => { if (!root.contains(event.target)) close(); });
  return {close};
}
const resultCompetitionPicker = competitionPicker({
  inputId:"competition-search",rootId:"competition-picker",listId:"competition-suggestions",panelId:"competition-suggestion-panel",countId:"competition-suggestion-count",allowAll:true,
  changed:() => { if ($("#competition").value) { $("#competition").value=""; refreshFilters(); } },
  choose:item => {
    $("#competition").value = item ? identity(item) : "";
    $("#competition-search").value = item ? item.title+" · "+item.details : "";
    refreshFilters();
  }
});
competitionPicker({
  inputId:"competition-query",rootId:"directory-picker",listId:"directory-suggestions",panelId:"directory-suggestion-panel",countId:"directory-suggestion-count",allowAll:false,
  choose:item => { if (item) openCompetition(item); }
});

document.querySelectorAll(".results-prev").forEach(button => button.addEventListener("click", () => {
  if (resultsPage === 0) return;
  resultsPage--; render(true); $("#results-heading").focus();
}));
document.querySelectorAll(".results-next").forEach(button => button.addEventListener("click", () => {
  if (resultsPage >= lastResultsPage) return;
  resultsPage++; render(true); $("#results-heading").focus();
}));
$("#reset-filters").addEventListener("click", () => {
  ["competition", "search", "club", "category", "result-style", "result-year"].forEach(id => {
    document.getElementById(id).value = "";
  });
  $("#result-sort").value = "newest";
  $("#competition-search").value = "";
  resultCompetitionPicker.close();
  refreshFilters();
});
$("#competition").addEventListener("change", refreshFilters);
$("#result-style").addEventListener("change", refreshFilters);
$("#result-year").addEventListener("change", refreshFilters);
$("#result-sort").addEventListener("change", render);
$("#search").addEventListener("input", render);
$("#club").addEventListener("change", render);
$("#category").addEventListener("change", render);
["home","clubs","compare"].forEach(view=>document.getElementById("nav-"+view)?.addEventListener("click",()=>showView(view)));
$("#nav-results").addEventListener("click", () => showView("results"));
$("#nav-competitions").addEventListener("click", () => showView("competitions"));
$('#nav-bouts')?.addEventListener('click',()=>showView('bouts'));
$('#bouts-retry')?.addEventListener('click',()=>loadBouts());
if ($('#nav-bouts')) $('#nav-bouts').disabled = !sharedReady || !registryReady;
$("#competition-query").addEventListener("input", renderCompetitionList);
$("#competition-sort").addEventListener("change", renderCompetitionList);
$("#back-to-results").addEventListener("click", closeProfile);
refresh();
if (sharedReady && !registryReady) status("Painijarekisteri ei latautunut. Tulokset näkyvät, mutta nimilinkit ovat poissa käytöstä. Päivitä sivu.", "error");
if (!sharedReady) status("Kilpailuaineisto ei latautunut. Päivitä sivu tai kokeile myöhemmin uudelleen.", "error");

function labelResultRow(row, bodyId) {
  const headers = document.getElementById(bodyId).closest("table").querySelectorAll("thead th");
  Array.from(row.cells).forEach((cell, index) => {
    cell.dataset.label = headers[index].textContent;
  });
}

function resultYear(item) {
  const date = competitionDate(item);
  return Number.isFinite(date) ? String(new Date(date).getUTCFullYear()) : "Ei päivämäärää";
}
function yearFilteredCompetitions() {
  const year = $("#result-year").value;
  return selectedCompetitions().filter(item => !year || resultYear(item) === year);
}
function compareResults(a, b, order) {
  if (order === "importance") { const difference = competitionTier(a.item.title)-competitionTier(b.item.title); if(difference) return difference; }
  if (order === "place" && a.result.place !== b.result.place) return a.result.place - b.result.place;
  const left = competitionDate(a.item), right = competitionDate(b.item);
  if (left !== right) {
    if (!Number.isFinite(left)) return 1;
    if (!Number.isFinite(right)) return -1;
    return order === "oldest" ? left - right : right - left;
  }
  // Samana päivänä säilytetään lähdeaineiston sarjajärjestys.
  return 0;
}

function resultStyle(item, row) {
  const code = item.categoryStyles?.[row.category];
  return ["greco", "freestyle", "women"].includes(code) ? code : "unknown";
}
function styleLabel(item, row) {
  return {greco:"Kreikkalais-roomalainen", freestyle:"Vapaapaini", women:"Naispaini", unknown:"Ei vahvistettu"}[resultStyle(item, row)];
}
// Stable share links use the site's own ID; source names and clubs stay out of the URL.
function profileAddress(athleteId) {
  // A file opened on the maintainer's Mac should still produce a public share link.
  const address = new URL(location.protocol === "file:" ? "https://oisparamia-sys.github.io/painijasivusto/" : location.href);
  address.search = "";
  address.hash = new URLSearchParams({painija:athleteId}).toString();
  return address.href;
}
function writeSectionRoute(view,replace=false){
  const address=new URL(location.href),custom=window.PAINI_FEATURES?.hashFor(view);
  address.hash=custom||(view==='home'?'':new URLSearchParams({nakyma:view}).toString());
  if(address.href!==location.href)try{history[replace?'replaceState':'pushState'](null,'',address.href);}catch{}
}
function writeProfileRoute(athleteId, replace = false) {
  const address = new URL(location.href);
  if (!athleteId && !new URLSearchParams(address.hash.slice(1)).has("painija")) return;
  address.hash = athleteId ? new URLSearchParams({painija:athleteId}).toString() : "";
  if (address.href === location.href) return;
  try { history[replace ? "replaceState" : "pushState"](null,"",address.href); }
  catch { /* A restricted local preview can still display the shareable address. */ }
}
function clearProfileLinkError() {
  if ($("#status").dataset.reason === "profile-link") {
    $("#status").hidden = true; $("#status").textContent = ""; delete $("#status").dataset.reason;
  }
}
function routeProfileFromUrl() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (!params.has("painija") && params.has("kilpailu")) {
    const item = competitions.find(c => identity(c) === params.get("kilpailu"));
    // Open a link from an error report, then remove the route so later filter
    // changes do not leave a misleading competition link in the address bar.
    history.replaceState(history.state, "", location.pathname + location.search);
    if (item) { clearProfileLinkError(); openCompetition(item); }
    else {
      showView("results",false,false);
      status("Linkin kilpailua ei löytynyt. Voit etsiä sitä kilpailun nimellä.","error");
      $("#status").dataset.reason = "profile-link";
    }
    return;
  }
  if (!params.has("painija")) {
    clearProfileLinkError();
    if(params.has('seura')){if(!window.PAINI_FEATURES.openClub(params.get('seura'),false))showView('clubs',false,false);return;}
    const view=params.get('nakyma');showView(['results','competitions','bouts',...featureViewNames].includes(view)?view:document.getElementById('home-view')?'home':'results',false,false);return;
  }
  if (!registryReady) return;
  const requested = params.get("painija");
  const resolved = /^painija-\d{6,}$/.test(requested) ? window.PainiRegistry.resolve(sharedData,requested) : null;
  const person = athleteRecords.get(resolved);
  if (!person || person.mergedInto) {
    showView("results",false,false);
    status("Linkin painijatunnusta ei löytynyt tästä aineistosta. Voit etsiä painijaa nimellä tai avata toisen linkin.","error");
    $("#status").dataset.reason = "profile-link"; return;
  }
  if (profileState?.athleteId !== resolved) openProfile(resolved,null,false);
  clearProfileLinkError();
  if (resolved !== requested) writeProfileRoute(resolved,true);
}
$("#copy-wrestler-link").addEventListener("click",async () => {
  if (!profileState) return;
  const athleteId = profileState.athleteId;
  const address = profileAddress(athleteId);
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(address);
    if (profileState?.athleteId !== athleteId) return;
    $("#share-status").textContent = "Painijan linkki kopioitu. Voit liittää sen viestiin.";
  } catch {
    if (profileState?.athleteId !== athleteId) return;
    const input = $("#wrestler-share-url"); input.focus(); input.select();
    $("#share-status").textContent = "Kopioi valittu osoite käsin ja liitä se viestiin.";
  }
});
window.addEventListener("popstate",routeProfileFromUrl);
window.addEventListener("hashchange",routeProfileFromUrl);
window.PAINI_FEATURES.init({data:sharedData,showView,openProfile,openCompetition,date:competitionDate,year:resultYear,search:refreshFilters});
routeProfileFromUrl();

$("#wrestler-report-error").addEventListener("click", event => {
  if (!profileState || typeof window.PAINI_OPEN_FEEDBACK !== "function") return;
  const person = athleteRecords.get(profileState.athleteId);
  window.PAINI_OPEN_FEEDBACK({label:"Painija: " + person.name + " (" + person.id + ")", url:profileAddress(person.id)}, event.currentTarget);
});
$("#competition-report-error").addEventListener("click", event => {
  const item = competitions.find(c => identity(c) === $("#competition").value);
  if (!item || typeof window.PAINI_OPEN_FEEDBACK !== "function") return;
  const address = new URL(profileAddress(""));
  address.hash = new URLSearchParams({kilpailu:identity(item)}).toString();
  window.PAINI_OPEN_FEEDBACK({label:"Kilpailu: " + item.title + " · " + item.details, url:address.href}, event.currentTarget);
});
window.addEventListener("paini-feedback-ready", () => {
  $("#competition-report-error").hidden = !$("#competition").value;
  $("#wrestler-report-error").hidden = !profileState;
});

function renderYearlyPlacements(entries) {
  const years = yearlyPlacements(entries, resultYear);
  const max = Math.max(1, ...years.map(row => row.total));
  const bars = $("#yearly-bars"), body = $("#yearly-rows");
  bars.replaceChildren(); body.replaceChildren();
  for (const row of years) {
    const line=document.createElement("div"); line.className="yearly-line";
    const year=document.createElement("span"); year.textContent=row.year;
    const track=document.createElement("div"); track.className="yearly-track";
    row.counts.forEach((count,index)=>{const segment=document.createElement("span");segment.className="yearly-segment yearly-place-"+index;segment.style.width=(count/max*100)+"%";track.append(segment);});
    const total=document.createElement("strong");total.textContent=row.total;
    line.append(year,track,total);bars.append(line);
    const tr=document.createElement("tr");
    [row.year,...row.counts,row.total].forEach((value,index)=>{const cell=document.createElement(index?"td":"th");if(!index)cell.scope="row";cell.textContent=value;tr.append(cell);});body.append(tr);
  }
}
$("#wrestler-sort").addEventListener("change",()=>{if(profileState){profileState.sort=$("#wrestler-sort").value;renderProfile();}});

function renderPlacementChart(entries) {
  const labels = ["Voitot (1. sija)", "2. sija", "3. sija", "Muut sijoitukset"];
  const colors = ["#b58113", "#64748b", "#b86a38", "#2456aa"];
  const counts = [0, 0, 0, 0];
  entries.forEach(({result}) => counts[Math.min(result.place, 4)-1]++);
  const total = entries.length;
  const ring = $("#placement-ring");
  const legend = $("#placement-legend");
  legend.replaceChildren();
  $("#placement-total").textContent = String(total);
  $("#placement-empty").hidden = total > 0;
  ring.hidden = total === 0;
  legend.hidden = total === 0;
  let angle = 0;
  const segments = [];
  const descriptions = [];
  counts.forEach((count, index) => {
    const percent = total ? count/total*100 : 0;
    const formatted = new Intl.NumberFormat("fi-FI", {maximumFractionDigits: 1}).format(percent);
    if (count) {
      segments.push(colors[index] + " " + angle + "% " + (angle+percent) + "%");
      angle += percent;
    }
    const li = document.createElement("li");
    const swatch = document.createElement("span");
    swatch.className = "placement-swatch";
    swatch.style.backgroundColor = colors[index];
    swatch.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.textContent = labels[index] + ": " + count + " (" + formatted + " %)";
    li.append(swatch, text); legend.append(li);
    descriptions.push(text.textContent);
  });
  ring.style.background = total ? "conic-gradient(" + segments.join(", ") + ")" : "none";
  ring.setAttribute("aria-label", total + " tulosta. " + descriptions.join(". "));
}

$("#wrestler-year").addEventListener("change", () => {
  if (!profileState) return;
  profileState.year = $("#wrestler-year").value;
  renderProfile();
});

function partialNotes(item) {
  return Array.isArray(item.importNotes) ? item.importNotes.filter(note=>note && typeof note.category === "string" && typeof note.weight === "string") : [];
}
function partialBadge(item) {
  const badge=document.createElement("span");badge.className="partial-results-badge";badge.textContent="Tulokset osittaiset";
  badge.setAttribute("title", "Kilpailusta puuttuvat: " + partialNotes(item).map(n=>n.category+" "+n.weight+" kg").join(", "));
  return badge;
}
function originalResultsLink(item) {
  try {
    const url=new URL(item.source);if(url.protocol!=="https:"||url.hostname!=="turniereklassisch.ringerdb.de")return null;
    const a=document.createElement("a");a.href=url.href;a.target="_blank";a.rel="noopener noreferrer";a.textContent="Katso alkuperäinen tulossivu ↗";return a;
  }catch{return null;}
}

// One refresh in this tab may restore UI selections; shared profile links stay independent.
const refreshResultFields = ["competition", "competition-search", "result-style", "result-year", "result-sort", "search", "club", "category"];
window.PAINI_PAGE_STATE = Object.freeze({
  capture() {
    if (profileState) return null;
    const view = featureViewNames.find(name=>document.getElementById(name+"-view")&&!document.getElementById(name+"-view").hidden)||(!$("#bouts-view").hidden ? "bouts" : !$("#competition-view").hidden ? "competitions" : "results");
    return {view, features:window.PAINI_FEATURES?.capture(),bouts:pendingBoutsState || window.PAINI_BOUTS?.getState(), results:Object.fromEntries(refreshResultFields.map(id=>[id,document.getElementById(id).value])), page:resultsPage,
      directory:{query:$("#competition-query").value,sort:$("#competition-sort").value}};
  },
  async restore(state) {
    if (!state || !["results", "competitions", "bouts",...featureViewNames].includes(state.view)) return false;
    if (new URLSearchParams(location.hash.slice(1)).has("painija")) return false;
    const saved = state.results || {};
    const set = id => {
      const value=saved[id],element=document.getElementById(id);
      if (typeof value === "string") element.value=value;
    };
    ["competition", "result-style", "result-year"].forEach(set);refreshFilters();
    ["result-sort", "search", "club", "category", "competition-search"].forEach(set);
    resultsPage=Number.isSafeInteger(state.page)&&state.page>=0?state.page:0;render(true);
    if (typeof state.directory?.query === "string") $("#competition-query").value=state.directory.query;
    if (typeof state.directory?.sort === "string") $("#competition-sort").value=state.directory.sort;
    if (state.view === "bouts") pendingBoutsState=state.bouts || null;
    window.PAINI_FEATURES?.restore(state.features);
    showView(state.view,false,false);
    return state.view === "bouts" ? await loadBouts() : true;
  }
});
