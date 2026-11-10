"use strict";
(() => {
  // Täytä Supabasen Project URL ja Publishable key. Älä käytä salaista avainta.
  const projectUrl = "https://wufqfkrcbduahtibktdi.supabase.co";
  const publishableKey = "sb_publishable_Ujrr8qyAJxSszBVeAeVIUA_FSOoScXO";

  const base = projectUrl.trim().replace(/\/$/, "");
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(base) ||
      !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey.trim())) return;

  const $ = id => document.getElementById(id);
  const labels = {idea:"Kehitysidea", error:"Virhe sivustolla", other:"Muu palaute"};
  const setStatus = (element, text, kind = "") => {
    element.textContent = text;
    element.dataset.kind = kind;
  };

  async function request(path, body, token) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const headers = {apikey:publishableKey.trim(), "Content-Type":"application/json"};
      if (token) headers.Authorization = "Bearer " + token;
      const response = await fetch(base + path, {
        method:"POST", headers, body:JSON.stringify(body), cache:"no-store",
        credentials:"omit", redirect:"error", signal:controller.signal
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error("Palautepyyntö epäonnistui");
        error.status = response.status;
        error.code = payload?.code;
        error.rateLimited = payload?.message === "PAINI_RATE_LIMIT";
        throw error;
      }
      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  const opener = $("feedback-open");
  if (opener) {
    const form = $("feedback-form"), dialog = $("feedback-dialog");
    const category = $("feedback-category"), input = $("feedback-message");
    const send = $("feedback-send"), status = $("feedback-status");
    let pending = null;
    opener.hidden = false;
    opener.addEventListener("click", () => {
      dialog.showModal();
      input.focus();
    });
    $("feedback-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => opener.focus());
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (send.disabled) return;
      const message = input.value.trim();
      if (message.length < 3 || message.length > 2000) {
        setStatus(status, "Kirjoita 3–2 000 merkin palaute.", "error");
        input.focus();
        return;
      }
      send.disabled = category.disabled = input.readOnly = true;
      setStatus(status, "Lähetetään palautetta…");
      try {
        if (!pending || pending.p_message !== message || pending.p_category !== category.value) {
          pending = {p_id:crypto.randomUUID(), p_category:category.value, p_message:message};
        }
        await request("/rest/v1/rpc/paini_send_feedback", pending);
        form.reset();
        pending = null;
        setStatus(status, "Kiitos! Palautteesi on lähetetty.", "success");
      } catch (error) {
        const message = error.status === 429 || error.rateLimited
          ? "Palautteita on lähetetty paljon. Kokeile hetken kuluttua uudelleen."
          : "Palautteen lähettämistä ei voitu vahvistaa. Teksti säilyi lomakkeessa, ja voit yrittää uudelleen.";
        setStatus(status, message, "error");
      } finally {
        send.disabled = category.disabled = input.readOnly = false;
      }
    });
  }

  const login = $("feedback-login");
  if (!login) return;
  const inbox = $("feedback-inbox"), list = $("feedback-list"), pages = $("feedback-pages");
  const status = $("feedback-admin-status"), reload = $("feedback-reload");
  const newer = $("feedback-newer"), older = $("feedback-older");
  const email = $("feedback-email"), password = $("feedback-password"), loginButton = $("feedback-login-submit");
  let session = null, offset = 0, busy = false, expiry, loginGeneration = 0;
  login.hidden = false;
  setStatus(status, "Kirjaudu lukemaan sivustolle lähetettyjä palautteita.");

  function signOut(message, kind = "") {
    loginGeneration++;
    session = null;
    offset = 0;
    busy = false;
    clearTimeout(expiry);
    list.replaceChildren();
    inbox.hidden = pages.hidden = true;
    login.hidden = false;
    setStatus(status, message, kind);
  }

  async function readPage(target) {
    if (!session || busy) return;
    const token = session;
    busy = true;
    reload.disabled = newer.disabled = older.disabled = true;
    setStatus(status, "Haetaan palautteita…");
    try {
      const rows = await request("/rest/v1/rpc/paini_read_feedback", {p_offset:target}, token);
      if (session !== token) return;
      if (!Array.isArray(rows)) throw new Error("Palautelista ei kelpaa");
      offset = target;
      const fragment = document.createDocumentFragment();
      for (const row of rows.slice(0,25)) {
        const item = document.createElement("li"), heading = document.createElement("strong");
        const content = document.createElement("p");
        const time = new Date(row.created_at).toLocaleString("fi-FI", {
          dateStyle:"short", timeStyle:"short", timeZone:"Europe/Helsinki"
        });
        heading.textContent = (Object.hasOwn(labels,row.category) ? labels[row.category] : "Palaute") + " · " + time;
        content.textContent = row.message;
        item.append(heading,content);
        fragment.append(item);
      }
      list.replaceChildren(fragment);
      pages.hidden = !offset && rows.length <= 25;
      newer.disabled = !offset;
      older.disabled = rows.length <= 25;
      setStatus(status, rows.length ? "Palautteet " + (offset + 1) + "–" + (offset + Math.min(rows.length,25)) + "." : "Ei palautteita tällä sivulla.");
    } catch (error) {
      if (session !== token) return;
      if (error.status === 401) signOut("Kirjautuminen vanheni. Kirjaudu uudelleen.", "error");
      else if (error.status === 403 || error.code === "42501") signOut("Tällä tilillä ei ole oikeutta lukea palautteita.", "error");
      else setStatus(status, "Palautteita ei saatu ladattua. Kokeile Hae uusimmat -painiketta.", "error");
    } finally {
      if (session === token) {
        busy = false;
        reload.disabled = false;
      }
    }
  }

  login.addEventListener("submit", async event => {
    event.preventDefault();
    if (loginButton.disabled) return;
    const generation = ++loginGeneration;
    loginButton.disabled = true;
    setStatus(status, "Kirjaudutaan…");
    try {
      const credentials = {email:email.value.trim(), password:password.value};
      password.value = "";
      const auth = await request("/auth/v1/token?grant_type=password", credentials);
      if (generation !== loginGeneration) return;
      if (!auth?.access_token) throw new Error("Kirjautuminen epäonnistui");
      session = auth.access_token;
      const lifetime = Number(auth.expires_in);
      expiry = setTimeout(() => signOut("Kirjautuminen vanheni. Kirjaudu uudelleen.", "error"),
        (Number.isFinite(lifetime) && lifetime > 0 ? Math.min(lifetime, 3600) : 3600) * 1000);
      login.hidden = true;
      inbox.hidden = false;
      await readPage(0);
    } catch {
      if (generation === loginGeneration) setStatus(status, "Kirjautuminen ei onnistunut. Tarkista sähköposti ja salasana ja yritä uudelleen.", "error");
    } finally {
      loginButton.disabled = false;
    }
  });
  reload.addEventListener("click", () => readPage(0));
  newer.addEventListener("click", () => readPage(Math.max(0,offset - 25)));
  older.addEventListener("click", () => readPage(offset + 25));
  $("feedback-logout").addEventListener("click", () => signOut("Olet kirjautunut ulos."));
  // A restored history entry must not reveal an earlier admin session.
  window.addEventListener("pagehide", () => { if (session || loginButton.disabled) signOut("Kirjaudu lukemaan palautteita."); });
})();
