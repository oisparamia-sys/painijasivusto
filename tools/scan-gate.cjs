'use strict';
// A rejected attempt must not extend the delay: count actual update jobs only.
const WAIT_MS=30*60*1000;
function remaining(jobs,now=Date.now()){
 const starts=jobs.filter(job=>job.name==='update'&&job.conclusion!=='skipped'&&job.started_at).map(job=>Date.parse(job.started_at)).filter(time=>Number.isFinite(time)&&time<=now);
 return Math.max(0,...starts.map(time=>WAIT_MS-(now-time)));
}
async function allowed({github,context,core,now=Date.now()}){
 if(context.eventName!=='workflow_dispatch'||(context.payload.inputs?.review_only==='true'||context.payload.inputs?.review_only===true))return true;
 const jobs=[];
 for await(const page of github.paginate.iterator(github.rest.actions.listWorkflowRuns,{...context.repo,workflow_id:'kilpailuhaku.yml',event:'workflow_dispatch',per_page:100})){
  let older=false;
  for(const run of page.data){
   if(Date.parse(run.created_at)<now-24*60*60*1000){older=true;continue;}
   if(String(run.id)===String(context.runId))continue;
   if(run.status!=='completed')continue;
   jobs.push(...await github.paginate(github.rest.actions.listJobsForWorkflowRun,{...context.repo,run_id:run.id,per_page:100}));
  }
  if(older)break;
 }
 const wait=remaining(jobs,now);
 if(wait)core.notice('Odota vielä '+Math.ceil(wait/60000)+' minuuttia ennen uutta käsin käynnistettävää kilpailuhakua. Uusi lähdehaku ohitetaan. Päätösten käsittely on käytettävissä erikseen.');
 return !wait;
}
module.exports={remaining,allowed,WAIT_MS};
