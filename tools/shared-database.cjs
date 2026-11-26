'use strict';
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
function read(root='.'){
 if(!fs.existsSync(path.join(root,'tietokanta.sqlite.gz')))return null;
 const result=JSON.parse(execFileSync(process.env.PAINI_PYTHON||'python3',[path.join(__dirname,'shared-database.py'),'read','--root',root],{maxBuffer:250*1024*1024,encoding:'utf8'}));
 for(const [file,key]of [['data.js','data_sha256'],['ottelut-data.js','bouts_sha256'],['tietovarasto/lahdehistoria.jsonl','archive_sha256']])if(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')!==result.metadata[key])throw Error('Tietokanta on päivitettävä ennen julkaisua: '+file);
 return result;
}
module.exports={read};
