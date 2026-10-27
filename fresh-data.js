"use strict";
(() => {
  const base = new URL('.', document.currentScript.src);
  const status = document.querySelector('#status');
  function load(file) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL(file, base).href;
      script.onload = resolve;
      script.onerror = () => { script.remove(); reject(new Error(file.split('?')[0])); };
      document.head.append(script);
    });
  }
  async function start() {
    if (status) { status.hidden = false; status.textContent = 'Ladataan tuloksia…'; }
    try {
      // A fresh URL avoids reusing a previous data snapshot after a normal reload.
      await load('data.js?fresh=' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
      if (!window.PAINI_SHARED_DATA || !Array.isArray(window.PAINI_SHARED_DATA.competitions)) throw new Error('data.js');
      await load('athlete-registry.js?v=20261027-fresh1');
      if (status) { status.hidden = true; status.textContent = ''; }
      await load('script.js?v=20261027-fresh1');
    } catch (error) {
      if (status) {
        status.hidden = false; status.dataset.kind = 'error';
        status.textContent = 'Tulosten lataaminen epäonnistui (' + error.message + '). Tarkista verkkoyhteys ja päivitä sivu uudelleen.';
      }
    }
  }
  window.addEventListener('pageshow', event => {
    if (event.persisted) window.location.reload();
  });
  start();
})();
