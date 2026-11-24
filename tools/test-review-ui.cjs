'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {comparison,proposalSummary,retainDecisions}=require('../muutosjono.js');
const row=(name,place,extra={})=>({name,place,club:'Seura',category:'Pojat',weight:'36',...extra});
function proposal(before,after){return{kind:'competition',before:{title:'Testi',details:'Helsinki, 1.1.2026',rows:before},after:{title:'Testi',details:'Helsinki, 1.1.2026',rows:after}};}
test('review distinguishes additions, removals, placement corrections and metadata-only changes',()=>{
 const p=proposal([row('A',1),row('B',2),row('D',4)],[row('A',1),row('B',3),row('C',2)]);p.after.importNotes=[{category:'Pojat',weight:'36',excluded:1}];
 const summary=proposalSummary(p);assert.deepEqual([summary.added,summary.removed,summary.changed],[1,1,1]);assert.equal(summary.metadata[0].field,'importNotes');
 const notes=proposal([row('A',1)],[row('A',1)]);notes.before.categoryStyles={Pojat:'freestyle',Tytöt:'freestyle'};notes.after.categoryStyles={Tytöt:'freestyle',Pojat:'freestyle'};
 assert.equal(proposalSummary(notes).metadata.length,0);notes.after.categoryStyles.Pojat='greco';assert.equal(proposalSummary(notes).metadata[0].field,'categoryStyles');
});
test('duplicate source names do not hide removed or changed result rows',()=>{
 const p=proposal([row('Same',1),row('Same',2),row('Same',3)],[row('Same',2),row('Same',4)]);
 const summary=proposalSummary(p);assert.equal(summary.removed,1);assert.equal(summary.changed,1);assert.equal(summary.added,0);
 assert.equal(comparison(proposal([row('A',1,{resultId:'r1'})],[row('Corrected name',1,{resultId:'r1'})])).length,1);
 assert.deepEqual(comparison(proposal([row('Same',1),row('Same',1)],[row('Same',1)])),[[row('Same',1),null]]);
});
test('bout review includes score changes and source/coverage metadata',()=>{
 const match={id:'m1',red:'r1',blue:'r2',winner:'r1',code:'PV',points:[4,2],round:'1',category:'Pojat',weight:'36',source:'https://example.test/source'};
 const p={kind:'bout-event',before:{meta:{title:'Testi',stats:{accepted:1}},matches:[match],participants:[],excluded:[],issues:[]},after:{meta:{title:'Testi',stats:{accepted:1}},matches:[{...match,points:[5,2]}],participants:[],excluded:[{people:['r3']}],issues:[]}};
 const summary=proposalSummary(p);assert.equal(summary.changed,1);assert.equal(summary.metadata[0].field,'excluded');
});
test('reloading retains decisions only for unchanged pending proposal identifiers',()=>{
 const choices=new Map([['old','approve'],['same','reject'],['done','approve']]);
 const retained=retainDecisions(choices,{proposals:[{id:'new',status:'pending'},{id:'same',status:'pending'},{id:'done',status:'approved'}]});
 assert.deepEqual([...retained],[['same','reject']]);assert.equal(choices.size,3);
});
