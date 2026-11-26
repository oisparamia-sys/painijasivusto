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
function build(directory='.'){
  const context=vm.createContext({window:{}});
  vm.runInContext(fs.readFileSync(path.join(directory,'ottelut-data.js'),'utf8'),context,{timeout:15000});
  const packed=pack(context.window.PAINI_BOUTS_DATA),content=JSON.stringify(packed);
  const revision=crypto.createHash('sha256').update(content).digest('hex');
  const manifest=JSON.stringify({version:1,file:'ottelut-public.json',revision,checkedAt:packed.checkedAt});
  const files=[['ottelut-public.json',content],['ottelut-manifest.json',manifest]];
  if(fs.existsSync(path.join(directory,'data.js'))){
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../athlete-registry.js'),'utf8'),context,{timeout:15000});
    vm.runInContext(fs.readFileSync(path.join(directory,'data.js'),'utf8'),context,{timeout:15000});
    context.window.PainiRegistry.validate(context.window.PAINI_SHARED_DATA);
    const coverage=require('../site-metrics.js').coverage(context.window.PAINI_SHARED_DATA,context.window.PAINI_BOUTS_DATA);
    files.push(['kattavuus.json',JSON.stringify(coverage)]);
    const digest=text=>crypto.createHash('sha256').update(text).digest('hex');
    const descriptors={results:{file:'data.js',sha256:digest(fs.readFileSync(path.join(directory,'data.js')))},bouts:{file:'ottelut-public.json',sha256:digest(content+'\n')},coverage:{file:'kattavuus.json',sha256:digest(JSON.stringify(coverage)+'\n')}};
    files.push(['aineisto-manifest.json',JSON.stringify({version:1,revision:digest(JSON.stringify(descriptors)),files:descriptors})]);
  }
  for(const [name,text] of files){
    const file=path.join(directory,name);fs.writeFileSync(file+'.tmp',text+'\n');fs.renameSync(file+'.tmp',file);
  }
  console.log('Julkinen otteluaineisto:',packed.matches.length,'ottelua,',Buffer.byteLength(content),'tavua');
  return packed;
}
if(require.main===module)build(process.argv[2]||'.');
module.exports={pack,build};
