'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('mobile-ui.js','utf8');
function page(phone=true){
 const media={matches:phone,addEventListener:(_name,fn)=>media.change=fn},events={},docEvents={},fields={};
 for(const id of ['site-settings','result-filters','profile-share-details','result-help'])fields[id]={open:true};
 for(const id of ['competition','result-style','result-year','club','category','search'])fields[id]={value:''};fields['result-sort']={value:'newest'};fields['reset-filters']={};fields['filter-choice-count']={};
 const labels=Array.from({length:4},()=>({textContent:''})),window={PAINI_I18N:{language:'fi'},matchMedia:()=>media,addEventListener:(name,fn)=>events[name]=fn};
 const document={getElementById:id=>fields[id],querySelectorAll:()=>labels,addEventListener:(name,fn)=>docEvents[name]=fn};
 vm.runInNewContext(source,{window,document});return {window,fields,labels,events,media,docEvents};
}
test('phone disclosures start closed and desktop reveals the same controls after a breakpoint change',()=>{const p=page();assert.equal(p.fields['result-filters'].open,false);assert.equal(p.fields['site-settings'].open,false);p.media.matches=false;p.media.change();assert.equal(p.fields['result-filters'].open,true);assert.equal(p.fields['site-settings'].open,true);});
test('filter badge and clear action follow actual selections, including programmatic changes and reset',()=>{const p=page();assert.equal(p.fields['reset-filters'].hidden,true);p.fields['result-year'].value='2025';p.fields['club'].value='Seura A';p.window.PAINI_MOBILE.update();assert.equal(p.fields['filter-choice-count'].textContent,'2');assert.equal(p.fields['filter-choice-count'].hidden,false);p.fields['result-year'].value='';p.fields['club'].value='';p.docEvents.change();assert.equal(p.fields['filter-choice-count'].hidden,true);p.fields.search.value='Urho';p.docEvents.input();assert.equal(p.fields['reset-filters'].hidden,false);});
test('short phone navigation labels translate without changing desktop labels',()=>{const p=page(false);p.window.PAINI_I18N.language='en';p.events['paini-language-change']();assert.deepEqual(p.labels.map(e=>e.textContent),['Home','Results','Bouts','Clubs']);p.window.PAINI_I18N.language='sv';p.events['paini-language-change']();assert.equal(p.labels[2].textContent,'Matcher');});
