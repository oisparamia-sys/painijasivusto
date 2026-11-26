'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{remaining,WAIT_MS,allowed}=require('./scan-gate.cjs');
const now=Date.parse('2026-11-26T12:00:00Z'),job=(ago,extra={})=>({name:'update',started_at:new Date(now-ago).toISOString(),conclusion:'success',...extra});
test('manual scan delay counts actual starts and expires exactly after 30 minutes',()=>{assert.equal(remaining([job(1000)],now),WAIT_MS-1000);assert.equal(remaining([job(WAIT_MS)],now),0);assert.equal(remaining([job(1000,{conclusion:'skipped'})],now),0);assert.equal(remaining([job(1000,{name:'gate'})],now),0);});
test('scheduled scans and explicit review-only runs bypass manual scan delay',async()=>{for(const context of [{eventName:'schedule'},{eventName:'workflow_dispatch',payload:{inputs:{review_only:'true'}}}])assert.equal(await allowed({context}),true);});
test('skipped manual attempts do not extend cooldown and the current run is ignored',async()=>{
 const runs=[{id:1,status:'completed',created_at:new Date(now-1000).toISOString()},{id:2,status:'completed',created_at:new Date(now-2000).toISOString()},{id:99,status:'in_progress',created_at:new Date(now).toISOString()}];
 const github={rest:{actions:{listWorkflowRuns:'runs',listJobsForWorkflowRun:'jobs'}},paginate:Object.assign(async(_method,{run_id})=>[run_id===1?job(1000,{conclusion:'skipped'}):job(WAIT_MS+1)],{iterator:async function*(){yield {data:runs};}})};
 assert.equal(await allowed({github,context:{eventName:'workflow_dispatch',payload:{inputs:{}},runId:99,repo:{}},core:{notice(){}},now}),true);
});
test('a recent failed actual scan is delayed, rather than retried in a rapid loop',async()=>{
 const github={rest:{actions:{listWorkflowRuns:'runs',listJobsForWorkflowRun:'jobs'}},paginate:Object.assign(async()=>[job(60000,{conclusion:'failure'})],{iterator:async function*(){yield {data:[{id:1,status:'completed',created_at:new Date(now-60000).toISOString()}]};}})};
 assert.equal(await allowed({github,context:{eventName:'workflow_dispatch',payload:{inputs:{}},runId:99,repo:{}},core:{notice(){}},now}),false);
});
