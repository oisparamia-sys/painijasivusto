"use strict";
(() => {
  const base = new URL('.', document.currentScript.src);
  const status = document.querySelector('#registry-status');
  const version = '20261030-admin1';
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
    status.textContent = 'Ladataan ajantasaista painijarekisteriä…';
    try {
      await load('data.js?fresh=' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
      if (!window.PAINI_SHARED_DATA || !Array.isArray(window.PAINI_SHARED_DATA.competitions)) throw new Error('data.js');
      status.textContent = 'Aineisto ladattu. Valmistellaan ylläpitoa…';
      await load('athlete-registry.js?v=' + version);
      if (!window.PainiRegistry) throw new Error('athlete-registry.js');
      await load('painijat.js?v=' + version);
    } catch (error) {
      status.dataset.kind = 'error';
      status.textContent = 'Ylläpidon lataaminen epäonnistui (' + error.message + '). Tarkista verkkoyhteys ja avaa sivu uudelleen.';
    }
  }
  start();
})();
