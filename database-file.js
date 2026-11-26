"use strict";
document.getElementById('database-download')?.addEventListener('click',async event=>{
 const button=event.currentTarget,status=document.getElementById('database-file-status');
 if(!('DecompressionStream' in window)){status.textContent='Tämä selain tukee pakatun tiedoston latausta. Käytä alla olevaa .sqlite.gz-linkkiä.';return;}
 button.disabled=true;status.textContent='Valmistellaan SQLite-tiedostoa. Suuren tiedoston lataaminen voi kestää hetken…';
 try{
  const response=await fetch('tietokanta.sqlite.gz');if(!response.ok||!response.body)throw Error('download');
  const blob=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).blob();
  if(await blob.slice(0,16).text()!=='SQLite format 3\0')throw Error('format');
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='painijasivusto.sqlite';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  status.textContent='Tietokantatiedosto on valmis. Löydät sen selaimen latauksista nimellä painijasivusto.sqlite.';
 }catch{status.textContent='SQLite-tiedostoa ei voitu valmistella. Yritä uudelleen tai käytä pakatun tiedoston latauslinkkiä.';}finally{button.disabled=false;}
});
