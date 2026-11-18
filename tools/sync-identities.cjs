'use strict';
// Runs for ordinary searches and review-only runs, before collecting any bouts.
const fs=require('node:fs'),path=require('node:path');
const D=require('./review-data.cjs'),Q=require('./review-core.cjs');
function sync(root='.'){
  const state=D.load(root),plan=state.R.namePlan(state.data);
  const data=plan.groups.length?state.R.autoMergeNames(state.data):state.data;
  const bouts=D.rebindBouts(data,state.bouts);
  state.R.validate(data);D.validateBouts(data,bouts,state.R);
  if(Q.hash(data)!==Q.hash(state.data)){
    data.updatedAt=new Date().toISOString();
    Q.atomic(path.join(root,'data.js'),state.R.exportSource(data));
  }
  if(Q.hash(bouts)!==Q.hash(state.bouts))Q.atomic(path.join(root,'ottelut-data.js'),'"use strict";\nwindow.PAINI_BOUTS_DATA = '+JSON.stringify(bouts).replace(/</g,'\\u003c')+';\n');
  const text=`Yhdistetty ${plan.mergedProfiles} profiilia (${plan.groups.length} nimeä). Erottamispäätöksen vuoksi tarkistettavia nimiryhmiä: ${plan.skipped.length}.`;
  console.log(text);
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'\n## Painijaprofiilit\n\n'+text+'\n');
  return {data,bouts,plan};
}
if(require.main===module)sync(process.argv[2]||'.');
module.exports={sync};
