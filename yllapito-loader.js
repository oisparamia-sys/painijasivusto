"use strict";
(() => {
  const base = new URL('.', document.currentScript.src);
  const version = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  const status = document.querySelector('#status');
  const reportStatus = document.querySelector('#scan-report-status');
  const reportButton = document.querySelector('#scan-report-reload');
  document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
    const address = new URL(link.href);
    address.searchParams.set('fresh', version);
    link.href = address.href;
  });
  let requestNumber = 0;
  function load(file) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const address = new URL(file, base);
      address.searchParams.set('fresh', version + '-' + (++requestNumber));
      script.src = address.href;
      script.onload = resolve;
      script.onerror = () => { script.remove(); reject(new Error(file)); };
      document.head.append(script);
    });
  }
  // The report and feedback must work even while the result file is loading.
  async function startReport() {
    if (reportButton) { reportButton.disabled = true; reportButton.textContent = 'Ladataan raportin toimintoa…'; }
    if (reportStatus) reportStatus.textContent = 'Ladataan hakuraportin toimintoa…';
    try {
      await load('haun-tila.js');
    } catch {
      if (reportStatus) reportStatus.textContent = 'Hakuraportin toiminto ei latautunut. Tarkista verkkoyhteys ja yritä uudelleen painikkeesta.';
      if (reportButton) {
        reportButton.disabled = false;
        reportButton.textContent = 'Yritä raportin lataamista uudelleen';
        reportButton.addEventListener('click', startReport, {once:true});
      }
    }
  }
  async function startData() {
    if (status) { status.dataset.kind = ''; status.textContent = 'Ladataan ajantasaista kilpailuaineistoa…'; }
    try {
      await load('data.js');
      if (!Array.isArray(window.PAINI_SHARED_DATA?.competitions)) throw new Error('data.js');
      await load('athlete-registry.js');
      if (!window.PainiRegistry) throw new Error('athlete-registry.js');
      await load('yllapito.js');
      window.dispatchEvent(new Event('paini-data-ready'));
    } catch (error) {
      if (status) {
        status.dataset.kind = 'error';
        status.textContent = 'Ylläpidon aineisto ei latautunut (' + error.message + '). Tarkista verkkoyhteys ja avaa sivu uudelleen. Hakuraportti ja palautelaatikko latautuvat erikseen.';
      }
    }
  }
  startReport();
  load('palaute.js').catch(() => {
    const feedbackStatus = document.querySelector('#feedback-admin-status');
    if (feedbackStatus) feedbackStatus.textContent = 'Palautelaatikon toiminto ei latautunut. Tarkista verkkoyhteys ja avaa sivu uudelleen.';
  });
  // Do not reload open admin tabs: they can contain unsaved imports or edits.
  startData();
})();
