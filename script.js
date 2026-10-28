"use strict";
const $ = selector => document.querySelector(selector);
const sharedData = window.PAINI_SHARED_DATA;
const sharedReady = sharedData && sharedData.version === 1 &&
  Array.isArray(sharedData.competitions) && sharedData.competitions.every(valid) &&
  new Set(sharedData.competitions.map(identity)).size === sharedData.competitions.length;
const sharedCompetitions = sharedReady ? sharedData.competitions : [];
const competitions = [...sharedCompetitions];
let registryReady = false;
try { window.PainiRegistry.validate(sharedData); registryReady = true; } catch { /* Results remain readable if the registry has not loaded. */ }
const athleteRecords = new Map((registryReady ? sharedData.athleteRegistry.athletes : []).map(a => [a.id, a]));

let profileState = null;
let profileOpener = null;
let resultsScroll = null;
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
  refreshFilters();
}
function selectedCompetitions() {
  const selected = $("#competition").value;
  return selected ? competitions.filter(item => identity(item) === selected) : competitions;
}
function refreshFilters() {
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
  const rows = items.flatMap(item => item.rows.filter(row => matchesStyle(item, row)));
  options($("#club"), rows.map(row => row.club), "Kaikki seurat");
  options($("#category"), rows.map(row => row.category), "Kaikki ikäluokat");
  $("#selection").textContent = items.length === 1
      ? "Valittuna: " + items[0].title + (items[0].details ? " · " + items[0].details : "")
      : "Haussa mukana " + items.length + " kilpailua.";
  $("#data-summary").textContent = sharedCompetitions.length + " yhteistä kilpailua, " +
    sharedCompetitions.reduce((sum, item) => sum + item.rows.length, 0) +
    " tulosta.";
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
    text.textContent = "Mukana ovat kokonaan sijoitetut painoluokat. Seuraavat painoluokat puuttuvat, koska lähteestä puuttuu osallistujien sijoituksia:";
    const list = document.createElement("ul");
    partialNotes(item).forEach(note=>{
      const li = document.createElement("li");
      li.textContent = note.category + " · " + note.weight + " kg";
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
  const query = $("#search").value.trim().toLocaleLowerCase("fi");
  const fragment = document.createDocumentFragment();
  const entries = yearFilteredCompetitions().flatMap(item => item.rows.map(result => ({item, result}))).filter(({item,result}) =>
    matchesStyle(item,result) &&
    (matchesCompetitionQuery(result.name, query) || matchesCompetitionQuery(athleteRecords.get(result.athleteId)?.name || "", query)) &&
    (!$("#club").value || result.club === $("#club").value) &&
    (!$("#category").value || result.category === $("#category").value)
  );
  entries.sort(compareResults);
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
          td.textContent = value; if(index === 3 && partialNotes(item).length)td.append(partialBadge(item)); row.append(td);
        });
      labelResultRow(row, "results");
      fragment.append(row);
  });
  $("#results").replaceChildren(fragment);
  $("#count").textContent = count === 1 ? "1 tulos" : count + " tulosta";
  $("#empty").hidden = count > 0;
  if (profileState) renderProfile();
  renderCompetitionList();
}
function normalizePerson(value) {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("fi");
}
function profileCompetitions() {
  return competitions;
}
function competitionDate(item) {
  const match = (item.details || item.title).match(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/);
  if (!match) return -Infinity;
  const day = Number(match[1]), month = Number(match[2]), year = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? timestamp : -Infinity;
}
function openProfile(athleteId, opener = null, updateUrl = true) {
  if (!registryReady) return;
  athleteId = window.PainiRegistry.resolve(sharedData, athleteId);
  if (!athleteId || !athleteRecords.has(athleteId)) return;
  restoreGeneration++;
  if (!profileState) resultsScroll = {x: window.scrollX, y: window.scrollY};
  if (opener) profileOpener = opener;
  clearProfileLinkError();
  profileState = { athleteId, year: "" };
  if (updateUrl) writeProfileRoute(athleteId);
  $("#search-view").hidden = true;
  $("#competition-view").hidden = true;
  $("#nav-results").setAttribute("aria-pressed", "true");
  $("#nav-competitions").setAttribute("aria-pressed", "false");
  $("#wrestler-view").hidden = false;
  renderProfile();
  $("#wrestler-title").focus();
}
function closeProfile(updateUrl = true) {
  if (updateUrl) writeProfileRoute(null);
  document.title = defaultPageTitle;
  profileState = null;
  $("#wrestler-view").hidden = true;
  $("#search-view").hidden = false;
  const target = profileOpener?.isConnected ? profileOpener : $("#search");
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
  entries.sort((a, b) => {
    const left = competitionDate(a.item), right = competitionDate(b.item);
    if (left !== right) return left > right ? -1 : 1;
    return a.item.title.localeCompare(b.item.title, "fi") || a.result.place - b.result.place;
  });
  $("#wrestler-title").textContent = athlete.name;
  document.title = athlete.name + " – Painijatulokset";
  $("#wrestler-share-url").value = profileAddress(athlete.id);
  $("#share-status").textContent = "";
  $("#wrestler-id").textContent = athlete.id + " · " + (athlete.status === "reviewed" ? "Ylläpito tarkistanut yhdistämisen" : "Tarkistamaton tulosryhmä");
  $("#wrestler-aliases").textContent = "Nimet lähdetuloksissa: " + [...originalNames].join(", ");
  $("#wrestler-club").textContent = "Seurat tuloksissa: " + [...new Set(entries.map(e => e.result.club))].sort((a,b) => a.localeCompare(b,"fi")).join(", ");
  $("#wrestler-scope").textContent = (profileState.year ? (profileState.year === "Ei päivämäärää" ? "Tulokset ilman tunnistettua päivämäärää." : "Vuoden " + profileState.year + " tulokset.") : "Kaikkien vuosien tulokset.") + " Yhteenveto, kuvaaja ja tuloslista koskevat valittua vuotta. Päähaun rajaukset eivät vaikuta tähän näkymään.";
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
  const tbody = $("#wrestler-results");
  const fragment = document.createDocumentFragment();
  entries.forEach(({item, result}) => {
    const row = document.createElement("tr"), cell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "place " + ({1:"gold",2:"silver",3:"bronze"}[result.place] || "");
    badge.textContent = result.place + ".";
    cell.append(badge); row.append(cell);
    [item.title, item.details || "–", result.category, result.weight + " kg"].forEach((value,index) => {
      const td = document.createElement("td"); td.textContent = value; if(index === 0 && partialNotes(item).length)td.append(partialBadge(item)); row.append(td);
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
  if (updateUrl) writeProfileRoute(null);
  document.title = defaultPageTitle;
  profileState = null;
  profileOpener = null;
  $("#wrestler-view").hidden = true;
  $("#search-view").hidden = view !== "results";
  $("#competition-view").hidden = view !== "competitions";
  $("#nav-results").setAttribute("aria-pressed", String(view === "results"));
  $("#nav-competitions").setAttribute("aria-pressed", String(view === "competitions"));
  if (view === "competitions") renderCompetitionList();
  if (focus) $(view === "results" ? "#results-heading" : "#competition-heading").focus();
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
// Approximate matching filters visible results only; it never changes athlete identities.
function searchWords(value) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("fi").match(/[\p{L}\p{N}]+/gu) || [];
}
function wordDistance(a, b) {
  const rows = Array.from({length: a.length + 1}, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    rows[i][j] = Math.min(rows[i-1][j]+1, rows[i][j-1]+1, rows[i-1][j-1]+(a[i-1] === b[j-1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i-1] === b[j-2] && a[i-2] === b[j-1])
      rows[i][j] = Math.min(rows[i][j], rows[i-2][j-2]+1);
  }
  return rows[a.length][b.length];
}
function matchesCompetitionQuery(text, query) {
  const words = searchWords(text);
  return searchWords(query).every(token => words.some(word => {
    if (/\d/u.test(token)) return word.startsWith(token);
    if (word.includes(token)) return true;
    if (token.length < 3 || /\d/u.test(token) || /\d/u.test(word)) return false;
    const tolerance = token.length >= 7 ? 2 : 1;
    return Math.abs(word.length-token.length) <= tolerance && wordDistance(token,word) <= tolerance;
  }));
}
function renderCompetitionList() {
  const query = normalizePerson($("#competition-query").value);
  const sort = $("#competition-sort").value;
  const filtered = competitions.filter(item =>
    matchesCompetitionQuery(item.title + " " + item.details, query)
  );
  filtered.sort((a, b) => {
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
  refreshFilters();
});
$("#competition").addEventListener("change", refreshFilters);
$("#result-style").addEventListener("change", refreshFilters);
$("#result-year").addEventListener("change", refreshFilters);
$("#result-sort").addEventListener("change", render);
$("#search").addEventListener("input", render);
$("#club").addEventListener("change", render);
$("#category").addEventListener("change", render);
$("#nav-results").addEventListener("click", () => showView("results"));
$("#nav-competitions").addEventListener("click", () => showView("competitions"));
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
function compareResults(a, b) {
  const order = $("#result-sort").value;
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
function matchesStyle(item, row) {
  return !$("#result-style").value || resultStyle(item, row) === $("#result-style").value;
}

// Stable share links use the site's own ID; source names and clubs stay out of the URL.
function profileAddress(athleteId) {
  // A file opened on the maintainer's Mac should still produce a public share link.
  const address = new URL(location.protocol === "file:" ? "https://oisparamia-sys.github.io/painijasivusto/" : location.href);
  address.search = "";
  address.hash = new URLSearchParams({painija:athleteId}).toString();
  return address.href;
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
  if (!params.has("painija")) { clearProfileLinkError(); if (profileState) closeProfile(false); return; }
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
routeProfileFromUrl();

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
