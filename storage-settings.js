"use strict";
document.getElementById('clear-local')?.addEventListener('click',async()=>{
 let failed=false;for(const key of ['paini-home-v1','paini-notifications-v1','paini-language','paini-theme'])try{localStorage.removeItem(key);}catch{failed=true;}
 try{await caches.delete('paini-data-v1');}catch{failed=true;}
 document.getElementById('clear-status').textContent=failed?'Kaikkia tallennuksia ei voitu poistaa. Voit poistaa sivuston tiedot selaimen asetuksista.':'Suosikit, valinnat ja aineistovälimuisti poistettu. Avaa sivusto uudelleen, jotta oletusvalinnat tulevat käyttöön.';
});
