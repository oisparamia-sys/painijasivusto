"use strict";
    function parseLigaDB(text) {
      const lines = text.replace(/^\uFEFF/, "").replace(/\0/g, "").replace(/\r\n?/g, "\n").split("\n");
      const firstGroup = lines.findIndex(line => /^\s*\d+(?:[.,]\d+)?\s*kg\s*\t/i.test(line));
      if (firstGroup < 0) throw new Error("Sarjoja ei löytynyt. Valitse nimenomaan tab-eroteltu tulosluettelo, ei ottelutiedostoa tai HTML-sivua.");
      const header = lines.slice(0, firstGroup).map(line => line.trim()).filter(Boolean);
      if (!header.length) throw new Error("Tiedostosta puuttuu kilpailun nimi.");
      const dateLine = header.find(line => /\d{1,2}[./]\d{1,2}[./]\d{4}/.test(line) && line !== header[0]) || "";
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
const $ = selector => document.querySelector(selector);
const R = window.PainiRegistry;
let dataset = null;
let dirty = false;
let work = new Map();
let pending = null;
let busy = false;
let ready = false;
function say(message, kind = "") {
  $("#status").textContent = message;
  $("#status").dataset.kind = kind;
}
function validSource(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "turniereklassisch.ringerdb.de" && !url.username && !url.password;
  } catch { return false; }
}
function safeItem(item) {
  return valid(item) && validSource(item.source || "") && validSource(item.textSource || "");
}
function renderWork() {
  $("#dataset-rows").replaceChildren();
  let rows = 0;
  for (const item of work.values()) {
    rows += item.rows.length;
    const tr = document.createElement("tr");
    [item.title, item.details || "Päivämäärä puuttuu", item.rows.length].forEach(value => {
      const td = document.createElement("td"); td.textContent = String(value); tr.append(td);
    });
    $("#dataset-rows").append(tr);
  }
  $("#dataset-summary").textContent = work.size + " kilpailua · " + rows + " tulosriviä";
  $("#undo-import").disabled = !ready || busy || pending !== null || !dataset?.athleteRegistry.history.length;
  $("#files").disabled = !ready || busy || pending !== null;
  $("#export").disabled = !ready || busy || pending !== null;
  $("#apply").disabled = busy || !pending || !pending.length;
  $("#discard").disabled = busy;
}
function rowKey(row) {
  return JSON.stringify([row.name, row.club, row.category, row.weight, row.place]);
}
function difference(previous, item) {
  const oldKeys = new Set((previous?.rows || []).map(rowKey));
  const newKeys = new Set(item.rows.map(rowKey));
  return {
    added: item.rows.filter(row => !oldKeys.has(rowKey(row))),
    removed: (previous?.rows || []).filter(row => !newKeys.has(rowKey(row)))
  };
}
function appendRows(parent, title, rows) {
  if (!rows.length) return;
  const heading = document.createElement("h4"); heading.textContent = title;
  const scroll = document.createElement("div"); scroll.className = "scroll";
  const table = document.createElement("table");
  table.setAttribute("aria-label", title);
  const thead = document.createElement("thead"), header = document.createElement("tr");
  ["Sija", "Painija", "Seura", "Ikäluokka", "Painoluokka"].forEach(value => {
    const th = document.createElement("th"); th.scope = "col"; th.textContent = value; header.append(th);
  });
  thead.append(header);
  const tbody = document.createElement("tbody");
  rows.forEach(row => {
    const tr = document.createElement("tr");
    [row.place + ".", row.name, row.club, row.category, row.weight + " kg"].forEach(value => {
      const td = document.createElement("td"); td.textContent = value; tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(thead, tbody); scroll.append(table); parent.append(heading, scroll);
}
function renderPreview(errors) {
  const parent = $("#preview-entries"); parent.replaceChildren();
  let added = 0, updated = 0, unchanged = 0;
  pending.forEach((entry, index) => {
    if (!entry.previous) added++;
    else if (entry.diff.added.length || entry.diff.removed.length) updated++;
    else unchanged++;
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const label = !entry.previous ? "Uusi kilpailu" : entry.diff.added.length || entry.diff.removed.length ? "Päivitys" : "Tulokset ennallaan";
    summary.textContent = label + ": " + entry.item.title + " · " + (entry.item.details || "Päivämäärä puuttuu");
    const info = document.createElement("p");
    info.textContent = entry.fileName + " — tulosrivejä ennen " + (entry.previous?.rows.length || 0) +
      ", jälkeen " + entry.item.rows.length + ". Lisättyjä/uusia rivejä " + entry.diff.added.length +
      ", poistuvia/korvautuvia rivejä " + entry.diff.removed.length + ".";
    details.append(summary, info);
    if (entry.item.skipped) {
      const note = document.createElement("p"); note.className = "hint";
      note.textContent = "Ohitettuja Tyhjä- tai toistuvia rivejä: " + entry.item.skipped + ".";
      details.append(note);
    }
    const hint = document.createElement("p"); hint.className = "hint";
    hint.textContent = "Sijoituksen tai muun tiedon muutos näkyy yhtenä poistuvana ja yhtenä uutena rivinä. Tarkista kilpailun nimi ja päivämäärä.";
    const labelEl = document.createElement("label");
    labelEl.htmlFor = "source-" + index; labelEl.textContent = "Alkuperäinen tulossivu (valinnainen)";
    const input = document.createElement("input"); input.type = "url"; input.id = "source-" + index;
    input.placeholder = "https://turniereklassisch.ringerdb.de/…/indexFIN.htm";
    input.value = entry.item.source || "";
    input.addEventListener("input", () => { entry.item.source = input.value.trim(); input.setCustomValidity(""); });
    details.append(hint, labelEl, input);
    appendRows(details, "Uudet tai muuttuneet rivit", entry.diff.added);
    appendRows(details, "Poistuvat tai korvautuvat rivit", entry.diff.removed);
    parent.append(details);
  });
  $("#preview-summary").textContent = "Uusia kilpailuja: " + added + ". Päivittyviä: " + updated +
    ". Tuloksiltaan ennallaan: " + unchanged + ". Tuonnin ulkopuolelle jääviä tiedostoja: " + errors.length + ".";
  $("#error-list").replaceChildren();
  errors.forEach(message => { const li = document.createElement("li"); li.textContent = message; $("#error-list").append(li); });
  $("#preview-errors").hidden = !errors.length;
  $("#preview").hidden = false;
}
$("#files").addEventListener("change", async event => {
  const files = [...event.target.files];
  if (!ready || busy || pending !== null || !files.length) return;
  busy = true; renderWork();
  const entries = [], errors = [], seen = new Set();
  try {
    for (const [index, file] of files.entries()) {
      say("Luetaan " + (index + 1) + "/" + files.length + ": " + file.name);
      try {
        if (!/\.(txt|tsv)$/i.test(file.name)) throw new Error("Valitse .txt- tai .tsv-tiedosto.");
        if (file.size > 5 * 1024 * 1024) throw new Error("Tiedoston enimmäiskoko on 5 Mt.");
        const decoded = decodeFile(await file.arrayBuffer());
        const parsed = parseLigaDB(decoded.text);
        const id = identity(parsed);
        if (seen.has(id)) throw new Error("Sama kilpailu on jo tämän erän esikatselussa. Tämä tiedosto jätettiin pois; tarkista esikatseltu versio.");
        const previous = work.get(id);
        const item = { ...parsed, categoryStyles: previous?.categoryStyles || {}, styleSources: previous?.styleSources || {}, source: previous?.source || "", textSource: previous?.textSource || "", fileInfo: "Yhteinen kilpailuaineisto · " + file.name };
        if (!safeItem(item)) throw new Error("Kilpailun tiedot eivät kelpaa vientiin.");
        seen.add(id);
        entries.push({ fileName: file.name, item, previous, diff: difference(previous, item) });
      } catch (error) { errors.push(file.name + ": " + error.message); }
    }
    pending = entries;
    renderPreview(errors);
    say(entries.length ? "Esikatselu valmis. Työaineisto ei ole vielä muuttunut. Avaa kilpailun rivi tarkistaaksesi erot ja hyväksy sitten muutokset." : "Yhtäkään kelvollista tiedostoa ei löytynyt. Aineisto ei muuttunut. Hylkää esikatselu ja valitse uudet tiedostot.", entries.length ? "" : "error");
  } finally { busy = false; event.target.value = ""; renderWork(); }
});
$("#apply").addEventListener("click", () => {
  if (busy || !pending?.length) return;
  for (const [index, entry] of pending.entries()) {
    if (!safeItem(entry.item)) {
      const input = $("#source-" + index); input.closest("details").open = true;
      input.setCustomValidity("Käytä lähteen HTTPS-osoitetta verkkotunnuksessa turniereklassisch.ringerdb.de tai jätä kenttä tyhjäksi.");
      input.reportValidity();
      say("Lähdeosoite ei kelpaa. Korjaa se tai jätä kenttä tyhjäksi. Aineisto ei muuttunut.", "error");
      return;
    }
  }
  try {
    const nextDataset = R.importCompetitions(dataset, pending.map(entry => entry.item));
    dataset = nextDataset; dirty = true;
    work = new Map(dataset.competitions.map(item => [identity(item), item])); pending = null;
  } catch (error) { say("Tuontia ei hyväksytty: " + error.message + " Aiempi aineisto säilyi ennallaan.", "error"); return; }
  $("#preview").hidden = true; renderWork();
  say("Muutokset hyväksyttiin työaineistoon. Lataa nyt uusi data.js. Projektin tiedostoa ei vielä muutettu.", "success");
});
$("#discard").addEventListener("click", () => {
  if (busy) return;
  pending = null; $("#preview").hidden = true; renderWork();
  say("Esikatselu hylättiin. Aiemmin hyväksytty työaineisto säilyi ennallaan.");
});
function exportSource() {
  if (!ready || busy || pending !== null || !work.size || ![...work.values()].every(safeItem)) throw new Error("Aineisto ei ole valmis vientiin.");
  const now = new Date();
  const date = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  return R.exportSource({ ...dataset, snapshotDate: date, competitions: [...work.values()] });
}
$("#export").addEventListener("click", () => {
  try {
    const content = exportSource();
    const blob = new Blob([content], { type: "text/javascript;charset=utf-8" });
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = "data.js"; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    say("data.js-tiedoston lataus aloitettiin. Tarkista lataus selaimesta ja siirrä tiedosto projektikansioon nimellä data.js. Jos nimi on data (1).js, muuta nimeksi data.js.", "success");
  } catch (error) { say("Vienti ei onnistunut. " + error.message, "error"); }
});
try {
  const data = window.PAINI_SHARED_DATA;
  if (!data || data.version !== 1 || !Array.isArray(data.competitions) || !data.competitions.length || !data.competitions.every(safeItem)) throw new Error("data.js puuttuu tai sen sisältö ei kelpaa.");
  R.validate(data);
  dataset = JSON.parse(JSON.stringify(data));
  work = new Map(dataset.competitions.map(item => [identity(item), item]));
  if (work.size !== data.competitions.length) throw new Error("data.js sisältää saman kilpailun useasti.");
  ready = true;
  say("Nykyinen yhteinen aineisto luettiin. Voit valita uudet tulostiedostot tai ladata tästä aineistosta kopion.", "success");
} catch (error) { say("Ylläpitoa ei voitu avata: " + error.message + " Pidä yllapito.html, yllapito.js ja data.js samassa kansiossa.", "error"); }
renderWork();

$("#undo-import").addEventListener("click", () => {
  if (!ready || busy || pending !== null) return;
  try { dataset = R.undo(dataset); dirty = true; work = new Map(dataset.competitions.map(item => [identity(item), item])); renderWork(); say("Viimeisin muutos peruttiin. Lataa uusi data.js tallentaaksesi perumisen.", "success"); }
  catch (error) { say(error.message, "error"); }
});
window.addEventListener("beforeunload", event => { if (dirty) { event.preventDefault(); event.returnValue = ""; } });
