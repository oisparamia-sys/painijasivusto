'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),M=require('../site-metrics.js');
const row=(id,athleteId,club,place)=>({resultId:id,athleteId,name:athleteId,club,place,category:'Pojat',weight:'36'});
const competition=(title,source,rows,extra={})=>({title,source,details:'Helsinki, 1.1.2026',rows,...extra});
test('coverage reports observed denominators, absent points and ambiguous identities without double counting',()=>{
 const data={exportedAt:'v1',competitions:[competition('SM','a',[row('r1','p1','A',1),row('r2','p2','B',2),row('r3','p1','A',3)]),competition('Other','b',[],{importNotes:[{excluded:2}]})]};
 const bout=(id,blue,points,code='PV')=>({id,competition:'a',red:'r1',blue,winner:'r1',points,code});
 const result=M.coverage(data,{checkedAt:'today',competitions:[{key:'a'}],matches:[bout('m1','r2',[0,0]),bout('m2','r2',null),bout('m3','r3',[4,2],'UNKNOWN')],excluded:[{competition:'a',people:['r1','r2','r3']}]});
 assert.equal(result.total.matches,3);assert.equal(result.total.points,2);assert.equal(result.total.methods,2);assert.equal(result.total.acceptedPercent,75);assert.equal(result.total.withoutNotes,1);
 assert.equal(result.athletes.p1.matches,3);assert.equal(result.athletes.p1.identityConflicts,1);assert.equal(result.athletes.p1.excluded,1);
 assert.equal(result.competitions.b.scanned,false);assert.equal(result.competitions.b.pointsPercent,null);assert.equal(M.ratio(0,0),null);
});
test('club profiles combine case/spacing only and preserve distinct source labels and KLL-only labels',()=>{
 const data={competitions:[competition('Open','a',[row('1','p1','Seura A',1),row('2','p2',' seura  a ',2),row('3','p3','Seura-A',3)]),competition('KLL','b',[row('4','p1','Helsinki',1)])]};
 const clubs=M.clubs(data);assert.equal(clubs.length,3);const a=clubs.find(c=>c.id==='seura a');assert.equal(a.entries.length,2);assert.equal(a.athletes.size,2);assert.equal(a.onlyKll,false);assert.equal(clubs.find(c=>c.id==='helsinki').onlyKll,true);
 assert.equal(M.standings(data.competitions[0]).medals,3);
});
test('career highlights select the best SM placing, retain KLL as a separate tier and keep all entries immutable',()=>{
 const entries=[{item:{title:'SM-kilpailut',date:1},result:{place:3}},{item:{title:'SM-kilpailut',date:2},result:{place:2}},{item:{title:'KLL SM-kilpailut',date:4},result:{place:1}},{item:{title:'Cup',date:3},result:{place:1}}];
 const before=JSON.stringify(entries),result=M.highlights(entries,c=>c.date);assert.equal(result.bestSm.result.place,2);assert.equal(result.wins,2);assert.equal(result.recent[0].item.title,'KLL SM-kilpailut');assert.equal(JSON.stringify(entries),before);
});
