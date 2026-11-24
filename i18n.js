"use strict";
(() => {
  const rows=typeof module!=="undefined"&&module.exports?require('./translations.js'):window.PAINI_TRANSLATIONS, languages=['fi','en','sv'];
  const exact=new Map(rows.map(row=>[row[0],row]));
  // Sentence fragments cover dynamic counters without translating source names.
  const fragments=rows.filter(row=>row[0].length>=12 || row[0].endsWith(':') || row[0]==='Tarkistettu').sort((a,b)=>b[0].length-a[0].length);
  const templates=[
    [/^(\d[\d\s.,]*) yhteistä kilpailua, (\d[\d\s.,]*) tulosriviä\.$/, ['{1} shared competitions, {2} result rows.','{1} gemensamma tävlingar, {2} resultatrader.']],
    [/^(\d[\d\s.,]*) kilpailusijoitusta?$/, ['{1} competition placements','{1} tävlingsplaceringar']],
    [/^Näytetään tulokset (.+) \/ (.+)\. Haku ja rajaukset koskevat koko aineistoa\.$/,['Showing results {1} / {2}. Search and filters apply to the entire collection.','Visar resultat {1} / {2}. Sökning och filter gäller hela materialet.']],
    [/^Sivu (\d+) \/ (\d+)$/,['Page {1} / {2}','Sida {1} / {2}']],
    [/^(\d+) tulosriviä · (\d+) seuraa$/,['{1} result rows · {2} clubs','{1} resultatrader · {2} föreningar']],
    [/^Vuoden (\d{4}) tulokset\./,['Results for {1}.','Resultat för {1}.']],
    [/^(\d+) kilpailua$/,['{1} competitions','{1} tävlingar']],
    [/^(\d+) sopivaa kilpailua\.?$/,['{1} matching competitions','{1} matchande tävlingar']],
    [/^(\d+) ottelua valituissa kilpailuissa\. Voitot ja tappiot koskevat kaikkia hakuehtoja vastaavia otteluita\.$/,['{1} bouts in selected competitions. Wins and losses cover all bouts matching your filters.','{1} matcher i valda tävlingar. Vinster och förluster gäller alla matcher som matchar sökvillkoren.']],
    [/^Aiempi vastustaja · (\d+) ottelua tässä aineistossa$/,['Previous opponent · {1} bouts in this collection','Tidigare motståndare · {1} matcher i materialet']],
    [/^Tästä valinnasta jäi pois (\d+) ottelua lähderistiriidan, puuttuvan tunnistuksen tai tarkistettavan voittotavan vuoksi\. Ne eivät sisälly alla oleviin lukuihin\.$/,['{1} bouts were omitted due to conflicting sources, missing identification or an unverified victory method. They are not counted below.','{1} matcher utelämnades på grund av motstridiga källor, saknad identifiering eller obekräftat segersätt. De räknas inte nedan.']],
    [/^(\d+) kilpailua vuosilta (\d+)–(\d+)\. Mukana (.+) ottelua ja (\d+) painijaa\. Tämä ei vielä ole painijoiden koko otteluhistoria\.$/,['{1} competitions from {2}–{3}. Includes {4} bouts and {5} wrestlers. This is not yet their full bout history.','{1} tävlingar från {2}–{3}. Innehåller {4} matcher och {5} brottare. Detta är ännu inte deras fullständiga matchhistorik.']],
    [/^Viimeisin haku: (\d+) kilpailua käsitelty, (\d+) päivitetty, (\d+) säilytetty aiemmasta aineistosta, (\d+) ilman vahvistettuja otteluita\. Kaikkien kilpailujen tietoja ei ole välttämättä saatavilla\.$/,['Latest collection: {1} competitions processed, {2} updated, {3} retained, {4} without confirmed bouts. Some competition data may be unavailable.','Senaste insamling: {1} tävlingar behandlade, {2} uppdaterade, {3} bevarade, {4} utan bekräftade matcher. Alla tävlingsuppgifter finns inte nödvändigtvis tillgängliga.']],
    [/^Koko aineiston kilpailut ilman vahvistettuja otteluita \((\d+)\)$/,['Competitions without confirmed bouts in the full collection ({1})','Tävlingar utan bekräftade matcher i hela materialet ({1})']],
    [/^(\d+) kilpailua · (.+) kilpailusijoitusta\./,['{1} competitions · {2} competition placements.','{1} tävlingar · {2} tävlingsplaceringar.']],
    [/^Haussa on mukana (\d+) kilpailua, joiden tulokset ovat osittaiset\. Näet puuttuvat painoluokat valitsemalla kilpailun\.$/,['The search includes {1} competitions with partial results. Select a competition to see missing weight classes.','Sökningen omfattar {1} tävlingar med delvisa resultat. Välj en tävling för att se saknade viktklasser.']],
    [/^(\d[\d\s.,]*) yhteistä kilpailua, (.+) kilpailusijoitusta\.$/,['{1} shared competitions, {2} competition placements.','{1} gemensamma tävlingar, {2} tävlingsplaceringar.']],
    [/^Haussa mukana (\d+) kilpailua\.$/,['Searching {1} competitions.','Söker i {1} tävlingar.']],
    [/^(\d+) sopivaa kilpailua\. Valitse kilpailu tai käytä nuolinäppäimiä ja Enteriä\.$/,['{1} matching competitions. Select one or use the arrow keys and Enter.','{1} matchande tävlingar. Välj en eller använd piltangenterna och Enter.']],
    [/^(\d+) sopivaa painijaa\.$/,['{1} matching wrestlers.','{1} matchande brottare.']],
    [/^Näytetään (\d+) \/ (\d+) ehdotusta\. Tarkenna nimeä nähdäksesi muut\.$/,['Showing {1} / {2} suggestions. Refine the name to see others.','Visar {1} / {2} förslag. Ange ett mer exakt namn för att se andra.']],
    [/^(\d+) ehdotusta, joista (\d+) aiempia vastustajia tässä aineistossa\.$/,['{1} suggestions, including {2} previous opponents in this collection.','{1} förslag, varav {2} tidigare motståndare i materialet.']],
    [/ — mukana (\d+) ottelua, pois jäi (\d+) ottelua\. Vain toisessa luettelossa (\d+), muita lähdehuomioita (\d+)\./,[' — {1} bouts included, {2} omitted. Only in one list: {3}, other source issues: {4}.',' — {1} matcher ingår, {2} utelämnade. Endast i en lista: {3}, andra källanmärkningar: {4}.']],
    [/ · voitot$/,[' · wins',' · vinster']],
    [/^(\d+) ottelussa molemmat samannimiset osallistujat ovat samassa profiilissa\. Nämä ottelut odottavat henkilöiden erottamista eikä niitä lasketa voittoihin tai tappioihin\.$/,['In {1} bouts, both participants share this profile. They await separation and are not counted as wins or losses.','I {1} matcher delar båda deltagarna denna profil. De väntar på separation och räknas inte som vinster eller förluster.']],
    [/^(\d[\d\s.,]*) tulosta\./,['{1} results.','{1} resultat.']],
    [/^Uusi aineisto on saatavilla: (\d+) kilpailua ja (.+) kilpailusijoitusta\. Paina Päivitä tiedot\.$/,['New data is available: {1} competitions and {2} competition placements. Use Refresh data.','Nya data finns tillgängliga: {1} tävlingar och {2} tävlingsplaceringar. Använd Uppdatera data.']],
    [/^Tulosten lataaminen epäonnistui \((.+)\)\. Tarkista verkkoyhteys ja kokeile Päivitä tiedot -painiketta\.$/,['Loading results failed ({1}). Check your connection and use Refresh data.','Resultaten kunde inte laddas ({1}). Kontrollera anslutningen och använd Uppdatera data.']],
    [/ · (\d+) tulosriviä$/,[' · {1} result rows',' · {1} resultatrader']],
    [/^Kirjoita 3–(\d+) merkin palaute\. Kohdetiedot vievät osan tilasta\.$/,['Enter feedback of 3–{1} characters. Context information uses part of the space.','Skriv respons med 3–{1} tecken. Kontextuppgifterna tar en del av utrymmet.']]
,[/^(\d+) painijatunnusta · (\d+) kilpailua$/,['{1} wrestler identifiers · {2} competitions','{1} brottar-ID:n · {2} tävlingar']],
    [/^(\d+) kilpailusijoitusta$/,['{1} competition placements','{1} tävlingsplaceringar']],
    [/ · (\d+) tulosriviä$/,[' · {1} result rows',' · {1} resultatrader']]
  ];
  let language='fi';try{const saved=localStorage.getItem('paini-language');if(languages.includes(saved))language=saved;}catch{}
  function translate(value,lang=language) {
    if(lang==='fi'||!languages.includes(lang)||typeof value!=='string')return value;
    const index=languages.indexOf(lang),trim=value.trim(),row=exact.get(trim);
    if(row)return value.replace(trim,row[index]);
    let result=value;
    result=result.replace(/(^|\s)([123])\. sija(?=:)/g,(_,space,n)=>space+(lang==='en'?['1st place','2nd place','3rd place'][n-1]:['1:a plats','2:a plats','3:e plats'][n-1]));
    for(const [pattern,translations] of templates)result=result.replace(pattern,(...args)=>translations[index-1].replace(/\{(\d+)\}/g,(_,n)=>args[Number(n)]));
    for(const row of fragments)if(result.includes(row[0]))result=result.split(row[0]).join(row[index]);
    return result;
  }
  if(typeof module!=="undefined"&&module.exports){module.exports={translate};return;}
  const canonical=new Map(rows.flatMap(row=>row.map(value=>[value,row[0]])));
  const texts=new WeakMap(),attributes=new WeakMap();
  const sourceSelector='[translate="no"],script,style,noscript,textarea,#language option,#wrestler-title,.name-button,#same-name-options,#competition-list h3,#competition-list h3 + p,#competition-suggestions [data-source-text],#directory-suggestions [data-source-text],#club option:not([value=""]),#category option:not([value=""]),#competition option:not([value=""]),#bouts-competition option:not([value=""]),#bout-options-a li>span,#bout-options-a li>small:not(.bout-opponent-note):not(.bout-no-history),#bout-options-b li>span,#bout-options-b li>small:not(.bout-opponent-note):not(.bout-no-history)';
  function text(node){
    if(!node.parentElement||node.parentElement.closest(sourceSelector))return;
    const current=node.data,previous=texts.get(node);
    const original=previous&&current===previous.translated?previous.original:current;
    const translated=translate(original);texts.set(node,{original,translated});if(current!==translated)node.data=translated;
  }
  function element(el){
    if(['SCRIPT','STYLE','NOSCRIPT'].includes(el.tagName))return;
    const saved=attributes.get(el)||{};
    for(const key of ['aria-label','placeholder','title','data-label'])if(el.hasAttribute(key)){
      const current=el.getAttribute(key),prior=saved[key],original=prior&&current===prior.translated?prior.original:(canonical.get(current)||current),translated=translate(original);
      saved[key]={original,translated};if(current!==translated)el.setAttribute(key,translated);
    }
    attributes.set(el,saved);
  }
  function scan(root){
    if(root.nodeType===Node.TEXT_NODE){text(root);return;}
    if(root.nodeType!==Node.ELEMENT_NODE)return;
    element(root);const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
    let node;while((node=walker.nextNode())){if(node.nodeType===Node.TEXT_NODE)text(node);else element(node);}
  }
  const observer=new MutationObserver(records=>{
    const roots=new Set();for(const record of records){if(record.type==='attributes')element(record.target);else if(record.type==='characterData')text(record.target);else for(const node of record.addedNodes)roots.add(node);}
    for(const root of roots)scan(root);
  });
  const observe=()=>observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','placeholder','title','data-label']});
  function setLanguage(lang){
    if(!languages.includes(lang))return;
    observer.disconnect();language=lang;document.documentElement.lang=lang;document.querySelector('#language').value=lang;
    try{localStorage.setItem('paini-language',lang);}catch{}
    scan(document.documentElement);observe();window.dispatchEvent(new CustomEvent('paini-language-change',{detail:lang}));
  }
  window.PAINI_I18N=Object.freeze({translate,setLanguage,get language(){return language;}});
  document.querySelector('#language').addEventListener('change',event=>setLanguage(event.target.value));setLanguage(language);
})();
