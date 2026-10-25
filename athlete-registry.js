"use strict";
// Shared, offline identity operations. No network or browser storage writes.
(function (root) {
  const copy = value => JSON.parse(JSON.stringify(value));
  const norm = value => value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("fi");
  const compKey = c => JSON.stringify([norm(c.title), norm(c.details)]);
  const rowKey = r => JSON.stringify([r.name, r.club, r.category, r.weight].map(norm));
  const rows = data => data.competitions.flatMap(c => c.rows);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function check(condition, message) { if (!condition) throw new Error(message); }
  function validate(data) {
    check(data?.version === 1 && Array.isArray(data.competitions), "Kilpailuaineisto ei kelpaa.");
    const reg = data.athleteRegistry;
    check(reg?.version === 1 && Array.isArray(reg.athletes) && Array.isArray(reg.history), "Painijarekisteri puuttuu tai sen versio ei kelpaa.");
    check(Number.isSafeInteger(reg.nextAthlete) && reg.nextAthlete > 0 && Number.isSafeInteger(reg.nextResult) && reg.nextResult > 0, "Tunnuslaskurit eivät kelpaa.");
    const people = new Map();
    reg.athletes.forEach(a => {
      check(/^painija-\d{6,}$/.test(a.id) && !people.has(a.id), "Painijatunnus puuttuu tai toistuu.");
      check(Number(a.id.slice(8)) < reg.nextAthlete, "Painijatunnuksen laskuri on jäljessä.");
      check(typeof a.name === "string" && a.name.trim() && ["unreviewed", "reviewed"].includes(a.status), "Painijamerkinnän tiedot eivät kelpaa.");
      people.set(a.id, a);
    });
    reg.athletes.forEach(a => {
      const visited = new Set(); let current = a;
      while (current.mergedInto) {
        check(!visited.has(current.id), "Painijatunnuksissa on yhdistämissilmukka."); visited.add(current.id);
        current = people.get(current.mergedInto); check(current, "Yhdistämisen kohdetta ei löydy.");
      }
    });
    const ids = new Set(), competitionIds = new Set();
    data.competitions.forEach(c => {
      check(typeof c.title === "string" && typeof c.details === "string" && typeof c.fileInfo === "string" && Array.isArray(c.rows) && c.rows.length > 0, "Kilpailun tiedot eivät kelpaa.");
      const key = compKey(c); check(!competitionIds.has(key), "Sama kilpailu toistuu."); competitionIds.add(key);
      c.rows.forEach(r => {
        check(["name", "club", "category", "weight"].every(k => typeof r[k] === "string" && r[k].trim()) && Number.isInteger(r.place) && r.place > 0, "Tulosrivi ei kelpaa.");
        check(/^tulos-\d{6,}$/.test(r.resultId) && !ids.has(r.resultId), "Tulostunnus puuttuu tai toistuu."); ids.add(r.resultId);
        check(Number(r.resultId.slice(6)) < reg.nextResult, "Tulostunnuksen laskuri on jäljessä.");
        const person = people.get(r.athleteId); check(person && !person.mergedInto, "Tulos ei viittaa aktiiviseen painijatunnukseen.");
      });
    });
    return true;
  }
  function allocate(reg, kind) {
    const field = kind === "painija" ? "nextAthlete" : "nextResult";
    check(Number.isSafeInteger(reg[field] + 1), "Tunnuslaskuri täyttyi.");
    return kind + "-" + String(reg[field]++).padStart(6, "0");
  }
  function addPerson(data, name) {
    check(typeof name === "string" && name.trim(), "Anna painijalle nimi.");
    const person = { id: allocate(data.athleteRegistry, "painija"), name: name.trim(), status: "unreviewed" };
    data.athleteRegistry.athletes.push(person); return person;
  }
  function initialize(input) {
    if (input.athleteRegistry) { validate(input); return copy(input); }
    const data = copy(input);
    check(!rows(data).some(r => r.athleteId || r.resultId), "Aineistossa on tunnuksia ilman rekisteriä. Älä luo niitä uudelleen.");
    data.athleteRegistry = { version: 1, nextAthlete: 1, nextResult: 1, athletes: [], history: [] };
    const groups = new Map();
    rows(data).forEach(r => {
      const key = JSON.stringify([norm(r.name), norm(r.club)]);
      if (!groups.has(key)) groups.set(key, addPerson(data, r.name).id);
      r.athleteId = groups.get(key); r.resultId = allocate(data.athleteRegistry, "tulos");
    });
    validate(data); return data;
  }
  function active(data, id) {
    const person = data.athleteRegistry.athletes.find(a => a.id === id);
    check(person && !person.mergedInto, "Valitse aktiivinen painijamerkintä."); return person;
  }
  function resolve(data, id) {
    const people = new Map(data.athleteRegistry.athletes.map(a => [a.id, a]));
    const visited = new Set(); let person = people.get(id);
    while (person?.mergedInto) {
      check(!visited.has(person.id), "Painijatunnuksissa on yhdistämissilmukka."); visited.add(person.id);
      person = people.get(person.mergedInto);
    }
    return person?.id || null;
  }
  function transaction(input, label, kind, edit) {
    validate(input); const data = copy(input); edit(data); validate(data);
    const beforePeople = new Map(input.athleteRegistry.athletes.map(a => [a.id, a]));
    const changes = data.athleteRegistry.athletes.filter(a => !same(beforePeople.get(a.id), a))
      .map(a => ({ id: a.id, before: beforePeople.has(a.id) ? copy(beforePeople.get(a.id)) : null, after: copy(a) }));
    const entry = { label, kind, at: new Date().toISOString(), people: changes, assignments: [], competitions: [] };
    if (kind === "import") {
      const before = new Map(input.competitions.map(c => [compKey(c), c]));
      entry.competitions = data.competitions.filter(c => !same(before.get(compKey(c)), c))
        .map(c => ({ key: compKey(c), before: before.has(compKey(c)) ? copy(before.get(compKey(c))) : null, after: copy(c) }));
    } else {
      const before = new Map(rows(input).map(r => [r.resultId, r.athleteId]));
      entry.assignments = rows(data).filter(r => r.athleteId !== before.get(r.resultId))
        .map(r => ({ resultId: r.resultId, before: before.get(r.resultId), after: r.athleteId }));
    }
    if (changes.length || entry.assignments.length || entry.competitions.length) data.athleteRegistry.history.push(entry);
    return data;
  }
  function merge(input, sourceId, targetId) {
    check(sourceId !== targetId, "Et voi yhdistää merkintää itseensä.");
    return transaction(input, "Yhdistä " + sourceId + " → " + targetId, "identity", data => {
      const source = active(data, sourceId), target = active(data, targetId);
      rows(data).filter(r => r.athleteId === sourceId).forEach(r => { r.athleteId = targetId; });
      source.mergedInto = targetId; source.status = "unreviewed"; target.status = "unreviewed";
    });
  }
  function split(input, sourceId, resultIds, name) {
    const selection = new Set(resultIds);
    return transaction(input, "Erota tuloksia: " + sourceId, "identity", data => {
      const source = active(data, sourceId), own = rows(data).filter(r => r.athleteId === sourceId);
      check(selection.size > 0 && selection.size < own.length, "Valitse vähintään yksi tulos ja jätä vähintään yksi nykyiselle tunnukselle.");
      check([...selection].every(id => own.some(r => r.resultId === id)), "Valittu tulos ei kuulu tähän merkintään.");
      const created = addPerson(data, name); source.status = "unreviewed";
      own.filter(r => selection.has(r.resultId)).forEach(r => { r.athleteId = created.id; });
    });
  }
  function updatePerson(input, id, name, reviewed) {
    return transaction(input, "Muokkaa merkintää: " + id, "identity", data => {
      const person = active(data, id); check(typeof name === "string" && name.trim(), "Nimi ei voi olla tyhjä.");
      person.name = name.trim(); person.status = reviewed ? "reviewed" : "unreviewed";
    });
  }
  function importCompetitions(input, incoming) {
    return transaction(input, "Hyväksy kilpailutuonti (" + incoming.length + ")", "import", data => {
      const work = new Map(data.competitions.map(c => [compKey(c), c])), seen = new Set();
      incoming.forEach(original => {
        const c = copy(original), key = compKey(c); check(!seen.has(key), "Sama kilpailu on tuonnissa kahdesti."); seen.add(key);
        const previous = work.get(key), oldGroups = new Map(), newCounts = new Map();
        (previous?.rows || []).forEach(r => { const k = rowKey(r); if (!oldGroups.has(k)) oldGroups.set(k, []); oldGroups.get(k).push(r); });
        c.rows.forEach(r => { const k = rowKey(r); newCounts.set(k, (newCounts.get(k) || 0) + 1); });
        c.rows.forEach(r => {
          const k = rowKey(r), matches = oldGroups.get(k) || [];
          // Carry over only an unambiguous occurrence in this same competition.
          // A new competition/club/name is never attached to a person by guessing.
          if (matches.length === 1 && newCounts.get(k) === 1) {
            r.resultId = matches[0].resultId; r.athleteId = matches[0].athleteId;
          } else {
            r.resultId = allocate(data.athleteRegistry, "tulos"); r.athleteId = addPerson(data, r.name).id;
          }
        });
        work.set(key, c);
      });
      data.competitions = [...work.values()];
    });
  }
  function undo(input) {
    validate(input); const data = copy(input), entry = data.athleteRegistry.history.at(-1);
    check(entry, "Peruttavia muutoksia ei ole.");
    const people = new Map(data.athleteRegistry.athletes.map(a => [a.id, a]));
    entry.people.forEach(c => check(same(people.get(c.id), c.after), "Merkintä on muuttunut peruttavan muutoksen jälkeen."));
    const resultMap = new Map(rows(data).map(r => [r.resultId, r]));
    entry.assignments.forEach(c => check(resultMap.get(c.resultId)?.athleteId === c.after, "Tulos on muuttunut peruttavan muutoksen jälkeen."));
    const comps = new Map(data.competitions.map(c => [compKey(c), c]));
    entry.competitions.forEach(c => check(same(comps.get(c.key), c.after), "Kilpailu on muuttunut peruttavan muutoksen jälkeen."));
    entry.people.forEach(c => { if (c.before) people.set(c.id, c.before); else people.delete(c.id); });
    entry.assignments.forEach(c => { resultMap.get(c.resultId).athleteId = c.before; });
    entry.competitions.forEach(c => { if (c.before) comps.set(c.key, c.before); else comps.delete(c.key); });
    data.athleteRegistry.athletes = [...people.values()]; data.competitions = [...comps.values()];
    data.athleteRegistry.history.pop(); // Counters deliberately never go backwards: IDs are not reused.
    validate(data); return data;
  }
  function exportSource(data) {
    validate(data); const payload = copy(data), now = new Date(); payload.exportedAt = now.toISOString();
    const json = JSON.stringify(payload, null, 2).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    return '"use strict";\nwindow.PAINI_SHARED_DATA = ' + json + ';\n';
  }
  root.PainiRegistry = Object.freeze({ validate, initialize, merge, split, updatePerson, importCompetitions, undo, exportSource, rows, compKey, norm, resolve });
})(typeof window === "undefined" ? globalThis : window);
