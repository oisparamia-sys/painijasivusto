"use strict";
(() => {
  const base = new URL('.', document.currentScript.src);
  const status = document.querySelector('#status');
  const notice = document.querySelector('#data-refresh-status');
  const retryParameter = 'autopaivitys';
  const stamp = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  const version = stamp();
  const refreshLink = document.querySelector('#refresh-data');
  function setRefreshAddress() {
    const address = new URL(window.location.href);
    address.searchParams.delete(retryParameter);
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
  const reportReady = load('haun-tila.js?fresh='+version).then(() => window.PAINI_STARTUP_REPORT).catch(() => {
    if(notice)notice.textContent='Päivitysten tarkistus ei latautunut. Voit silti käyttää Päivitä tiedot -painiketta.';
    return null;
  });
  async function checkStartupData(data) {
    const address = new URL(window.location.href);
    if (address.searchParams.has(retryParameter)) {
      // The redirected page must render even if Pages still serves the old data.
      address.searchParams.delete(retryParameter);
      window.history.replaceState(window.history.state, '', address.href);
      return false;
    }
    let timeout;
    const report = await Promise.race([
      reportReady,
      new Promise(resolve => { timeout = window.setTimeout(() => resolve(null), 2500); })
    ]).finally(() => window.clearTimeout(timeout));
    const loadedAt = Math.max(...[data.updatedAt, data.exportedAt].map(Date.parse).filter(Number.isFinite));
    const publishedAt = Date.parse(report?.updatedAt);
    // A scan without new results changes checkedAt, not the data version.
    if (!Number.isFinite(loadedAt) || !Number.isFinite(publishedAt) || publishedAt <= loadedAt) return false;
    if (document.querySelector('#feedback-dialog[open]')) return false;
    if (notice) notice.textContent = 'Uusi aineisto löytyi. Päivitetään tuloksia…';
    address.searchParams.set(retryParameter, stamp());
    window.location.replace(address.href);
    return true;
  }
  async function start() {
    if (status) { status.hidden = false; status.textContent = 'Ladataan tuloksia…'; }
    try {
      await load('data.js?fresh='+version);
      if (!window.PAINI_SHARED_DATA || !Array.isArray(window.PAINI_SHARED_DATA.competitions)) throw new Error('data.js');
      await load('athlete-registry.js?fresh='+version);
      if (refreshLink && await checkStartupData(window.PAINI_SHARED_DATA)) return;
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
