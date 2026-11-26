'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{summarize}=require('../bout-report-admin.js');
test('admin summary follows current result identifiers after a split and counts a person once',()=>{
 const data={competitions:[{rows:[{resultId:'r1',athleteId:'new-a'},{resultId:'r2',athleteId:'b'},{resultId:'r3',athleteId:'b'}]}]},packed={version:3,competitions:[{year:2022},{year:2026}],participants:[['r1','old-a'],['r2','b'],['r3','b']],matches:[{},{}]};
 assert.deepEqual(summarize(data,packed),{competitions:2,matches:2,people:2,missingPeople:0,years:'2022–2026'});packed.participants.push(['missing','old-c']);assert.equal(summarize(data,packed).missingPeople,1);
});
test('empty summaries do not invent years and invalid packed formats are rejected',()=>{
 assert.equal(summarize({competitions:[]},{version:3,competitions:[],participants:[],matches:[]}).years,'ei tiedossa');assert.throws(()=>summarize({competitions:[]},{version:2}));
});
