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
    let pending = null, context = "", returnFocus = opener;
    const contextInfo = $("feedback-context");
    function openFeedback(details, trigger) {
      if (send.disabled) return;
      context = details ? "Ilmoitus koskee: " + details.label + "\nLinkki: " + details.url + "\n\n" : "";
      // Context and the visitor's text share the server's 2,000 character limit.
      if (context.length > 1500) context = "Ilmoitus koskee: " + details.label.slice(0,300) + "\n\n";
      if (contextInfo) {
        contextInfo.textContent = context.trim();
        contextInfo.hidden = !context;
      }
      input.maxLength = 2000 - context.length;
      if (details) category.value = "error";
      returnFocus = trigger || opener;
      setStatus(status, "");
      dialog.showModal();
      input.focus();
    }
    window.PAINI_OPEN_FEEDBACK = openFeedback;
    window.dispatchEvent(new Event("paini-feedback-ready"));
    opener.hidden = false;
    opener.addEventListener("click", () => {
      openFeedback(null, opener);
    });
    $("feedback-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => (returnFocus?.isConnected ? returnFocus : opener).focus());
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (send.disabled) return;
      const text = input.value.trim(), message = context + text;
      if (text.length < 3 || message.length > 2000) {
        setStatus(status, "Kirjoita 3–" + (2000-context.length) + " merkin palaute. Kohdetiedot vievät osan tilasta.", "error");
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
        if (context) category.value = "error";
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

  function inboxError(error, fallback) {
    if (error.status === 401) signOut("Kirjautuminen vanheni. Kirjaudu uudelleen.", "error");
    else if (error.status === 403 || error.code === "42501") signOut("Tällä tilillä ei ole oikeutta käsitellä palautteita.", "error");
    else if (error.code === "PGRST202") setStatus(status, "Palautelaatikon tietokantapäivitys puuttuu. Aja palaute-luettu.sql Supabasessa.", "error");
    else setStatus(status, fallback, "error");
  }

  function addReadControl(item, row) {
    const badge = document.createElement("span");
    badge.className = "feedback-read-badge";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "feedback-mark-read";
    let isRead = Boolean(row.read_at);
    function showState() {
      badge.textContent = isRead ? "Luettu" : "Lukematon";
      badge.dataset.read = String(isRead);
      button.textContent = isRead ? "Merkitse lukemattomaksi" : "Merkitse luetuksi";
    }
    showState();
    item.firstElementChild.after(badge);
    item.append(button);
    button.addEventListener("click", async () => {
      if (!session || busy || button.disabled) return;
      const token = session, desired = !isRead;
      const buttons = [reload, newer, older, ...list.querySelectorAll(".feedback-mark-read")];
      const previousDisabled = buttons.map(control => control.disabled);
      busy = true;
      buttons.forEach(control => { control.disabled = true; });
      try {
        const saved = await request("/rest/v1/rpc/paini_set_feedback_read", {p_id:row.id, p_read:desired}, token);
        if (session !== token) return;
        if (saved !== desired) throw new Error("Merkintää ei vahvistettu");
        isRead = saved;
        showState();
        if (item.isConnected) setStatus(status, isRead ? "Palaute merkitty luetuksi." : "Palaute merkitty lukemattomaksi.", "success");
      } catch (error) {
        if (session === token) inboxError(error, "Merkintää ei voitu vahvistaa. Hae uusimmat ja tarkista tila.");
      } finally {
        if (session === token) {
          busy = false;
          buttons.forEach((control,index) => { control.disabled = previousDisabled[index]; });
        }
      }
    });
  }

  function feedbackText(element, message) {
    // Only the site's own public result links become clickable. All other
    // feedback remains text, including any HTML supplied by a visitor.
    const text = String(message);
    const links = /https:\/\/oisparamia-sys\.github\.io\/painijasivusto\/(?:index\.html)?#[^\s]+/g;
    let position = 0;
    for (const match of text.matchAll(links)) {
      element.append(document.createTextNode(text.slice(position,match.index)));
      const link = document.createElement("a");
      link.href = match[0];
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Avaa ilmoituksen kohde ↗";
      element.append(link);
      position = match.index + match[0].length;
    }
    element.append(document.createTextNode(text.slice(position)));
  }

  async function readPage(target) {
    if (!session || busy) return;
    const token = session;
    busy = true;
    reload.disabled = newer.disabled = older.disabled = true;
    setStatus(status, "Haetaan palautteita…");
    try {
      const rows = await request("/rest/v1/rpc/paini_list_feedback", {p_offset:target}, token);
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
        feedbackText(content, row.message);
        item.append(heading,content);
        addReadControl(item,row);
        fragment.append(item);
      }
      list.replaceChildren(fragment);
      pages.hidden = !offset && rows.length <= 25;
      newer.disabled = !offset;
      older.disabled = rows.length <= 25;
      setStatus(status, rows.length ? "Palautteet " + (offset + 1) + "–" + (offset + Math.min(rows.length,25)) + "." : "Ei palautteita tällä sivulla.");
    } catch (error) {
      if (session !== token) return;
      inboxError(error, "Palautteita ei saatu ladattua. Kokeile Hae uusimmat -painiketta.");
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
