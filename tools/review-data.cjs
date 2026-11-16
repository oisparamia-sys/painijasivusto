'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const Q=require('./review-core.cjs');
function load(root='.') {const ctx={window:{}};for(const file of ['athlete-registry.js','data.js','ottelut-data.js']){const p=path.join(root,file);if(fs.existsSync(p))vm.runInNewContext(fs.readFileSync(p,'utf8'),ctx,{timeout:15000});}return{R:ctx.window.PainiRegistry,data:ctx.window.PAINI_SHARED_DATA,bouts:ctx.window.PAINI_BOUTS_DATA};}
function event(bouts,target){const meta=bouts?.competitions.find(c=>c.key===target);return meta?{meta,participants:bouts.participants.filter(p=>p.competition===target),matches:bouts.matches.filter(m=>m.competition===target),excluded:bouts.excluded.filter(e=>e.competition===target),issues:bouts.issues.filter(i=>(i.source||'').startsWith(target.slice(0,target.lastIndexOf('/')+1)))}:null;}
function validateBouts(data,bouts,R){
 if(!bouts)return;
 const rows=new Map(data.competitions.flatMap(c=>c.rows.map(r=>[r.resultId,{...r,competition:c.source}]))),people=new Map(),events=new Set(bouts.competitions.map(c=>c.key)),ids=new Set();
 const records=new Map(data.athleteRegistry.athletes.map(a=>[a.id,a]));
 const resolve=id=>{const seen=new Set();let p=records.get(id);while(p?.mergedInto){if(seen.has(p.id))throw Error('Painijarekisterin kehä');seen.add(p.id);p=records.get(p.mergedInto);}return p?.id;};
 for(const p of bouts.participants){const r=rows.get(p.resultId);if(people.has(p.resultId)||!r||r.competition!==p.competition||r.category!==p.category||r.weight!==p.weight||resolve(r.athleteId)!==resolve(p.athleteId))throw Error('Muutos rikkoisi aiemman ottelun painijaviittauksen. Tarkista tunnusten yhdistäminen erikseen.');people.set(p.resultId,p);}
 const methods=new Set(['SV','PV','YPV','VFA','VPO','VPO1','VSU','VSU1','VP','VT','GS','FI','LOUK']);
 for(const m of bouts.matches){const red=people.get(m.red),blue=people.get(m.blue);if(ids.has(m.id)||!events.has(m.competition)||!red||!blue||red.competition!==m.competition||blue.competition!==m.competition||red.category!==m.category||blue.category!==m.category||red.weight!==m.weight||blue.weight!==m.weight||resolve(red.athleteId)===resolve(blue.athleteId)||![m.red,m.blue].includes(m.winner)||!methods.has(m.code)||m.points!==null&&(!Array.isArray(m.points)||m.points.length!==2||m.points.some(n=>!Number.isInteger(n)||n<0)))throw Error('Ottelun tunnukset tai tulos eivät kelpaa');ids.add(m.id);const url=new URL(m.source);if(url.protocol!=='https:'||url.hostname!=='turniereklassisch.ringerdb.de'||url.username||url.password||new URL('.',url).href!==new URL('.',m.competition).href)throw Error('Ottelun lähde ei kelpaa');}
}
function apply(state,queue,document){
 const {R}=state;let data=state.data,bouts=state.bouts;
 const q=Q.copy(queue);
 if(document.version!==1||!Array.isArray(document.decisions)||document.decisions.length>500||new Set(document.decisions.map(d=>d.id)).size!==document.decisions.length)throw Error('Päätöstiedosto ei kelpaa');
 for(const d of document.decisions){
  if(!['approve','reject'].includes(d.action))throw Error('Tuntematon päätös');
  const p=q.proposals.find(p=>p.id===d.id);if(!p)throw Error('Ehdotusta ei löydy: '+d.id);
  if(p.status!=='pending'){
   if((p.status==='approved'&&d.action==='approve')||(p.status==='rejected'&&d.action==='reject'))continue;
   throw Error('Ehdotus ei enää odota päätöstä. Lataa uusi jono.');
  }
  if(Q.hash(p.before)!==p.beforeHash||Q.hash(p.after)!==p.afterHash||Q.hash({kind:p.kind,target:p.target,beforeHash:p.beforeHash,afterHash:p.afterHash})!==p.id)throw Error('Ehdotuksen tarkistussumma ei täsmää');
  if(d.beforeHash!==p.beforeHash||d.afterHash!==p.afterHash)throw Error('Päätös koskee eri versiota ehdotuksesta');
  if(d.action==='approve'){
   if(p.kind==='competition'){
    const current=data.competitions.filter(c=>c.source===p.target);
    if(current.length!==1||Q.hash(current[0])!==p.beforeHash)throw Error('Kilpailu on muuttunut esikatselun jälkeen. Lataa uusi jono.');
    const candidate={...p.after,source:p.target};
    const collision=data.competitions.find(c=>R.compKey(c)===R.compKey(candidate)&&c.source!==p.target);if(collision)throw Error('Kilpailun nimi ja aika törmäävät toiseen kilpailuun');
    data=R.importCompetitions(data,[candidate],{autoMergeNameClub:false,matchBySource:true});
   }else if(p.kind==='bout-event'){
    if(Q.hash(event(bouts,p.target))!==p.beforeHash)throw Error('Ottelut ovat muuttuneet esikatselun jälkeen. Lataa uusi jono.');
    const next=Q.copy(bouts),after=p.after;
    if(after.meta.key!==p.target||after.matches.some(m=>m.competition!==p.target)||after.participants.some(p2=>p2.competition!==p.target))throw Error('Ehdotuksen kilpailuviittaus ei kelpaa');
    next.competitions=next.competitions.filter(c=>c.key!==p.target).concat(after.meta);
    for(const field of ['participants','matches','excluded'])next[field]=next[field].filter(row=>row.competition!==p.target).concat(after[field]);
    next.issues=next.issues.filter(i=>!(i.source||'').startsWith(p.target.slice(0,p.target.lastIndexOf('/')+1))).concat(after.issues||[]);
    bouts=next;
   }else throw Error('Tuntematon ehdotustyyppi');
   R.validate(data);validateBouts(data,bouts,R);
  }
  p.status=d.action==='approve'?'approved':'rejected';p.decidedAt=new Date().toISOString();
  q.history.push({id:p.id,action:d.action,at:p.decidedAt,run:process.env.GITHUB_RUN_ID||null});
 }
 return{data,bouts,queue:q};
}
function ingest(root='.'){
 const file=path.join(root,'muutosjono.json'),q=Q.readQueue(file),reportPath=path.join(root,'ottelut-raportti.json');
 if(fs.existsSync(reportPath)){const report=JSON.parse(fs.readFileSync(reportPath));
 for(const target of report.unchangedTargets||[])Q.withdraw(q,'bout-event',target);
 for(const p of report.proposals||[])Q.propose(q,'bout-event',p.target,p.before,p.after,'Ottelun tulos muuttui tai aiempi ottelu puuttuu lähteestä.');
 }
 Q.saveQueue(q,file);console.log('Odottaa hyväksyntää:',q.proposals.filter(p=>p.status==='pending').length);
}
function applyFiles(root='.'){
 const file=path.join(root,'hyvaksyntapaatokset.json');if(!fs.existsSync(file))return;
 const document=JSON.parse(fs.readFileSync(file));if(!document.decisions?.length)return;
 const state=load(root),queue=Q.readQueue(path.join(root,'muutosjono.json')),result=apply(state,queue,document);
 // Nothing is written until the whole batch and all references validate.
 if(Q.hash(result.data)!==Q.hash(state.data)){result.data.updatedAt=new Date().toISOString();Q.atomic(path.join(root,'data.js'),state.R.exportSource(result.data));}
 if(Q.hash(result.bouts)!==Q.hash(state.bouts))Q.atomic(path.join(root,'ottelut-data.js'),'"use strict";\nwindow.PAINI_BOUTS_DATA = '+JSON.stringify(result.bouts).replace(/</g,'\\u003c')+';\n');
 Q.saveQueue(result.queue,path.join(root,'muutosjono.json'));
 Q.atomic(file,JSON.stringify({version:1,decisions:[]},null,2)+'\n');
 const report='# Ylläpidon päätökset\n\nKäsitelty '+document.decisions.length+' päätöstä. Hyväksytty '+document.decisions.filter(d=>d.action==='approve').length+', hylätty '+document.decisions.filter(d=>d.action==='reject').length+'.\n';
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,report);
 console.log('Käsitelty päätöksiä:',document.decisions.length);
}
if(require.main===module){const mode=process.argv[2],root=process.argv[3]||'.';if(mode==='snapshot')Q.snapshot(root,process.argv[4]||'snapshot');else if(mode==='ingest')ingest(root);else if(mode==='apply')applyFiles(root);else throw Error('Tuntematon toiminto');}
module.exports={load,event,validateBouts,apply,ingest,applyFiles};
