'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const B=require('../ottelut.js');
const people=['Aleksi Mäki','Aleksis Makinen','Anni Niemi','Anneli Nimi','Urho Susi','Mikael Pyysalo','John Smith','Li An','李 明'].map((name,i)=>({id:'p'+i,nameWords:B.words(name)}));
people[0].nameWords.push(...B.words('Aleksi vanha nimi'));
const ids=values=>[...values].sort();
test('indexed fuzzy and strict search match the previous rules, including aliases and empty queries',()=>{
 const index=B.createSearch(people);
 for(const query of ['', 'a','al','ale','alek','aleks','aleksi','aleksi mä','aleksi maki','alekis','ale','urho suis','urho su','mikael','mikale','john smtih','li','an','xx','李'])for(const strict of [false,true]){
  const words=B.words(query),expected=people.filter(p=>(strict?B.matchesStrictly:B.matchesName)(p,words)).map(p=>p.id);
  assert.deepEqual(ids(index.find(words,strict)),ids(expected),query+' strict='+strict);
 }
 // Cache eviction must not alter earlier results.
 for(let i=0;i<80;i++)index.find(B.words('search'+i));
 assert.deepEqual(ids(index.find(B.words('aleksi'))),ids(people.filter(p=>B.matchesName(p,['aleksi'])).map(p=>p.id)));
});
test('rolling edit distance preserves insertions, deletions, substitutions and adjacent swaps',()=>{
 assert.equal(B.distance('mikael','mikale'),1);assert.equal(B.distance('aleksi','alekis'),1);
 assert.equal(B.distance('','abc'),3);assert.equal(B.distance('abc',''),3);assert.equal(B.distance('abcd','badc'),2);
 assert.equal(B.distance('abcd','abcd'),0);assert.equal(B.distance('abc','xyz'),3);
});
function packed(){return{version:3,checkedAt:'2026-11-23',competitions:[{key:'https://turniereklassisch.ringerdb.de/VT/2026/FI/test/indexFIN.htm',year:2026,details:'Testi, 1.1.2026'}],participants:[['r1','p1',0,'Pojat','30'],['r2','p2',0,'Pojat','30']],matches:[['m1',0,'Pojat','30','1',0,1,0,'PV',[4,2],'FIN30.htm'],['m2',0,'Pojat','30','2',0,1,1,'PV',[1,2],'FIN30.htm']],excluded:[[0,[0,1]]]};}
test('cached source decoding preserves every bout, result reference and source URL',()=>{
 const input=packed(),decoded=B.unpack(input);
 assert.equal(decoded.matches.length,2);assert.equal(decoded.matches[0].red,'r1');assert.equal(decoded.matches[1].winner,'r2');
 assert.equal(decoded.matches[0].source,'https://turniereklassisch.ringerdb.de/VT/2026/FI/test/FIN30.htm');
 assert.equal(decoded.matches[0].source,decoded.matches[1].source);assert.equal(input.matches[0][5],0);
 for(const bad of [0.5,-1,3]){const invalid=packed();invalid.matches[0][1]=bad;assert.throws(()=>B.unpack(invalid),/Kilpailuviittaus/);}
});
test('preparation follows current result IDs after a split while retaining old athlete history',()=>{
 const bouts=B.unpack(packed()),data={competitions:[{source:bouts.competitions[0].key,rows:[{resultId:'r1',athleteId:'new-p1',name:'Urho Susi',club:'Seura',category:'Pojat',weight:'30'},{resultId:'r2',athleteId:'p2',name:'Leo Testi',club:'Seura',category:'Pojat',weight:'30'}]}],athleteRegistry:{athletes:[{id:'p1',name:'Urho Susi'},{id:'new-p1',name:'Urho Susi'},{id:'p2',name:'Leo Testi'}]}};
 const result=B.prepare(data,{},bouts);
 assert.equal(result.matches[0].red.id,'new-p1');assert.equal(result.matches[1].winner.id,'p2');assert.equal(result.matches.length,2);
 const invalid=B.unpack(packed());invalid.matches[1].source='https://example.test/wrong.htm';assert.throws(()=>B.prepare(data,{},invalid),/Lähdeosoite/);
});
