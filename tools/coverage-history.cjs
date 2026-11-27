'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const fields=['matches','points','methods','excluded','competitions','results'];
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function observation(coverage,at,commit){
 const counts=Object.fromEntries(fields.map(key=>[key,coverage?.total?.[key]]));
 if(!Number.isFinite(Date.parse(at))||fields.some(key=>!Number.isSafeInteger(counts[key])||counts[key]<0)||counts.points>counts.matches||counts.methods>counts.matches)throw Error('Kattavuushistorian mittaus ei kelpaa');
 const fingerprint=digest([coverage.checkedAt||null,coverage.resultsVersion||null,counts]);
 return {at:new Date(at).toISOString(),fingerprint,counts,...(commit?{commit}:{})};
}
function validate(history){
 if(history?.version!==1||!Array.isArray(history.samples))throw Error('Kattavuushistorian muoto ei kelpaa');
 let previous=-Infinity;
 for(const sample of history.samples){
  const time=Date.parse(sample.at),c=sample.counts;
  if(!Number.isFinite(time)||time<previous||!/^[a-f0-9]{64}$/.test(sample.fingerprint||'')||!c||fields.some(k=>!Number.isSafeInteger(c[k])||c[k]<0)||c.points>c.matches||c.methods>c.matches)throw Error('Kattavuushistorian mittaus ei kelpaa');
  previous=time;
 }
 return history;
}
function append(history,coverage,at=new Date().toISOString(),commit){
 validate(history);const sample=observation(coverage,at,commit);
 if(history.samples.at(-1)?.fingerprint===sample.fingerprint)return history;
 if(history.samples.length&&Date.parse(sample.at)<Date.parse(history.samples.at(-1).at))throw Error('Uusi kattavuusmittaus on aiempaa vanhempi');
 return {...history,samples:[...history.samples,sample]};
}
function read(directory){const p=path.join(directory,'kattavuushistoria.json');return fs.existsSync(p)?validate(JSON.parse(fs.readFileSync(p,'utf8'))):{version:1,samples:[]};}
function fromGit(directory){
 const {execFileSync}=require('node:child_process');let history={version:1,samples:[]};
 const log=execFileSync('git',['log','--reverse','--format=%H %cI','--','kattavuus.json'],{cwd:directory,encoding:'utf8'}).trim();
 for(const line of log?log.split('\n'):[]){const [commit,at]=line.split(' '),coverage=JSON.parse(execFileSync('git',['show',commit+':kattavuus.json'],{cwd:directory,encoding:'utf8',maxBuffer:20*1024*1024}));history=append(history,coverage,at,commit);}
 return history;
}
module.exports={fields,observation,validate,append,read,fromGit};
if(require.main===module){
 if(process.argv[2]!=='--from-git'||!process.argv[3])throw Error('Anna --from-git ja projektin Git-kansio');
 const history=fromGit(process.argv[3]),target=process.argv[4]||'kattavuushistoria.json';
 fs.writeFileSync(target,JSON.stringify(history)+'\n');console.log('Todellisia kattavuusmittauksia:',history.samples.length);
}
