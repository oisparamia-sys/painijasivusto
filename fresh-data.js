"use strict";
(() => {
  const base = new URL('.', document.currentScript.src);
  const status = document.querySelector('#status');
  const stamp = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  const version = stamp();
  const refreshLink = document.querySelector('#refresh-data');
  function setRefreshAddress() {
    const address = new URL(window.location.href);
    address.searchParams.set('paivitys',stamp());
    refreshLink.href = address.href;
  }
  if (refreshLink) {
    setRefreshAddress();
    refreshLink.addEventListener('focus',setRefreshAddress);
    refreshLink.addEventListener('click',setRefreshAddress);
  }
  // Refresh the stylesheet too, even if a previous HTML version used an old URL.
  document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
    const address=new URL(link.href);address.searchParams.set('fresh',version);link.href=address.href;
  });
  function load(file) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL(file, base).href;
      script.onload = resolve;
      script.onerror = () => { script.remove(); reject(new Error(file.split('?')[0])); };
      document.head.append(script);
    });
  }
  load('haun-tila.js?fresh='+version).catch(() => {
    const notice=document.querySelector('#data-refresh-status');
    if(notice)notice.textContent='Päivitysten tarkistus ei latautunut. Voit silti käyttää Päivitä tiedot -painiketta.';
  });
  async function start() {
    if (status) { status.hidden = false; status.textContent = 'Ladataan tuloksia…'; }
    try {
      await load('data.js?fresh='+version);
      if (!window.PAINI_SHARED_DATA || !Array.isArray(window.PAINI_SHARED_DATA.competitions)) throw new Error('data.js');
      await load('athlete-registry.js?fresh='+version);
      if (status) { status.hidden = true; status.textContent = ''; }
      await load('script.js?fresh='+version);
      window.dispatchEvent(new Event('paini-data-ready'));
    } catch (error) {
      if (status) {
        status.hidden = false; status.dataset.kind = 'error';
        status.textContent = 'Tulosten lataaminen epäonnistui (' + error.message + '). Tarkista verkkoyhteys ja kokeile Päivitä tiedot -painiketta.';
      }
    }
  }
  window.addEventListener('pageshow', event => {
    if (event.persisted) window.location.reload();
  });
  start();
})();
