'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib');
const Q=require('./review-core.cjs'),{update}=require('./update-data.cjs'),D=require('./review-data.cjs');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../athlete-registry.js'),'utf8'),ctx);const R=ctx.window.PainiRegistry;
const source='https://turniereklassisch.ringerdb.de/VT/2025/FI/251204_Tampere/indexFIN.htm';
const source2='https://turniereklassisch.ringerdb.de/VT/2026/FI/260131_Helsinki/indexFIN.htm';
const clone=Q.copy;
function state(){const data=R.initialize({version:1,competitions:[{title:'Testipainit',details:'Tampere, 4.12.2025',fileInfo:'testi',source,categoryStyles:{Pojat:'freestyle'},styleSources:{Pojat:source},rows:[{name:'A Testi',club:'Seura',category:'Pojat',weight:'30',place:1},{name:'B Testi',club:'Seura',category:'Pojat',weight:'30',place:2}]}]});
const rows=data.competitions[0].rows,bouts={version:2,checkedAt:'2026-11-16T00:00:00Z',competitions:[{key:source,title:'Testipainit',details:'Tampere, 4.12.2025',year:2025,stats:{accepted:1,excluded:0,unmatchedNumbered:0,unreadable:0}}],participants:rows.map(r=>({competition:source,resultId:r.resultId,athleteId:r.athleteId,category:r.category,weight:r.weight})),matches:[{id:'m1',competition:source,category:'Pojat',weight:'30',round:'1',red:rows[0].resultId,blue:rows[1].resultId,winner:rows[0].resultId,code:'PV',points:[4,2],source:source.replace('indexFIN.htm','FIN30beg.htm'),comparisonSource:source.replace('indexFIN.htm','FINKF1.htm')}],excluded:[],issues:[],errors:[]};return{R,data,bouts};}
function payload(c){return{errors:[],items:[{source:c.source,textSource:c.source,text:c.title+'\n'+c.details+'\n30 kg\tPojat\n'+c.rows.map(r=>r.place+'.\t'+r.name+'\t'+r.club).join('\n'),pages:[{category:'Pojat',style:'freestyle',count:c.rows.length,url:c.source}]}]};}
function queue(){return{version:1,proposals:[],history:[]};}
function decision(p,action='approve'){return{version:1,decisions:[{id:p.id,action,beforeHash:p.beforeHash,afterHash:p.afterHash}]};}
test('old changed standings are queued without changing accepted data',()=>{const s=state(),c=clone(s.data.competitions[0]);c.rows.reverse().forEach((r,i)=>r.place=i+1);const before=Q.hash(s.data),q=queue(),result=update(s.data,R,payload(c),q);assert.equal(Q.hash(result.data),before);assert.equal(q.proposals.length,1);assert.equal(q.proposals[0].status,'pending');});
test('old missing rows cannot be deleted automatically',()=>{const s=state(),c=clone(s.data.competitions[0]);c.rows.pop();const result=update(s.data,R,payload(c),queue());assert.equal(result.data.competitions[0].rows.length,2);assert.equal(result.queue.proposals.length,1);});
test('new competition attaches identical names while keeping old identity assignments',()=>{const s=state(),c=clone(s.data.competitions[0]);c.title='Uusi kilpailu';c.details='Helsinki, 31.1.2026';c.source=source2;const old=s.data.competitions[0].rows[0].athleteId,result=update(s.data,R,payload(c),queue());assert.equal(result.data.competitions.length,2);assert.equal(result.data.competitions[0].rows[0].athleteId,old);assert.equal(result.data.competitions[1].rows[0].athleteId,old);});
test('unchanged source withdraws pending proposal; repeating rejected content stays rejected',()=>{const s=state(),old=s.data.competitions[0],after=clone(old);after.rows[0].place=2;const q=queue(),p=Q.propose(q,'competition',source,old,after,'testi');p.status='rejected';assert.equal(Q.propose(q,'competition',source,old,after,'testi').status,'rejected');p.status='pending';update(s.data,R,payload(old),q);assert.equal(p.status,'withdrawn');});
test('approve standings changes preserves result IDs and bouts',()=>{const s=state(),old=s.data.competitions[0],after=clone(old);after.rows[0].place=2;after.rows[1].place=1;const q=queue(),p=Q.propose(q,'competition',source,old,after,'testi'),result=D.apply(s,q,decision(p));assert.equal(result.data.competitions[0].rows[0].place,2);assert.equal(result.data.competitions[0].rows[0].resultId,old.rows[0].resultId);D.validateBouts(result.data,result.bouts,R);assert.equal(result.queue.proposals[0].status,'approved');assert.equal(q.proposals[0].status,'pending');});
test('approve title correction matches by source; registry undo restores old event',()=>{const s=state(),old=s.data.competitions[0],after=clone(old);after.title='Korjattu otsikko';const q=queue(),p=Q.propose(q,'competition',source,old,after,'testi'),result=D.apply(s,q,decision(p));assert.equal(result.data.competitions.length,1);assert.equal(result.data.competitions[0].title,after.title);const reverted=R.undo(result.data);assert.equal(reverted.competitions.length,1);assert.equal(reverted.competitions[0].title,old.title);});
test('approve changed bout points and winner, and reject without changing accepted data',()=>{const s=state(),before=D.event(s.bouts,source),after=clone(before);after.matches[0].points=[2,4];after.matches[0].winner=after.matches[0].blue;const q=queue(),p=Q.propose(q,'bout-event',source,before,after,'testi'),approved=D.apply(s,q,decision(p)),rejected=D.apply(s,q,decision(p,'reject'));assert.equal(approved.bouts.matches[0].winner,after.matches[0].blue);assert.equal(Q.hash(rejected.bouts),Q.hash(s.bouts));assert.equal(rejected.queue.proposals[0].status,'rejected');});
test('tampered, stale, duplicated and conflicting decisions are rejected',()=>{const s=state(),before=D.event(s.bouts,source),after=clone(before);after.matches[0].points=[1,0];const q=queue(),p=Q.propose(q,'bout-event',source,before,after,'testi');for(const mode of ['stale','tampered','duplicate','wrong-action']){const qc=clone(q),doc=decision(p),sc={...s,bouts:clone(s.bouts)};if(mode==='stale')sc.bouts.matches[0].points=[99,1];if(mode==='tampered')qc.proposals[0].after.matches[0].winner='other';if(mode==='duplicate')doc.decisions.push(doc.decisions[0]);if(mode==='wrong-action')doc.decisions[0].action='erase';assert.throws(()=>D.apply(sc,qc,doc));}});
test('name correction cannot break accepted bout result references',()=>{const s=state(),old=s.data.competitions[0],after=clone(old);after.rows[0].name='Eri henkilö';const q=queue(),p=Q.propose(q,'competition',source,old,after,'testi');assert.throws(()=>D.apply(s,q,decision(p)),/painijaviittauksen/);assert.equal(s.data.competitions[0].rows[0].name,'A Testi');});
test('a bad later decision rolls back the whole batch',()=>{const s=state(),old=s.data.competitions[0],after=clone(old);after.rows[0].place=2;const q=queue(),p=Q.propose(q,'competition',source,old,after,'testi'),doc=decision(p);doc.decisions.push({id:'missing',action:'approve'});assert.throws(()=>D.apply(s,q,doc));assert.equal(s.data.competitions[0].rows[0].place,1);assert.equal(q.proposals[0].status,'pending');});
test('archive snapshots are lossless, deduplicated and restore the prior data',()=>{const temp=fs.mkdtempSync(path.join(os.tmpdir(),'paini-store-'));try{const s=state();fs.writeFileSync(path.join(temp,'data.js'),R.exportSource(s.data));fs.writeFileSync(path.join(temp,'ottelut-data.js'),'window.PAINI_BOUTS_DATA = '+JSON.stringify(s.bouts)+';');Q.snapshot(temp,'before');s.bouts.checkedAt='2026-11-17T00:00:00Z';fs.writeFileSync(path.join(temp,'ottelut-data.js'),'window.PAINI_BOUTS_DATA = '+JSON.stringify(s.bouts)+';');Q.snapshot(temp,'after');const index=JSON.parse(fs.readFileSync(path.join(temp,'tietovarasto/index.json')));assert.equal(index.versions.length,2);assert.equal(index.runs.length,2);const v=index.versions.find(v=>v.file==='data.js');assert.equal(zlib.gunzipSync(fs.readFileSync(path.join(temp,v.blob))).toString(),fs.readFileSync(path.join(temp,'data.js'),'utf8'));}finally{fs.rmSync(temp,{recursive:true,force:true});}});

function withArchive(run){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'paini-archive-'));
 try{
  const s=state();
  fs.writeFileSync(path.join(temp,'data.js'),R.exportSource(s.data));
  const writeBouts=()=>fs.writeFileSync(path.join(temp,'ottelut-data.js'),'window.PAINI_BOUTS_DATA = '+JSON.stringify(s.bouts)+';');
  writeBouts();run(temp,s,writeBouts);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
test('archive preserves changes in source evidence and excluded bouts without changing accepted matches',()=>withArchive((temp,s,writeBouts)=>{
 Q.snapshot(temp,'before');
 const matches=JSON.stringify(s.bouts.matches);
 const edits=[
  ()=>s.bouts.excluded.push({competition:source,reason:'Lähteiden tulokset eroavat',source}),
  ()=>s.bouts.issues.push({source,error:'Vertailulähde puuttuu'}),
  ()=>s.bouts.competitions[0].comparisonMethod='both-participant-profiles',
  ()=>s.bouts.errors.push({source,error:'Lähde ei vastannut'})
 ];
 for(const edit of edits){
  edit();writeBouts();const refs=Q.snapshot(temp,'source-change');
  const index=JSON.parse(fs.readFileSync(path.join(temp,'tietovarasto/index.json')));
  const v=index.versions.find(v=>v.file==='ottelut-data.js'&&v.sha256===refs['ottelut-data.js']);
  assert.equal(zlib.gunzipSync(fs.readFileSync(path.join(temp,v.blob))).toString(),fs.readFileSync(path.join(temp,'ottelut-data.js'),'utf8'));
 }
 assert.equal(JSON.stringify(s.bouts.matches),matches);
 const index=JSON.parse(fs.readFileSync(path.join(temp,'tietovarasto/index.json')));
 assert.equal(index.versions.filter(v=>v.file==='ottelut-data.js').length,5);
}));
test('archive rejects a missing or damaged reused backup without recording a successful run',()=>{
 for(const damage of ['missing','gzip','checksum'])withArchive((temp)=>{
  Q.snapshot(temp,'before');
  const indexPath=path.join(temp,'tietovarasto/index.json'),before=fs.readFileSync(indexPath,'utf8');
  const index=JSON.parse(before),blob=path.join(temp,index.versions[0].blob);
  if(damage==='missing')fs.unlinkSync(blob);
  if(damage==='gzip')fs.writeFileSync(blob,'rikki');
  if(damage==='checksum')fs.writeFileSync(blob,zlib.gzipSync(Buffer.from('eri aineisto')));
  assert.throws(()=>Q.snapshot(temp,'after'),/Varmuuskopion tarkistus epäonnistui/);
  assert.equal(fs.readFileSync(indexPath,'utf8'),before);
 });
});

test('official TXT-only friendship results accept an explicit unknown style without guessing',()=>{
 const s=state();
 const response={source:source2,textSource:source2.replace('indexFIN.htm','FIN1_tab.txt'),text:'Uusi kilpailu\nHelsinki, 31.1.2026\n90 kg\tYstävyysottelu\t(1 Osallistujaa)\n\t1.\tC Testi\tSeura',pages:[{category:'Ystävyysottelu',style:'unknown',verification:'official-txt',count:1,url:source2.replace('indexFIN.htm','FIN1_tab.txt')}]};
 const result=update(s.data,R,{items:[response],errors:[]},queue());
 assert.equal(result.errors.length,0);assert.equal(result.data.competitions.length,2);
 assert.equal(result.data.competitions[1].categoryStyles['Ystävyysottelu'],'unknown');
 assert.equal(result.data.competitions[1].textSource,response.textSource);
 delete response.pages[0].verification;
 const rejected=update(s.data,R,{items:[response],errors:[]},queue());
 assert.equal(rejected.errors.length,1);assert.equal(rejected.data.competitions.length,1);
});
test('additional verified standings in an old weight class are queued and preserve old IDs on approval',()=>{
 const s=state(),candidate=clone(s.data.competitions[0]);
 candidate.rows.push({name:'C Testi',club:'Seura',category:'Pojat',weight:'30',place:3});
 const incoming=payload(candidate);incoming.items[0].warnings=[{category:'Pojat',weight:'30',included:3,excluded:1,unranked:1,source}];
 const result=update(s.data,R,incoming,queue());
 assert.equal(Q.hash(result.data),Q.hash(s.data));assert.equal(result.queue.proposals.length,1);
 const p=result.queue.proposals[0];assert.equal(p.after.importNotes[0].included,3);
 const approved=D.apply(s,result.queue,decision(p));
 assert.equal(approved.data.competitions[0].rows.length,3);
 for(let i=0;i<2;i++)assert.equal(approved.data.competitions[0].rows[i].resultId,s.data.competitions[0].rows[i].resultId);
 assert.equal(JSON.stringify(approved.bouts.matches),JSON.stringify(s.bouts.matches));
});
