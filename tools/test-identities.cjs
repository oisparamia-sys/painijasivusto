'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const D=require('./review-data.cjs');
const ctx={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../athlete-registry.js'),'utf8'),ctx);const R=ctx.PainiRegistry;
function competition(title,club,name='Eino Laine'){
  return {title,details:'Helsinki, 1.1.2026',fileInfo:'testi',source:'https://turniereklassisch.ringerdb.de/VT/2026/FI/'+title+'/indexFIN.htm',rows:[{name,club,category:'Pojat',weight:'36',place:1}]};
}
function fixture(){return R.initialize({version:1,competitions:[competition('A','Seura A'),competition('B','Seura B'),competition('C','Seura C','Muu Painija')]});}
test('names merge across clubs and KLL; spelling differences remain separate; repeat is idempotent',()=>{
  const base=fixture();base.competitions[1].title='KLL';base.competitions[1].rows[0].name='  EINO  LAINE ';
  const merged=R.autoMergeNames(base),a=merged.competitions[0].rows[0],b=merged.competitions[1].rows[0];
  assert.equal(a.athleteId,b.athleteId);assert.equal(base.competitions[1].rows[0].club,b.club);assert.equal(b.name,'  EINO  LAINE ');
  assert.equal(merged.athleteRegistry.history.at(-1).assignments.length,1);
  assert.equal(JSON.stringify(R.autoMergeNames(merged)),JSON.stringify(merged));
  const imported=R.importCompetitions(merged,[competition('D','Seura A','Eino Lainé')]);
  assert.notEqual(imported.competitions[3].rows[0].athleteId,a.athleteId);
});
test('split survives export, reload, updates and new same-name rows without an indirect bridge',()=>{
  const merged=R.autoMergeNames(fixture()),id=merged.competitions[0].rows[0].athleteId,result=merged.competitions[1].rows[0].resultId;
  const split=R.split(merged,id,[result],'Eino Laine'),other=split.competitions[1].rows[0].athleteId;
  assert.ok(R.areDifferent(split,id,other));
  const reload={window:{}};vm.runInNewContext(R.exportSource(split),reload);
  const updated=R.importCompetitions(reload.window.PAINI_SHARED_DATA,[competition('D','Seura A')]);
  assert.equal(updated.competitions[0].rows[0].athleteId,id);assert.equal(updated.competitions[1].rows[0].athleteId,other);
  assert.notEqual(updated.competitions[3].rows[0].athleteId,id);assert.notEqual(updated.competitions[3].rows[0].athleteId,other);
  assert.equal(R.namePlan(updated).groups.length,0);assert.equal(R.namePlan(updated).skipped.length,1);
  assert.throws(()=>R.merge(updated,id,other),/eri henkilöiksi/);
  const same=R.importCompetitions(updated,[{...competition('B','Seura B'),rows:[{...competition('B','Seura B').rows[0],place:2}]}]);
  assert.equal(same.competitions[1].rows[0].resultId,result);assert.equal(same.competitions[1].rows[0].athleteId,other);
});
test('a further split inherits exclusions; undo retains the full reverted event and allows redoing the policy',()=>{
  let data=R.autoMergeNames(R.importCompetitions(fixture(),[competition('D','Seura A')]));
  const source=data.competitions[0].rows[0].athleteId;
  data=R.split(data,source,[data.competitions[1].rows[0].resultId],'Eino Laine');
  const other=data.competitions[1].rows[0].athleteId;
  data=R.split(data,source,[data.competitions[3].rows[0].resultId],'Eino Laine');
  const third=data.competitions[3].rows[0].athleteId;
  assert.ok(R.areDifferent(data,other,third));
  const reverted=R.undo(data);assert.equal(reverted.athleteRegistry.revertedHistory.length,1);
  assert.equal(reverted.athleteRegistry.revertedHistory[0].entry.assignments[0].after,third);
  assert.ok(R.areDifferent(reverted,source,other));R.validate(reverted);
});
test('bout participants follow result IDs through merging, splitting and undo; no bout is deleted',()=>{
  const base=fixture(),[a,b]=base.competitions;
  a.rows.push({...b.rows[0],category:'Pojat',weight:'36'});base.competitions.splice(1,1);R.validate(base);
  const bouts={version:2,competitions:[{key:a.source}],participants:a.rows.map(r=>({resultId:r.resultId,athleteId:r.athleteId,competition:a.source,category:r.category,weight:r.weight})),matches:[{id:'m1',competition:a.source,red:a.rows[0].resultId,blue:a.rows[1].resultId,winner:a.rows[0].resultId,category:'Pojat',weight:'36',code:'PV',points:[2,0],source:a.source.replace('indexFIN.htm','FIN36beg.htm')}],excluded:[],issues:[]};
  const merged=R.autoMergeNames(base),rebound=D.rebindBouts(merged,bouts);D.validateBouts(merged,rebound,R);
  assert.equal(rebound.participants[0].athleteId,rebound.participants[1].athleteId);assert.equal(rebound.matches.length,1);
  const correction=R.undoMerge(merged,0),correctedBouts=D.rebindBouts(correction,rebound);D.validateBouts(correction,correctedBouts,R);assert.notEqual(correctedBouts.participants[0].athleteId,correctedBouts.participants[1].athleteId);assert.equal(JSON.stringify(correctedBouts.matches),JSON.stringify(rebound.matches));
  const split=R.split(merged,merged.competitions[0].rows[0].athleteId,[a.rows[1].resultId],'Eino Laine'),separated=D.rebindBouts(split,rebound);
  assert.notEqual(separated.participants[0].athleteId,separated.participants[1].athleteId);D.validateBouts(split,separated,R);
  D.validateBouts(R.undo(split),D.rebindBouts(R.undo(split),separated),R);
  const broken=JSON.parse(JSON.stringify(split));broken.competitions[0].rows[0].category='Väärä';assert.throws(()=>D.rebindBouts(broken,separated),/painijaviittauksen/);
});

test('targeted merge reversal preserves unrelated later imports and permanently separates restored profiles',()=>{
 const base=fixture(),a=base.competitions[0].rows[0],b=base.competitions[1].rows[0];
 const merged=R.merge(base,b.athleteId,a.athleteId),index=merged.athleteRegistry.history.length-1;
 const later=R.importCompetitions(merged,[competition('Later','Seura D','Uusi Painija')],{autoMergeNames:false});
 assert.equal(R.mergeUndoInfo(later,index).allowed,true);
 const restored=R.undoMerge(later,index);
 assert.equal(restored.competitions[1].rows[0].athleteId,b.athleteId);
 assert.equal(JSON.stringify(restored.competitions[3]),JSON.stringify(later.competitions[3]));
 assert.equal(restored.competitions[1].rows[0].resultId,b.resultId);
 assert.ok(R.areDifferent(restored,a.athleteId,b.athleteId));
 assert.equal(JSON.stringify(R.autoMergeNames(restored).competitions),JSON.stringify(restored.competitions));
 const imported=R.importCompetitions(restored,[competition('NewSameName','Seura E')]);
 assert.notEqual(imported.competitions.at(-1).rows[0].athleteId,a.athleteId);
 assert.notEqual(imported.competitions.at(-1).rows[0].athleteId,b.athleteId);
 assert.equal(restored.athleteRegistry.history[index].label,merged.athleteRegistry.history[index].label);
 assert.equal(restored.athleteRegistry.history.at(-1).revertsMerge.historyIndex,index);
 const undone=R.undo(restored);assert.equal(undone.competitions[1].rows[0].athleteId,a.athleteId);assert.equal(R.areDifferent(undone,a.athleteId,b.athleteId),false);
 assert.equal(R.mergeUndoInfo(restored,index).allowed,false);assert.throws(()=>R.undoMerge(restored,index));
});
test('targeted merge reversal refuses later changes to touched profiles or result assignments',()=>{
 const base=fixture(),a=base.competitions[0].rows[0],b=base.competitions[1].rows[0];base.athleteRegistry.athletes.find(person=>person.id===a.athleteId).status='reviewed';
 const merged=R.merge(base,b.athleteId,a.athleteId),index=0;
 const split=R.split(merged,a.athleteId,[b.resultId],'Eri henkilö');
 assert.equal(R.mergeUndoInfo(split,index).allowed,false);assert.throws(()=>R.undoMerge(split,index));
 const changed=R.updatePerson(merged,a.athleteId,'Muuttunut nimi',false);
 assert.equal(R.mergeUndoInfo(changed,index).allowed,false);const before=JSON.stringify(changed);assert.throws(()=>R.undoMerge(changed,index));assert.equal(JSON.stringify(changed),before);
});

test('reversing one wrestler from a batch merge leaves all other merged groups unchanged',()=>{
 const base=R.initialize({version:1,competitions:[competition('A','Seura A','Eino Laine'),competition('B','Seura B','Eino Laine'),competition('C','Seura C','Leo Testi'),competition('D','Seura D','Leo Testi')]});
 const merged=R.autoMergeNames(base),eino=merged.competitions[0].rows[0].athleteId,leo=merged.competitions[2].rows[0].athleteId;
 assert.equal(R.mergeUndoInfo(merged,0).groups,2);assert.equal(R.mergeUndoInfo(merged,0).allowed,false);assert.throws(()=>R.undoMerge(merged,0));assert.equal(R.mergeUndoInfo(merged,0,eino).results,1);
 const next=R.undoMerge(merged,0,eino);
 assert.equal(next.competitions[2].rows[0].athleteId,leo);assert.equal(next.competitions[3].rows[0].athleteId,leo);
 assert.notEqual(next.competitions[0].rows[0].athleteId,next.competitions[1].rows[0].athleteId);
 assert.equal(R.mergeUndoInfo(next,0,leo).allowed,true);assert.equal(R.mergeUndoInfo(next,0,eino).allowed,false);
 const context={window:{}};vm.runInNewContext(R.exportSource(next),context);const reloaded=R.autoMergeNames(context.window.PAINI_SHARED_DATA);
 assert.equal(JSON.stringify(reloaded.competitions),JSON.stringify(next.competitions));
 assert.equal(R.undoMerge(next,0,leo).competitions[3].rows[0].athleteId,base.competitions[3].rows[0].athleteId);
 assert.equal(next.athleteRegistry.nextAthlete,merged.athleteRegistry.nextAthlete);
});
