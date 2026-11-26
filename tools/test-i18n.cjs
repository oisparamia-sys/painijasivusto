'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const rows=require('../translations.js'),{translate:t}=require('../i18n.js');
test('every static public label, instruction and accessible label has both translations',()=>{
 const html=fs.readFileSync('index.html','utf8').replace(/<(style|script)[\s\S]*?<\/\1>/g,'').replace(/<span[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/span>/g,'');
 const texts=[...html.matchAll(/>([^<>]+)</g)].map(m=>m[1].trim()).filter(Boolean);
 const attributes=[...html.matchAll(/(?:aria-label|placeholder)="([^"]+)"/g)].map(m=>m[1]);
 const excluded=new Set(['Kieli / Language / Språk','Suomi','English','Svenska']);
 for(const value of [...texts,...attributes])if(!excluded.has(value)){
  assert.notEqual(t(value,'en'),value,'Missing English: '+value);assert.notEqual(t(value,'sv'),value,'Missing Swedish: '+value);
 }
 assert.equal(new Set(rows.map(r=>r[0])).size,rows.length);
});
test('dynamic result and bout counts translate without changing names or numbers',()=>{
 assert.equal(t('302 yhteistä kilpailua, 35 471 kilpailusijoitusta.','en'),'302 shared competitions, 35 471 competition placements.');
 assert.equal(t('Sivu 2 / 142','sv'),'Sida 2 / 142');
 assert.equal(t('Nimet lähdetuloksissa: Urho Susi','en'),'Names in source results: Urho Susi');
 assert.equal(t('Näytä tulokset: SM-kilpailut, Järvenpää','en'),'Show results: SM-kilpailut, Järvenpää');
 assert.equal(t('Urho Susi','sv'),'Urho Susi');assert.equal(t('Sivu 2 / 142','fi'),'Sivu 2 / 142');assert.equal(t('Sivu 2 / 142','de'),'Sivu 2 / 142');
});
