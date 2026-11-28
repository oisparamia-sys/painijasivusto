"use strict";
// Build the small public view; the complete verified dataset and reports remain authoritative.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
function pack(data){
  if(data?.version!==2)throw Error('Otteluaineiston versio ei kelpaa');
  const competitions=data.competitions.map(c=>({...c}));
  const compIndex=new Map(competitions.map((c,i)=>[c.key,i]));
  const peopleIndex=new Map(data.participants.map((p,i)=>[p.resultId,i]));
  if(compIndex.size!==competitions.length||peopleIndex.size!==data.participants.length)throw Error('Toistuva tunnus');
  const ci=key=>{const i=compIndex.get(key);if(i===undefined)throw Error('Kilpailuviittaus puuttuu');return i;};
  const pi=key=>{const i=peopleIndex.get(key);if(i===undefined)throw Error('Tulosviittaus puuttuu');return i;};
  const participants=data.participants.map(p=>[p.resultId,p.athleteId,ci(p.competition),p.category,p.weight]);
  const ids=new Set();
  const matches=data.matches.map(m=>{
    const c=ci(m.competition),red=pi(m.red),blue=pi(m.blue),winner=pi(m.winner);
    if(ids.has(m.id)||red===blue||![red,blue].includes(winner)||[red,blue].some(i=>participants[i][2]!==c))throw Error('Ottelun viittaukset eivät kelpaa');
    ids.add(m.id);
    const base=new URL('.',competitions[c].key),source=new URL(m.source);
    if(source.origin!==base.origin||new URL('.',source).href!==base.href||source.search||source.hash)throw Error('Ottelulähde ei kuulu kilpailuun');
    return [m.id,c,m.category,m.weight,m.round,red,blue,winner,m.code,m.points,source.pathname.split('/').pop()];
  });
  const excluded=data.excluded.map(e=>[ci(e.competition),e.people.filter(id=>peopleIndex.has(id)).map(pi)]);
  return {version:3,checkedAt:data.checkedAt,competitions,participants,matches,excluded,searchSummary:data.searchSummary,coverageMissing:data.coverageMissing};
}
function build(directory='.',{recordHistory=false,at=new Date().toISOString()}={}){
  const context=vm.createContext({window:{}}),database=require('./shared-database.cjs').read(directory);
  if(database)context.window.PAINI_BOUTS_DATA=database.bouts;else vm.runInContext(fs.readFileSync(path.join(directory,'ottelut-data.js'),'utf8'),context,{timeout:15000});
  const packed=pack(context.window.PAINI_BOUTS_DATA),content=JSON.stringify(packed);
  const revision=crypto.createHash('sha256').update(content).digest('hex');
  const manifest=JSON.stringify({version:1,file:'ottelut-public.json',revision,checkedAt:packed.checkedAt});
  const files=[['ottelut-public.json',content],['ottelut-manifest.json',manifest]];
  if(fs.existsSync(path.join(directory,'data.js'))){
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../athlete-registry.js'),'utf8'),context,{timeout:15000});
    if(database)context.window.PAINI_SHARED_DATA=database.data;else vm.runInContext(fs.readFileSync(path.join(directory,'data.js'),'utf8'),context,{timeout:15000});
    context.window.PainiRegistry.validate(context.window.PAINI_SHARED_DATA);
    const coverage=require('../site-metrics.js').coverage(context.window.PAINI_SHARED_DATA,context.window.PAINI_BOUTS_DATA);
    files.push(['kattavuus.json',JSON.stringify(coverage)]);
    const historyTool=require('./coverage-history.cjs');let history=historyTool.read(directory);
    if(recordHistory)history=historyTool.append(history,coverage,at);
    if(history.samples.length)files.push(['kattavuushistoria.json',JSON.stringify(history)]);
    const digest=text=>crypto.createHash('sha256').update(text).digest('hex');
    const descriptors={results:require('./export-results.cjs').build(context.window.PAINI_SHARED_DATA,directory),bouts:{file:'ottelut-public.json',sha256:digest(content+'\n')},coverage:{file:'kattavuus.json',sha256:digest(JSON.stringify(coverage)+'\n')}};
    const data=context.window.PAINI_SHARED_DATA;
    const date=c=>{const m=c.details.match(/(\d{1,2})(?:[.–-]\d{1,2})?[./](\d{1,2})[./](20\d{2})/);return m?Date.UTC(+m[3],+m[2]-1,+m[1]):0;};
    const overview={version:1,resultsVersion:coverage.resultsVersion,total:{competitions:data.competitions.length,results:coverage.total.results,matches:coverage.total.matches},years:[...new Set(data.competitions.map(c=>new Date(date(c)).getUTCFullYear()).filter(y=>y>=2020))].sort((a,b)=>b-a),latest:[...data.competitions].sort((a,b)=>date(b)-date(a)||a.title.localeCompare(b.title,'fi')).slice(0,6).map(c=>({source:c.source,title:c.title,details:c.details,date:date(c),rows:c.rows.length}))};
    const overviewText=JSON.stringify(overview)+'\n';files.push(['etusivu-aineisto.json',overviewText.trimEnd()]);descriptors.home={file:'etusivu-aineisto.json',sha256:digest(overviewText)};
    if(history.samples.length)descriptors.coverageHistory={file:'kattavuushistoria.json',sha256:digest(JSON.stringify(history)+'\n')};
    if(database){const text=JSON.stringify({issues:database.bouts.issues,excluded:database.bouts.excluded})+'\n';files.push(['database-issues.json',text.trimEnd()]);const status=JSON.parse(fs.readFileSync(path.join(directory,'tietokanta-tila.json'),'utf8'));files.push(['database-public-index.json',JSON.stringify({...status,sourceIndex:{file:'tietovarasto/lahdehistoria.jsonl',sha256:database.metadata.archive_sha256},issues:{file:'database-issues.json',sha256:digest(text)}})]);}
    files.push(['aineisto-manifest.json',JSON.stringify({version:2,revision:digest(JSON.stringify({descriptors,databaseRevision:database?.metadata.revision||null})),databaseRevision:database?.metadata.revision||null,files:descriptors})]);
  }
  for(const [name,text] of files){
    const file=path.join(directory,name);fs.writeFileSync(file+'.tmp',text+'\n');fs.renameSync(file+'.tmp',file);
  }
  console.log('Julkinen otteluaineisto:',packed.matches.length,'ottelua,',Buffer.byteLength(content),'tavua');
  return packed;
}
if(require.main===module)build(process.argv[2]||'.',{recordHistory:true});
module.exports={pack,build};
