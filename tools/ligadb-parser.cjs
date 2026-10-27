"use strict";
    function parseLigaDB(text) {
      const lines = text.replace(/^\uFEFF/, "").replace(/\0/g, "").replace(/\r\n?/g, "\n").split("\n");
      const firstGroup = lines.findIndex(line => /^\s*\d+(?:[.,]\d+)?\s*kg\s*\t/i.test(line));
      if (firstGroup < 0) throw new Error("Sarjoja ei löytynyt. Valitse nimenomaan tab-eroteltu tulosluettelo, ei ottelutiedostoa tai HTML-sivua.");
      const header = lines.slice(0, firstGroup).map(line => line.trim()).filter(Boolean);
      if (!header.length) throw new Error("Tiedostosta puuttuu kilpailun nimi.");
      const dateLine = header.find(line => /\d{1,2}[./]\d{1,2}[./]\d{4}/.test(line) && line !== header[0]) || "";
      const rows = [];
      const seen = new Set();
      let group = null;
      let skipped = 0;
      const unexpected = [];

      lines.slice(firstGroup).forEach((line, index) => {
        if (!line.trim()) return;
        const cells = line.split("\t").map(cell => cell.trim());
        if (/^\s*\d+(?:[.,]\d+)?\s*kg\s*\t/i.test(line)) {
          const weight = cells[0].match(/^(\d+(?:[.,]\d+)?)\s*kg$/i);
          if (!weight || !cells[1]) throw new Error("Yhden sarjan painoluokka tai ikäluokka puuttuu.");
          group = { weight: weight[1].replace(",", "."), category: cells[1] };
          return;
        }
        while (cells.length && cells[0] === "") cells.shift();
        if (!cells.length) return;
        if (/^tyhj[äa]$/i.test(cells[0])) { skipped++; return; }
        const place = cells[0].match(/^(\d+)\.$/);
        if (!group || !place || cells.length < 3 || !cells[1] || !cells[2] || Number(place[1]) < 1) {
          unexpected.push(firstGroup + index + 1);
          return;
        }
        const row = { place: Number(place[1]), name: cells[1], club: cells[2], ...group };
        const key = JSON.stringify(row);
        if (seen.has(key)) { skipped++; return; }
        seen.add(key);
        rows.push(row);
      });

      if (unexpected.length) throw new Error("Tiedoston rivin " + unexpected[0] + " rakennetta ei tunnistettu. Tuonti keskeytettiin, jotta tuloksia ei jäisi huomaamatta pois.");
      if (!rows.length) throw new Error("Tiedostosta ei löytynyt sijoituksia. Kilpailussa saattaa olla vasta osallistujalistat.");
      return { title: header[0], details: dateLine, rows, skipped };
    }

    function decodeFile(buffer) {
      try { return { text: new TextDecoder("utf-8", { fatal: true }).decode(buffer), encoding: "UTF-8" }; }
      catch { return { text: new TextDecoder("windows-1252").decode(buffer), encoding: "Windows-1252" }; }
    }



module.exports={parseLigaDB};
