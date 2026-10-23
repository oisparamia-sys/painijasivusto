"use strict";
    function parseLigaDB(text) {
      const lines = text.replace(/^\uFEFF/, "").replace(/\0/g, "").replace(/\r\n?/g, "\n").split("\n");
      const firstGroup = lines.findIndex(line => /^\s*\d+(?:[.,]\d+)?\s*kg\s*\t/i.test(line));
      if (firstGroup < 0) throw new Error("Sarjoja ei löytynyt. Valitse nimenomaan tab-eroteltu tulosluettelo, ei ottelutiedostoa tai HTML-sivua.");
      const header = lines.slice(0, firstGroup).map(line => line.trim()).filter(Boolean);
      if (!header.length) throw new Error("Tiedostosta puuttuu kilpailun nimi.");
      const dateLine = header.find(line => /\d{1,2}\.\d{1,2}\.\d{4}/.test(line) && line !== header[0]) || "";
      const rows = [];
      const seen = new Set();
      let group = null;
      let skipped = 0;
      const unexpected = [];

      lines.slice(firstGroup).forEach((line, index) => {
        if (!line.trim()) return;
        const cells = line.split("\t").map(cell => cell.trim());
        if (/^\s*\d+(?:[.,]\d+)?\s*kg\s*\t/i.test(line)) {
          const weight = cells[0].match(/^(\d+(?:[.,]\d+)?)\s*kg$/i);
          if (!weight || !cells[1]) throw new Error("Yhden sarjan painoluokka tai ikäluokka puuttuu.");
          group = { weight: weight[1].replace(",", "."), category: cells[1] };
          return;
        }
        while (cells.length && cells[0] === "") cells.shift();
        if (!cells.length) return;
        if (/^tyhj[äa]$/i.test(cells[0])) { skipped++; return; }
        const place = cells[0].match(/^(\d+)\.$/);
        if (!group || !place || cells.length < 3 || !cells[1] || !cells[2] || Number(place[1]) < 1) {
          unexpected.push(firstGroup + index + 1);
          return;
        }
        const row = { place: Number(place[1]), name: cells[1], club: cells[2], ...group };
        const key = JSON.stringify(row);
        if (seen.has(key)) { skipped++; return; }
        seen.add(key);
        rows.push(row);
      });

      if (unexpected.length) throw new Error("Tiedoston rivin " + unexpected[0] + " rakennetta ei tunnistettu. Tuonti keskeytettiin, jotta tuloksia ei jäisi huomaamatta pois.");
      if (!rows.length) throw new Error("Tiedostosta ei löytynyt sijoituksia. Kilpailussa saattaa olla vasta osallistujalistat.");
      return { title: header[0], details: dateLine, rows, skipped };
    }

    function decodeFile(buffer) {
      try { return { text: new TextDecoder("utf-8", { fatal: true }).decode(buffer), encoding: "UTF-8" }; }
      catch { return { text: new TextDecoder("windows-1252").decode(buffer), encoding: "Windows-1252" }; }
    }

    const demoGroups = [
      ["Pojat U12",23,[["Keyan Nazari","TaPs"],["Topias Miikki","TaPs"]]],
      ["Pojat U12",30,[["Noel Kontuniemi","TaPs"],["Alex Ahonen","TaPs"],["Daniel Karimi","TaPs"],["Elias Kannisto","TaPs"],["Alvar Lehtonen","TaPs"]]],
      ["Pojat U12",37,[["Matias Nieminen","TaPs"],["Elias Seifi","KOOVEE"],["Darin Zarai","TaPs"],["Kaarlo Hyödynmaa","TaPs"],["Darek Kampus","TaPs"]]],
      ["Pojat U12",41,[["Leo Kannisto","TaPs"],["Feliks Tuomonen","TaPs"],["Frans Tuomonen","TaPs"]]],
      ["Pojat U12",52,[["Olavi Vartia","TaPs"],["Kaspar Kampus","TaPs"],["Niyaz Nazari","TaPs"]]],
      ["Tytöt ja pojat U17",40,[["Kasperi Kulmala","TaPs"],["Nathan Czerniawski","JPI"],["Eelis Wihinen","TaPs"],["Joel Olan","TaPs"]]],
      ["Tytöt ja pojat U17",48,[["Alba Czerniawska","JPI"],["Leo Niukkonen","TaPs"]]],
      ["Tytöt ja pojat U17",57,[["Ilari Kulmala","TaPs"],["Jasmin Eronen","TaPs"],["Blanca Czerniawska","JPI"]]],
      ["Tytöt ja Pojat U12",25,[["Hilda Vartia","TaPs"],["Kaihan Nabizada","TaPs"],["Rohan Nabizada","TaPs"],["Joona Pekkanen","TaPs"]]],
      ["Tytöt ja Pojat U12",26,[["Hugo Leponen","TaPs"],["Veeti Försti","TaPs"],["Meri Eronen","TaPs"],["Otso Koskela","TaPs"]]]
    ];
    const clubs = { TaPs: "Tampereen Painiseura", JPI: "Janakkalan Paini-Ilves" };
    const demo = {
      title: "TaPs painit 4.12.2025", details: "Tampere, 4.12.2025",
      source: "https://turniereklassisch.ringerdb.de/VT/2025/FI/251204_Tampere/indexFIN.htm",
      fileInfo: "Tallennettu esimerkkikilpailu · 35 tulosta · ei automaattista päivitystä",
      rows: demoGroups.flatMap(([category, weight, wrestlers]) => wrestlers.map(([name, club], index) => ({ name, club: clubs[club] || club, category, weight: String(weight), place: index + 1 })))
    };

const $ = selector => document.querySelector(selector);
const KEY = "painijatulokset.competitions.v2";
const OLD_KEY = "painijatulokset.saved-competition.v1";
let localCompetitions = [];
const sharedData = window.PAINI_SHARED_DATA;
const sharedReady = sharedData && sharedData.version === 1 &&
  Array.isArray(sharedData.competitions) && sharedData.competitions.every(valid) &&
  new Set(sharedData.competitions.map(identity)).size === sharedData.competitions.length;
const sharedCompetitions = sharedReady ? sharedData.competitions : [];
let competitions = [...sharedCompetitions];

function combined(items = localCompetitions) {
  const merged = new Map(sharedCompetitions.map(item => [identity(item), item]));
  items.forEach(item => {
    const previous = merged.get(identity(item));
    merged.set(identity(item), { ...item, source: previous?.source || "" });
  });
  return [...merged.values()];
}
let importNumber = 0;
let importing = false;
let profileState = null;
let profileOpener = null;

function status(message, kind = "") {
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
function save(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: 2, competitions: items }));
    return true;
  } catch { return false; }
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
  select.add(new Option("TaPs-esimerkki", "demo"));
  select.value = selected;
  if (!competitions.length) select.value = "demo";
  refreshFilters();
}
function selectedCompetitions() {
  const selected = $("#competition").value;
  if (selected === "demo") return [demo];
  return selected ? competitions.filter(item => identity(item) === selected) : competitions;
}
function refreshFilters() {
  const items = selectedCompetitions();
  const rows = items.flatMap(item => item.rows);
  options($("#club"), rows.map(row => row.club), "Kaikki seurat");
  options($("#category"), rows.map(row => row.category), "Kaikki ikäluokat");
  $("#delete").disabled = importing || !localCompetitions.some(item => identity(item) === $("#competition").value);
  $("#selection").textContent = $("#competition").value === "demo"
    ? "Näytössä on esimerkkikilpailu. Omat kilpailusi säilyvät tallessa."
    : items.length === 1
      ? "Valittuna: " + items[0].title + (items[0].details ? " · " + items[0].details : "")
      : "Haussa mukana " + items.length + " kilpailua.";
  $("#data-summary").textContent = sharedCompetitions.length + " yhteistä kilpailua, " +
    sharedCompetitions.reduce((sum, item) => sum + item.rows.length, 0) +
    " tulosta. Omia tuonteja tässä selaimessa: " + localCompetitions.length + ".";
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
  render();
}
function render() {
  const query = $("#search").value.trim().toLocaleLowerCase("fi");
  const fragment = document.createDocumentFragment();
  let count = 0;
  selectedCompetitions().forEach(item => {
    item.rows.forEach(result => {
      if (!result.name.toLocaleLowerCase("fi").includes(query) ||
        ($("#club").value && result.club !== $("#club").value) ||
        ($("#category").value && result.category !== $("#category").value)) return;
      count++;
      const row = document.createElement("tr");
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
      nameButton.dataset.name = normalizePerson(result.name);
      nameButton.dataset.club = normalizePerson(result.club);
      nameButton.setAttribute("aria-label", "Näytä tulokset: " + result.name + ", " + result.club);
      nameButton.addEventListener("click", () => openProfile(result.name, result.club,
        $("#competition").value === "demo", nameButton));
      nameCell.append(nameButton); row.append(nameCell);
      [result.club, result.category, result.weight + " kg", item.title, item.details || "–"]
        .forEach(value => {
          const td = document.createElement("td");
          td.textContent = value; row.append(td);
        });
      fragment.append(row);
    });
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
  return profileState.demoOnly ? [demo] : competitions;
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
function openProfile(name, club, demoOnly = false, opener = null) {
  if (opener) profileOpener = opener;
  profileState = { name, club, demoOnly };
  $("#search-view").hidden = true;
  $("#competition-view").hidden = true;
  $("#nav-results").setAttribute("aria-pressed", "true");
  $("#nav-competitions").setAttribute("aria-pressed", "false");
  $("#wrestler-view").hidden = false;
  renderProfile();
  $("#wrestler-title").focus();
}
function closeProfile() {
  profileState = null;
  $("#wrestler-view").hidden = true;
  $("#search-view").hidden = false;
  const target = profileOpener?.isConnected ? profileOpener : $("#search");
  target.focus();
  profileOpener = null;
}
function renderProfile() {
  if (!profileState) return;
  const nameKey = normalizePerson(profileState.name);
  const clubKey = normalizePerson(profileState.club);
  const entries = [];
  const otherClubs = new Map();
  profileCompetitions().forEach(item => {
    item.rows.forEach(result => {
      if (normalizePerson(result.name) !== nameKey) return;
      if (normalizePerson(result.club) === clubKey) entries.push({ item, result });
      else otherClubs.set(normalizePerson(result.club), result.club);
    });
  });
  entries.sort((a, b) => {
    const left = competitionDate(a.item), right = competitionDate(b.item);
    if (left !== right) return left > right ? -1 : 1;
    return a.item.title.localeCompare(b.item.title, "fi") || a.result.place - b.result.place;
  });
  $("#wrestler-title").textContent = profileState.name;
  $("#wrestler-club").textContent = profileState.club;
  $("#wrestler-scope").textContent = profileState.demoOnly
    ? "Yhteenveto esimerkkikilpailusta."
    : "Yhteenveto kaikista tämän sivun yhteisistä kilpailuista ja omista tuonneistasi. Haun rajaukset eivät rajoita tätä näkymää.";
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
  const tbody = $("#wrestler-results");
  const fragment = document.createDocumentFragment();
  entries.forEach(({item, result}) => {
    const row = document.createElement("tr"), cell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "place " + ({1:"gold",2:"silver",3:"bronze"}[result.place] || "");
    badge.textContent = result.place + ".";
    cell.append(badge); row.append(cell);
    [item.title, item.details || "–", result.category, result.weight + " kg"].forEach(value => {
      const td = document.createElement("td"); td.textContent = value; row.append(td);
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
    row.append(sourceCell); fragment.append(row);
  });
  tbody.replaceChildren(fragment);
  $("#wrestler-empty").hidden = entries.length > 0;
  const alternatives = $("#same-name-options");
  alternatives.replaceChildren();
  [...otherClubs.values()].sort((a,b) => a.localeCompare(b,"fi")).forEach(club => {
    const button = document.createElement("button");
    button.type = "button"; button.textContent = club;
    button.addEventListener("click", () => openProfile(profileState.name, club, profileState.demoOnly));
    alternatives.append(button);
  });
  $("#same-name-clubs").hidden = otherClubs.size === 0;
}

function showView(view, focus = true) {
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
  $("#competition").value = identity(item);
  $("#search").value = "";
  $("#club").value = "";
  $("#category").value = "";
  refreshFilters();
  showView("results");
}
function renderCompetitionList() {
  const query = normalizePerson($("#competition-query").value);
  const sort = $("#competition-sort").value;
  const filtered = competitions.filter(item =>
    normalizePerson(item.title + " " + item.details).includes(query)
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
    const isShared = sharedCompetitions.some(shared => identity(shared) === identity(item));
    const isLocal = localCompetitions.some(local => identity(local) === identity(item));
    origin.textContent = isShared
      ? isLocal ? "Yhteinen kilpailu · oma tuontiversio käytössä" : "Yhteinen kilpailu"
      : "Oma tuonti · vain tässä selaimessa";
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
    card.append(title, details, counts, origin, actions);
    fragment.append(card);
  });
  list.replaceChildren(fragment);
  $("#competition-count").textContent = filtered.length + " kilpailua · " +
    filtered.reduce((sum, item) => sum + item.rows.length, 0) + " tulosriviä";
  $("#competition-empty").hidden = filtered.length > 0;
}

function restore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) {
      const saved = JSON.parse(raw);
      if (saved.version !== 2 || !Array.isArray(saved.competitions) ||
        !saved.competitions.every(valid) ||
        new Set(saved.competitions.map(identity)).size !== saved.competitions.length) {
        throw new Error("Virheellinen tallennus");
      }
      localCompetitions = saved.competitions;
      if (localCompetitions.length) status("Omat tuonnit palautettiin. Yhteiset kilpailut ovat myös mukana haussa.", "success");
    } else {
      const oldRaw = localStorage.getItem(OLD_KEY);
      if (oldRaw) {
        const old = JSON.parse(oldRaw);
        if (old.version !== 1 || !valid(old.competition)) throw new Error("Virheellinen vanha tallennus");
        localCompetitions = [old.competition];
        status(save(localCompetitions)
          ? "Aiempi kilpailusi siirrettiin uuteen tallennukseen. Voit tuoda lisää kilpailuja."
          : "Aiempi kilpailusi palautettiin näkyviin, mutta uuden tallennuksen luominen ei onnistunut.",
          "success");
      }
    }
  } catch {
    status("Omia tallennuksia ei voitu lukea. Yhteiset tulokset ovat silti käytettävissä. Voit tuoda omat tiedostosi uudelleen.", "error");
  }
  competitions = combined();
  refresh();
  if (!sharedReady) status("Yhteinen kilpailuaineisto ei latautunut. Varmista, että data.js on samassa kansiossa ja päivitä sivu.", "error");
}
$("#file").addEventListener("change", async event => {
  const files = [...event.target.files];
  if (!files.length || importing) return;
  const request = ++importNumber;
  importing = true;
  event.target.disabled = true;
  $("#delete").disabled = true;
  const next = new Map(localCompetitions.map(item => [identity(item), item]));
  const known = new Set(competitions.map(identity));
  const errors = [];
  let added = 0, updated = 0, imported = 0;
  try {
    for (const [index, file] of files.entries()) {
      status("Luetaan tiedostoa " + (index + 1) + "/" + files.length + ": " + file.name);
      try {
        if (!/\.(txt|tsv)$/i.test(file.name)) throw new Error("Valitse .txt- tai .tsv-tiedosto.");
        if (file.size > 5 * 1024 * 1024) throw new Error("Tiedoston enimmäiskoko on 5 Mt.");
        const decoded = decodeFile(await file.arrayBuffer());
        if (request !== importNumber) return;
        const parsed = parseLigaDB(decoded.text);
        const item = { ...parsed, source: "", fileInfo: file.name + " · " + decoded.encoding };
        const id = identity(item);
        if (known.has(id)) updated++;
        else added++;
        known.add(id);
        next.set(id, item);
        imported++;
      } catch (error) {
        errors.push(file.name + ": " + error.message);
      }
    }
    if (!imported) {
      status("Yhtäkään tiedostoa ei tuotu. Aiemmat kilpailut ja tallennus säilyivät. " + errors.join(" | "), "error");
      return;
    }
    const items = [...next.values()];
    const saved = save(items);
    localCompetitions = items;
    competitions = combined();
    $("#search").value = "";
    $("#club").value = "";
    $("#category").value = "";
    refresh();
    status("Tuotu " + imported + "/" + files.length + " tiedostoa. Lisättyjä kilpailuja: " + added +
      ". Päivityksiä: " + updated + ". Kilpailuja yhteensä: " + competitions.length + ". " +
      (saved ? "Tallennettu tähän selaimeen."
        : "Tallennus ei onnistunut. Muutokset näkyvät vain sivun aukiolon ajan. Aiempi tallennus säilyi.") +
      (errors.length ? " Epäonnistuneet tiedostot: " + errors.join(" | ") : ""),
      saved && !errors.length ? "success" : "error");
  } finally {
    if (request === importNumber) {
      importing = false;
      event.target.disabled = false;
      event.target.value = "";
      refreshFilters();
    }
  }
});
$("#delete").addEventListener("click", () => {
  if (importing) return;
  const id = $("#competition").value;
  if (!localCompetitions.some(item => identity(item) === id)) return;
  const next = localCompetitions.filter(item => identity(item) !== id);
  if (!save(next)) {
    status("Poistamista ei voitu tallentaa. Kilpailua ei poistettu.", "error"); return;
  }
  importNumber++;
  localCompetitions = next;
  competitions = combined();
  $("#file").value = "";
  $("#search").value = "";
  $("#club").value = "";
  $("#category").value = "";
  refresh();
  status("Oma tuonti poistettiin tästä selaimesta. Jos kilpailu kuuluu yhteiseen aineistoon, sen yhteinen versio näkyy edelleen. Alkuperäistä .txt-tiedostoa ei poistettu.");
});
$("#competition").addEventListener("change", refreshFilters);
$("#search").addEventListener("input", render);
$("#club").addEventListener("change", render);
$("#category").addEventListener("change", render);
$("#nav-results").addEventListener("click", () => showView("results"));
$("#nav-competitions").addEventListener("click", () => showView("competitions"));
$("#competition-query").addEventListener("input", renderCompetitionList);
$("#competition-sort").addEventListener("change", renderCompetitionList);
$("#back-to-results").addEventListener("click", closeProfile);
restore();
