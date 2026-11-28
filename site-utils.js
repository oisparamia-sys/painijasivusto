"use strict";
(function(root){
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
function prepareCompetitionText(text){
 return {text,words:searchWords(text)};
}
function compileCompetitionQuery(query){
  const datePattern = /(?<![\p{L}\p{N}./])(\d{1,2})(?:\.?\s*[-–]\s*(\d{1,2}))?[./](\d{1,2})(?:[./](\d{4}))?(?:[./](?=\s|$))?(?![\p{L}\p{N}./])/gu;
  const span = match => {
    const day = Number(match[1]), endDay = Number(match[2] || match[1]);
    const month = Number(match[3]), year = match[4] ? Number(match[4]) : null;
    // An unspecified year permits February 29; the actual event year must
    // still validate independently before it can match.
    const validationYear = year ?? 2000;
    const timestamp = day => {
      const value = Date.UTC(validationYear, month - 1, day), date = new Date(value);
      return date.getUTCFullYear() === validationYear && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? value : null;
    };
    const start = timestamp(day), end = timestamp(endDay);
    return start !== null && end !== null && start <= end ? {start:day,end:endDay,month,year} : null;
  };
  const requestedDates=[...query.matchAll(datePattern)].map(span);
  const tokens=searchWords(query.replace(datePattern,' '));
  const wordsCache=new Map();
  return prepared=>{
    if(requestedDates.length){const actualDates=[...prepared.text.matchAll(datePattern)].map(span).filter(Boolean);
      if(!requestedDates.every(wanted=>wanted&&actualDates.some(actual=>actual.month===wanted.month&&(wanted.year===null||actual.year===wanted.year)&&actual.start<=wanted.start&&actual.end>=wanted.end)))return false;
    }
    return tokens.every(token=>prepared.words.some(word=>{
      const key=token+'|'+word;if(!wordsCache.has(key))wordsCache.set(key,matchesSearchWords([word],[token]));return wordsCache.get(key);
    }));
  };
}
function matchesCompetitionQuery(text,query){return compileCompetitionQuery(query)(prepareCompetitionText(text));}
function matchesSearchWords(words, tokens) {
  return tokens.every(token => words.some(word => {
    if (/\d/u.test(token)) return word.startsWith(token);
    if (word.includes(token)) return true;
    if (token.length < 3 || /\d/u.test(token) || /\d/u.test(word)) return false;
    const tolerance = token.length >= 7 ? 2 : 1;
    const phonetic = value => value.replace(/ee/g, 'ii').replace(/c(?=[aou])/g, 'k');
    if (token.length >= 4 && phonetic(token) === phonetic(word)) return true;
    return Math.abs(word.length-token.length) <= tolerance && wordDistance(token,word) <= tolerance;
  }));
}

function competitionTier(title) {
  const text = searchWords(title).join(' ');
  if (/(^| )kll( |$)/u.test(text) || text.includes('koululiikuntaliiton')) return 1;
  if (/(^| )(sm|suomenmestaruus\p{L}*|suomen mestaruus\p{L}*)( |$)/u.test(text)) return 0;
  if (/(alue|piirin) mestaruus/u.test(text) || /(?:alue|piirin|piiri)mestaruus/u.test(text)) return 2;
  return 3;
}
function yearlyPlacements(entries, yearOf) {
  const years = new Map();
  for (const entry of entries) {
    const year = yearOf(entry.item), place = entry.result.place;
    if (!Number.isInteger(place) || place < 1) continue;
    if (!years.has(year)) years.set(year, {year, counts:[0,0,0,0], total:0});
    const row = years.get(year); row.counts[Math.min(place,4)-1]++; row.total++;
  }
  return [...years.values()].sort((a,b) => /^\d{4}$/.test(a.year) ? (/^\d{4}$/.test(b.year) ? Number(a.year)-Number(b.year) : -1) : 1);
}

const api={prepareCompetitionText,compileCompetitionQuery,searchWords,matchesSearchWords,matchesCompetitionQuery,competitionTier,yearlyPlacements};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
else root.PAINI_UTILS=api;
})(typeof window!=="undefined"?window:globalThis);
