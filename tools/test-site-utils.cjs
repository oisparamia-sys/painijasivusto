'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {matchesCompetitionQuery:matches,competitionTier:tier,yearlyPlacements:years}=require('../site-utils.js');
test('competition search tolerates transpositions, accents and phonetic English spelling',()=>{
 for(const [text,query] of [['Freestyle Cup','friistyle kup'],['Hyvinkään painit','hyvinkaan'],['Tampereen painit','tamperen'],['Helsinki Open','helsnki']])assert.equal(matches(text,query),true,query);
 assert.equal(matches('Vaasan painit','Kotka'),false);
});
test('dates preserve day-month order, year and valid calendar ranges',()=>{
 assert.equal(matches('Vaasa, 3.8.2025','3.8'),true);assert.equal(matches('Vaasa, 3.8.2025','8.3'),false);
 assert.equal(matches('Vaasa, 8.3.2025','3.8'),false);assert.equal(matches('Vaasa, 3.8.2025','3.8.2026'),false);
 assert.equal(matches('Kisat, 6.–7.5.2025','7.5'),true);assert.equal(matches('Kisat, 6.–7.5.2025','8.5'),false);
 assert.equal(matches('Kisat, 31.2.2025','31.2'),false);assert.equal(matches('Kisat, 29.2.2024','29.2'),true);
 assert.equal(matches('Kisat 2025','2026'),false);
});
test('importance uses bounded championship names and preserves intended order',()=>{
 assert.deepEqual(['U17 SM-kilpailut','Suomenmestaruuskilpailut','Suomen mestaruuskilpailut','KLL-painit','KLL SM-kilpailut','Aluemestaruuskilpailut','Avoimet piirinmestaruuskilpailut','Kosmos Cup','PM-painit'].map(tier),[0,0,0,1,1,2,2,3,3]);
});
test('yearly chart counts each valid result once and retains undated results separately',()=>{
 const entries=[['2024',1],['2022',3],['2024',2],['2024',8],['Ei päivämäärää',1],['2024',0]].map(([year,place])=>({item:{year},result:{place}}));
 assert.deepEqual(years(entries,item=>item.year),[{year:'2022',counts:[0,0,1,0],total:1},{year:'2024',counts:[1,1,0,1],total:3},{year:'Ei päivämäärää',counts:[1,0,0,0],total:1}]);
});
