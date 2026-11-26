'use strict';
const {load,validateBouts}=require('./review-data.cjs'),{project}=require('./export-results.cjs');
const {R,data,bouts}=load(process.argv[2]||'.');R.validate(data);R.validate(project(data));validateBouts(data,bouts,R);
const years=new Map();for(const c of data.competitions){const year=c.details.match(/20\d{2}/)?.[0]||'unknown';const row=years.get(year)||{competitions:0,placements:0};row.competitions++;row.placements+=c.rows.length;years.set(year,row);}
console.log(JSON.stringify({competitions:data.competitions.length,placements:R.rows(data).length,bouts:bouts.matches.length,years:Object.fromEntries([...years].sort())},null,2));
