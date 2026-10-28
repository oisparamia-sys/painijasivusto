'use strict';
const fs=require('fs'),vm=require('vm');const {parseLigaDB}=require('./ligadb-parser.cjs');
function update(base,R,payload){
 R.validate(base);const existing=new Map(base.competitions.map(c=>[R.compKey(c),c])),incoming=[],seen=new Set(),errors=[...payload.errors],log=[],changes=[],partial=[];let unchanged=0;
 const sig=c=>JSON.stringify(c.rows.map(r=>JSON.stringify([r.name,r.club,r.category,r.weight,r.place])).sort());
 for(const response of payload.items){try{
  const item=parseLigaDB(response.text);
  if(response.warnings?.length){
   item.importNotes=response.warnings;

  }if(item.skipped)throw Error('Ohitettuja rivejä');
  item.categoryStyles={};item.styleSources={};
  for(const category of new Set(item.rows.map(r=>r.category))){const pages=response.pages.filter(p=>R.norm(p.category)===R.norm(category));if(pages.length!==1)throw Error('Sarjavastaavuus puuttuu: '+category);const p=pages[0];if(!['greco','freestyle'].includes(p.style)||item.rows.filter(r=>r.category===category).length!==p.count)throw Error('Sarjan määrä/painimuoto ei täsmää');item.categoryStyles[category]=p.style;item.styleSources[category]=p.url;}
  if(item.rows.length!==response.pages.reduce((n,p)=>n+p.count,0))throw Error('Kokonaistulosmäärä ei täsmää');
  const key=R.compKey(item),old=existing.get(key);if(seen.has(key))throw Error('Toistuva kilpailu samassa haussa');seen.add(key);
  if(old&&sig(old)===sig(item)&&JSON.stringify(old.importNotes||[])===JSON.stringify(item.importNotes||[])){if(item.importNotes?.length)partial.push({title:item.title,details:item.details,source:response.source,rows:item.rows.length,notes:item.importNotes,status:"unchanged"});unchanged++;continue;}
  // Avoid silently deleting existing results if an official page becomes partial.
  if(old&&item.rows.length<old.rows.length)throw Error('Tulosmäärä pieneni; tarkista käsin');
  if(!old&&base.competitions.some(c=>c.source===response.source||R.norm(c.details)===R.norm(item.details)))throw Error('Mahdollinen kaksoiskilpailu; tarkista käsin');
  Object.assign(item,{source:response.source,textSource:response.textSource,fileInfo:'LigaDB · ajastettu haku · '+new Date().toISOString().slice(0,10)});
  if(item.importNotes?.length)partial.push({title:item.title,details:item.details,source:response.source,rows:item.rows.length,notes:item.importNotes,status:old?"updated":"added"});
  changes.push({partial:!!item.importNotes?.length,source:response.source,kind:old?"updated":"added",title:item.title,details:item.details,rows:item.rows.length});incoming.push(item);log.push(item.title+' · '+item.details+' · '+item.rows.length+' tulosta');
 }catch(e){errors.push({source:response.source,error:e.message});}}
 return {data:incoming.length?R.importCompetitions(base,incoming,{autoMergeNameClub:true}):base,changed:incoming.length>0,log,errors,changes,unchanged,partial};
}
module.exports={update};
if(require.main===module){const ctx={window:{}};vm.runInNewContext(fs.readFileSync('athlete-registry.js','utf8'),ctx);vm.runInNewContext(fs.readFileSync('data.js','utf8'),ctx);const R=ctx.window.PainiRegistry;const result=update(ctx.window.PAINI_SHARED_DATA,R,JSON.parse(fs.readFileSync('collected.json','utf8')));
 const now=new Date().toISOString();
 if(result.changed) { result.data.updatedAt=now;fs.writeFileSync('data.js',R.exportSource(result.data)); }
 const state={version:1,checkedAt:now,updatedAt:result.data.updatedAt||result.data.exportedAt||null,competitions:result.data.competitions.length,results:R.rows(result.data).length,added:result.changes.filter(c=>c.kind==='added').length,changed:result.changes.filter(c=>c.kind==='updated').length,unchanged:result.unchanged,changes:result.changes,partial:result.partial,errors:result.errors};
 fs.writeFileSync('haun-tila.json',JSON.stringify(state,null,2)+'\n');
 const report='# Kilpailuhaku\n\nLisätty '+state.added+', päivitetty '+state.changed+', ennallaan '+state.unchanged+'. Osittaisia kilpailuja '+result.partial.length+', tuomatta jääneitä lähteitä '+result.errors.length+'.\n\n## Lisätyt ja päivitetyt (täydellinen tuonti)\n\n'+result.changes.filter(c=>!c.partial).map(c=>'- '+c.title+' · '+c.details).join('\n')+'\n\n## Osittain tuodut kilpailut\n\n'+result.partial.map(c=>'- '+c.title+' · '+c.details+' · mukana '+c.rows+' tulosta; pois jäivät: '+c.notes.map(n=>n.category+' '+n.weight+' kg').join(', ')).join('\n')+'\n\n## Tuomatta jääneet lähteet\n\n'+result.errors.map(e=>'- '+e.source+' — '+e.error).join('\n');fs.writeFileSync('hakuraportti.md',report);if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,report);
 console.log('Päivitettyjä:',result.log.length,'tarkistettavia:',result.errors.length);}
