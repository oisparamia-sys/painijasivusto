'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),L=require('../database-links.js');
const base='https://example.test/painijasivusto/tietokanta.html';
test('database source URLs become safe links and executable or credential URLs do not',()=>{
 const url='https://turniereklassisch.ringerdb.de/VT/2020/FI/Test/indexFIN.htm';assert.equal(L.linkFor('source',url,{},base).href,url);
 for(const url of ['javascript:alert(1)','data:text/html,hello','https://secret@turniereklassisch.ringerdb.de/test','https://unrelated.test'])assert.equal(L.linkFor('source',url,{},base),null);
});
test('athlete references and names open the stable profile under the same site path',()=>{
 for(const [column,value,record]of [['athlete_id','painija-000123',{}],['name','Testi',{id:'painija-000123'}]]){const link=L.linkFor(column,value,record,base);assert.equal(new URL(link.href).pathname,'/painijasivusto/index.html');assert.equal(new URLSearchParams(new URL(link.href).hash.slice(1)).get('painija'),'painija-000123');assert.equal(link.external,true);}
});
test('result references filter the current database window instead of losing its context',()=>{
 const link=L.linkFor('winner','tulos-000123',{},base);assert.equal(link.external,false);assert.equal(new URLSearchParams(link.href.slice(1)).get('table'),'placements');assert.equal(new URLSearchParams(link.href.slice(1)).get('query'),'tulos-000123');
});
test('source digests open only a bounded archived source path',()=>{
 const link=L.linkFor('sha256','a'.repeat(64),{},base);assert.equal(new URL(link.href).pathname,'/painijasivusto/lahde.html');assert.equal(new URL(link.href).searchParams.get('sha256'),'a'.repeat(64));assert.equal(L.linkFor('sha256','../secret',{},base),null);
});
