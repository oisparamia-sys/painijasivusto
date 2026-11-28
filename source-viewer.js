"use strict";
(async()=>{
 const status=document.getElementById('source-status'),sha=new URL(location.href).searchParams.get('sha256');
 if(!/^[a-f0-9]{64}$/.test(sha||'')){status.textContent='Lähdetiedoston tunniste ei kelpaa.';return;}
 const file='tietovarasto/lahteet/'+sha+'.gz',download=document.getElementById('source-download');download.href=file;download.download=sha+'.gz';download.hidden=false;
 if(!('DecompressionStream' in window)){status.textContent='Voit ladata tallennetun lähteen yllä olevasta linkistä.';return;}
 try{
  const response=await fetch(file);if(!response.ok||!response.body)throw Error();const raw=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw))).map(n=>n.toString(16).padStart(2,'0')).join('');if(actual!==sha)throw Error('hash');
  if(new TextDecoder('ascii').decode(raw.slice(0,5))==='%PDF-'){
   const url=URL.createObjectURL(new Blob([raw],{type:'application/pdf'}));download.href=url;download.download=sha+'.pdf';download.textContent='Lataa tarkistettu PDF-pöytäkirja';status.textContent='Tallennettu PDF-pöytäkirja. Tarkistussumma täsmää alkuperäiseen lähteeseen.';window.addEventListener('pagehide',()=>URL.revokeObjectURL(url),{once:true});return;
  }
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(raw);}catch{text=new TextDecoder('windows-1252').decode(raw);}
  // Show source HTML as text. Never execute archived scripts or load remote resources.
  const content=document.getElementById('source-content');content.textContent=text;content.hidden=false;status.textContent='Tallennettu lähdetiedosto. Sisältö on tarkistettu alkuperäistä tarkistussummaa vasten.';
 }catch{status.textContent='Tallennettua lähdesivua ei voitu avata. Tarkista verkkoyhteys tai kokeile latauslinkkiä.';}
})();
