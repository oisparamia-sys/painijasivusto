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
    reg.athletes.forEach(a => {
      if (a.distinctFrom === undefined) return;
      check(Array.isArray(a.distinctFrom) && new Set(a.distinctFrom).size === a.distinctFrom.length && a.distinctFrom.every(id => people.has(id) && id !== a.id), "Eri henkilöiksi merkittyjen tunnukset eivät kelpaa.");
      a.distinctFrom.forEach(id => check(resolve(data,a.id) !== resolve(data,id), "Eri henkilöiksi merkityt tunnukset on yhdistetty."));
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
      const remaining=new Set(data.competitions.map(compKey));
      for(const [key,c] of before)if(!remaining.has(key))entry.competitions.push({key,before:copy(c),after:null});
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
      check(!areDifferent(data, sourceId, targetId), "Tunnukset on merkitty eri henkilöiksi. Peru merkintä ennen yhdistämistä.");
      rows(data).filter(r => r.athleteId === sourceId).forEach(r => { r.athleteId = targetId; });
      source.mergedInto = targetId; source.status = "unreviewed"; target.status = "unreviewed";
    });
  }
  function mergeMany(input, pairs) {
    check(Array.isArray(pairs) && pairs.length > 0, "Valitse vähintään yksi ehdotus.");
    const used = new Set();
    pairs.forEach(([source,target]) => {
      check(source !== target && !used.has(source) && !used.has(target), "Sama tunnus esiintyy useassa valinnassa. Yhdistä nämä ehdotukset yksi kerrallaan.");
      used.add(source); used.add(target);
    });
    return transaction(input, "Yhdistä valitut ehdotukset (" + pairs.length + ")", "identity", data => {
      pairs.forEach(([sourceId,targetId]) => {
        const source = active(data,sourceId), target = active(data,targetId);
        check(!areDifferent(data,sourceId,targetId), "Eri henkilöiksi merkittyä paria ei voi yhdistää.");
        rows(data).filter(r=>r.athleteId===sourceId).forEach(r=>{r.athleteId=targetId;});
        source.mergedInto=targetId; source.status="unreviewed"; target.status="unreviewed";
      });
    });
  }
  function differentPairs(data) {
    const pairs = new Map();
    data.athleteRegistry.athletes.forEach(person => (person.distinctFrom || []).forEach(other => {
      const a = resolve(data,person.id), b = resolve(data,other);
      if (a && b && a !== b) { const pair = [a,b].sort(); pairs.set(JSON.stringify(pair),pair); }
    }));
    return [...pairs.values()];
  }
  function areDifferent(data, a, b) {
    const left = resolve(data,a), right = resolve(data,b);
    return differentPairs(data).some(pair => pair.includes(left) && pair.includes(right));
  }
  function setDifferent(input, a, b, different = true) {
    check(a !== b, "Valitse kaksi eri tunnusta.");
    return transaction(input, (different ? "Merkitse eri henkilöiksi: " : "Peru eri henkilöiden merkintä: ") + a + " / " + b, "identity", data => {
      const left = active(data,a), right = active(data,b);
      if (different) {
        left.distinctFrom = [...new Set([...(left.distinctFrom || []),b])];
        right.distinctFrom = [...new Set([...(right.distinctFrom || []),a])];
      } else {
        data.athleteRegistry.athletes.forEach(person => {
          if (!person.distinctFrom) return;
          const own = resolve(data,person.id);
          person.distinctFrom = person.distinctFrom.filter(id => !((own === a && resolve(data,id) === b) || (own === b && resolve(data,id) === a)));
          if (!person.distinctFrom.length) delete person.distinctFrom;
        });
      }
    });
  }
  function split(input, sourceId, resultIds, name) {
    const selection = new Set(resultIds);
    return transaction(input, "Erota tuloksia: " + sourceId, "identity", data => {
      const source = active(data, sourceId), own = rows(data).filter(r => r.athleteId === sourceId);
      check(selection.size > 0 && selection.size < own.length, "Valitse vähintään yksi tulos ja jätä vähintään yksi nykyiselle tunnukselle.");
      check([...selection].every(id => own.some(r => r.resultId === id)), "Valittu tulos ei kuulu tähän merkintään.");
      const created = addPerson(data, name); source.status = "unreviewed";
      // A split is also a permanent identity decision, including inherited
      // exclusions. A later name merge must not bridge the separated people.
      const others = differentPairs(data).filter(pair => pair.includes(sourceId)).flat().filter(id => id !== sourceId);
      created.distinctFrom = [...new Set([sourceId, ...others])];
      source.distinctFrom = [...new Set([...(source.distinctFrom || []), created.id])];
      own.filter(r => selection.has(r.resultId)).forEach(r => { r.athleteId = created.id; });
    });
  }
  function updatePerson(input, id, name, reviewed) {
    return transaction(input, "Muokkaa merkintää: " + id, "identity", data => {
      const person = active(data, id); check(typeof name === "string" && name.trim(), "Nimi ei voi olla tyhjä.");
      person.name = name.trim(); person.status = reviewed ? "reviewed" : "unreviewed";
    });
  }
  function nameClubPlan(data) {
    validate(data);
    const people = new Map(data.athleteRegistry.athletes.filter(a=>!a.mergedInto).map(a=>[a.id,a]));
    const counts = new Map(); rows(data).forEach(r=>counts.set(r.athleteId,(counts.get(r.athleteId)||0)+1));
    const groups = new Map();
    data.competitions.forEach(comp=>{
      if (/\bkll\b|koululiikuntaliit/i.test(comp.title)) return;
      comp.rows.forEach(row=>{
        const name=norm(row.name),club=norm(row.club);
        if (name.split(" ").length<2) return;
        const key=JSON.stringify([name,club]);
        if(!groups.has(key)) groups.set(key,{name:row.name,club:row.club,ids:new Set()});
        groups.get(key).ids.add(row.athleteId);
      });
    });
    const candidates=[...groups.values()].filter(group=>group.ids.size>1);
    const memberships=new Map(); candidates.forEach(group=>group.ids.forEach(id=>memberships.set(id,(memberships.get(id)||0)+1)));
    const distinct=new Set(differentPairs(data).map(pair=>JSON.stringify(pair)));
    const plan=[],skipped=[];
    candidates.forEach(group=>{
      const ids=[...group.ids];
      const blocked=ids.some((id,i)=>ids.slice(i+1).some(other=>distinct.has(JSON.stringify([id,other].sort()))));
      const ambiguous=ids.some(id=>memberships.get(id)>1);
      if(blocked||ambiguous){skipped.push({name:group.name,club:group.club,reason:blocked?"Merkitty eri henkilöiksi":"Tunnus kuuluu useaan mahdolliseen nimi–seura-ryhmään"});return;}
      ids.sort((a,b)=>(people.get(b).status==="reviewed")-(people.get(a).status==="reviewed")||(counts.get(b)||0)-(counts.get(a)||0)||a.localeCompare(b));
      const [target,...sources]=ids;
      plan.push({name:group.name,club:group.club,target,sources,results:sources.reduce((n,id)=>n+(counts.get(id)||0),0)});
    });
    return {groups:plan,skipped,mergedProfiles:plan.reduce((n,g)=>n+g.sources.length,0),movedResults:plan.reduce((n,g)=>n+g.results,0)};
  }
  function applyNameClub(data, plan) {
    const people=new Map(data.athleteRegistry.athletes.map(a=>[a.id,a]));
    const assignment=new Map();
    plan.groups.forEach(group=>{
      const target=people.get(group.target); target.status="unreviewed";
      group.sources.forEach(id=>{const source=people.get(id);source.mergedInto=group.target;source.status="unreviewed";assignment.set(id,group.target);});
    });
    rows(data).forEach(row=>{if(assignment.has(row.athleteId))row.athleteId=assignment.get(row.athleteId);});
  }
  function autoMergeNameClub(input) {
    return transaction(input,"Yhdistä sama nimi ja seura", "identity", data=>applyNameClub(data,nameClubPlan(data)));
  }
  function namePlan(data) {
    validate(data);
    const counts = new Map();
    rows(data).forEach(r => counts.set(r.athleteId, (counts.get(r.athleteId) || 0) + 1));
    const groups = new Map();
    data.athleteRegistry.athletes.forEach(person => {
      const key = norm(person.name);
      if (person.mergedInto || !counts.has(person.id) || key.split(" ").length < 2) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(person);
    });
    const blocked = new Set(differentPairs(data).map(pair => JSON.stringify(pair.sort())));
    const plan = [], skipped = [];
    groups.forEach(people => {
      if (people.length < 2) return;
      // Block the whole name group: a newly imported third profile must not
      // accidentally join both sides of an earlier separation.
      if (people.some((a,i) => people.slice(i+1).some(b => blocked.has(JSON.stringify([a.id,b.id].sort()))))) {
        skipped.push({name:people[0].name, reason:"Samannimisiä on erotettu eri henkilöiksi; uudet tulokset tarkistetaan."});
        return;
      }
      people.sort((a,b) => (b.status === "reviewed") - (a.status === "reviewed") || counts.get(b.id) - counts.get(a.id) || a.id.localeCompare(b.id));
      const [target,...sources] = people;
      plan.push({name:target.name, target:target.id, sources:sources.map(p=>p.id), results:sources.reduce((n,p)=>n+counts.get(p.id),0)});
    });
    return {groups:plan, skipped, mergedProfiles:plan.reduce((n,g)=>n+g.sources.length,0), movedResults:plan.reduce((n,g)=>n+g.results,0)};
  }
  function autoMergeNames(input) {
    return transaction(input,"Yhdistä automaattisesti sama etu- ja sukunimi", "identity", data => applyNameClub(data,namePlan(data)));
  }
  function importCompetitions(input, incoming, options = {}) {
    return transaction(input, "Hyväksy kilpailutuonti (" + incoming.length + ")", "import", data => {
      const work = new Map(data.competitions.map(c => [compKey(c), c])), seen = new Set();
      incoming.forEach(original => {
        const c = copy(original), key = compKey(c); check(!seen.has(key), "Sama kilpailu on tuonnissa kahdesti."); seen.add(key);
        const sourceMatches=options.matchBySource && c.source?[...work.values()].filter(old=>old.source===c.source):[];
        check(sourceMatches.length<=1,'Sama lähdeosoite on useassa kilpailussa.');
        const previous = work.get(key) || sourceMatches[0], oldGroups = new Map(), newCounts = new Map();
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
        if(previous && compKey(previous)!==key)work.delete(compKey(previous));
        work.set(key, c);
      });
      data.competitions = [...work.values()];
      if (options.autoMergeNames !== false) applyNameClub(data,namePlan(data));
      else if (options.autoMergeNameClub === true) applyNameClub(data,nameClubPlan(data));
    });
  }
  function mergeScope(entry,targetId) {
    if(!entry||!targetId)return entry;
    const sources=new Set((entry.people||[]).filter(c=>c.before&&!c.before.mergedInto&&c.after?.mergedInto===targetId).map(c=>c.id));
    return {...entry,people:(entry.people||[]).filter(c=>sources.has(c.id)||sources.size&&c.id===targetId),assignments:(entry.assignments||[]).filter(c=>sources.has(c.before))};
  }
  function mergeUndoInfo(data,historyIndex,targetId) {
    const entry=mergeScope(data.athleteRegistry.history[historyIndex],targetId);
    const moves=entry?.kind==='identity'?(entry.people||[]).filter(c=>c.before&&!c.before.mergedInto&&c.after?.mergedInto):[];
    const result={isMerge:moves.length>0,allowed:false,results:entry?.assignments?.length||0,profiles:moves.length,groups:new Set(moves.map(c=>c.after.mergedInto)).size,reason:''};
    if(!result.isMerge)return result;
    const fail=reason=>({...result,reason});
    if(!targetId&&result.groups>1)return fail('Erä sisältää useita painijoita. Avaa painija haulla ja peru vain hänen yhdistämisensä.');
    if((entry.competitions||[]).length||entry.people.some(c=>!c.before)||!Array.isArray(entry.assignments))return fail('Tätä yhdistämistä ei voi palauttaa erillisenä. Käytä tulosten erottelua.');
    const people=new Map(data.athleteRegistry.athletes.map(p=>[p.id,p]));
    if(entry.people.some(c=>!same(people.get(c.id),c.after))||moves.some(c=>!people.has(c.after.mergedInto)||people.get(c.after.mergedInto).mergedInto))return fail('Profiileihin on tehty tämän yhdistämisen jälkeen muita muutoksia. Käytä tulosten erottelua.');
    const bySource=new Map(moves.map(c=>[c.id,c.after.mergedInto])),current=new Map(rows(data).map(row=>[row.resultId,row]));
    if(entry.assignments.some(c=>bySource.get(c.before)!==c.after||current.get(c.resultId)?.athleteId!==c.after))return fail('Yhdistämisen siirtämiä tuloksia on muutettu myöhemmin. Käytä tulosten erottelua.');
    return {...result,allowed:true};
  }
  function undoMerge(input,historyIndex,targetId) {
    validate(input);check(targetId===undefined||typeof targetId==='string'&&targetId,'Valitse painijan tunnus.');check(Number.isSafeInteger(historyIndex)&&historyIndex>=0,'Valitse yhdistäminen historiasta.');
    const info=mergeUndoInfo(input,historyIndex,targetId);check(info.allowed,info.reason||'Valitse peruttava yhdistäminen.');
    const original=mergeScope(input.athleteRegistry.history[historyIndex],targetId);
    const next=transaction(input,'Peru yhdistäminen ja pidä henkilöt erillään: '+(targetId||original.label),'identity',data=>{
      const people=new Map(data.athleteRegistry.athletes.map(person=>[person.id,person]));
      original.people.forEach(change=>people.set(change.id,copy(change.before)));
      const assignments=new Map(original.assignments.map(change=>[change.resultId,change.before]));
      rows(data).forEach(row=>{if(assignments.has(row.resultId))row.athleteId=assignments.get(row.resultId);});
      for(const change of original.people.filter(c=>c.before&&!c.before.mergedInto&&c.after.mergedInto)){
        const source=people.get(change.id),target=people.get(change.after.mergedInto);
        source.distinctFrom=[...new Set([...(source.distinctFrom||[]),target.id])];
        target.distinctFrom=[...new Set([...(target.distinctFrom||[]),source.id])];
      }
      data.athleteRegistry.athletes=[...people.values()];
    });
    next.athleteRegistry.history.at(-1).revertsMerge={historyIndex,targetId:targetId||null,at:original.at,label:original.label};
    return next;
  }
  function undo(input) {
    validate(input); const data = copy(input), entry = data.athleteRegistry.history.at(-1);
    check(entry, "Peruttavia muutoksia ei ole.");
    const people = new Map(data.athleteRegistry.athletes.map(a => [a.id, a]));
    entry.people.forEach(c => check(same(people.get(c.id), c.after), "Merkintä on muuttunut peruttavan muutoksen jälkeen."));
    const resultMap = new Map(rows(data).map(r => [r.resultId, r]));
    entry.assignments.forEach(c => check(resultMap.get(c.resultId)?.athleteId === c.after, "Tulos on muuttunut peruttavan muutoksen jälkeen."));
    const comps = new Map(data.competitions.map(c => [compKey(c), c]));
    entry.competitions.forEach(c => check(same(comps.get(c.key)||null, c.after), "Kilpailu on muuttunut peruttavan muutoksen jälkeen."));
    entry.people.forEach(c => { if (c.before) people.set(c.id, c.before); else people.delete(c.id); });
    entry.assignments.forEach(c => { resultMap.get(c.resultId).athleteId = c.before; });
    entry.competitions.forEach(c => { if (c.before) comps.set(c.key, c.before); else comps.delete(c.key); });
    data.athleteRegistry.athletes = [...people.values()]; data.competitions = [...comps.values()];
    data.athleteRegistry.history.pop(); // Counters deliberately never go backwards: IDs are not reused.
    // Keep the complete reverted event for audit, separately from the undo stack.
    (data.athleteRegistry.revertedHistory ||= []).push({entry:copy(entry), undoneAt:new Date().toISOString()});
    validate(data); return data;
  }
  function exportSource(data) {
    validate(data); const payload = copy(data), now = new Date(); payload.exportedAt = now.toISOString();
    const json = JSON.stringify(payload, null, 2).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    return '"use strict";\nwindow.PAINI_SHARED_DATA = ' + json + ';\n';
  }
  root.PainiRegistry = Object.freeze({ validate, initialize, merge, split, updatePerson, importCompetitions, undo, exportSource, rows, compKey, norm, resolve, mergeUndoInfo, undoMerge, differentPairs, areDifferent, setDifferent, mergeMany, nameClubPlan, autoMergeNameClub, namePlan, autoMergeNames });
})(typeof window === "undefined" ? globalThis : window);
