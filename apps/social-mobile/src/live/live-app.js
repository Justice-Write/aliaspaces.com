(() => {
  "use strict";

  const factory = window.AliaSpacesLiveClient;
  const toastEl = document.getElementById("toast");
  const actorLabel = document.getElementById("actorLabel");
  const modeLabel = document.getElementById("modeLabel");
  const banner = document.getElementById("banner");
  const panels = {
    discover: document.getElementById("panel-discover"),
    feed: document.getElementById("panel-feed"),
    compose: document.getElementById("panel-compose"),
    safety: document.getElementById("panel-safety"),
    you: document.getElementById("panel-you"),
  };

  const params = new URLSearchParams(location.search);
  const fixtureMode = params.get("demo") === "1" || params.get("fixture") === "1";
  const client = factory.createClient({
    mode: fixtureMode ? "fixture" : "live",
    transport: window.AliaSpacesLiveTransport || undefined,
  });

  let currentPanel = "discover";
  let personas = [];
  let activePersonaId = null;
  let publicPersonas = [];
  let openPersona = null;
  let openPosts = [];
  let feedPosts = [];
  let blocks = [];
  let lastError = "";

  function showToast(message) {
    toastEl.hidden = false;
    toastEl.textContent = message;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toastEl.hidden = true;
    }, 3600);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fail(result, fallback) {
    const message = (result && result.error && result.error.message) || fallback;
    lastError = message;
    showToast(message);
    return message;
  }

  function activePersona() {
    return personas.find((item) => item.id === activePersonaId) || personas[0] || null;
  }

  function renderChrome() {
    const status = client.status();
    actorLabel.textContent = status.signedIn
      ? `Signed in${status.email ? ` · ${status.email}` : ""}`
      : "Not signed in";
    modeLabel.textContent = fixtureMode
      ? "Fixture transport · not production"
      : "First-party social client";
    banner.textContent = fixtureMode
      ? "Fixture transport. These records are not online users and are not written to the live database."
      : status.signedIn
        ? "Verified session. Writes use your owner-scoped social RPCs. Posts still go through review/publish gates. Automation is not available here."
        : "First-party social client over the live AliaSpaces database. This app says signed in only after Auth verifies a session. Google and magic-link return URLs are owner-gated; use email/password here or the Website tab.";
    banner.classList.toggle("is-live", status.signedIn && !fixtureMode);
    banner.classList.toggle("is-fixture", fixtureMode);
  }

  function setPanel(name) {
    currentPanel = name;
    for (const [key, node] of Object.entries(panels)) {
      node.hidden = key !== name;
    }
    document.querySelectorAll("[data-nav]").forEach((button) => {
      button.classList.toggle("is-active", button.getAttribute("data-nav") === name);
    });
    render();
  }

  function personaCard(persona, extra = "") {
    return `<article class="list-item">
      <p><strong>${escapeHtml(persona.name || persona.handle || "Untitled")}</strong> · @${escapeHtml(persona.handle || "unknown")}</p>
      <p class="meta">${escapeHtml(persona.tagline || persona.bio || "No public tagline.")} · ${escapeHtml(persona.publication_state || persona.lifecycle_state || "unknown")}</p>
      <div class="actions">
        <button type="button" class="ghost" data-open-persona="${escapeHtml(persona.handle)}">Open</button>
        ${extra}
      </div>
    </article>`;
  }

  function postCard(post, persona, { own = false } = {}) {
    const name = persona ? `${persona.name || ""} · @${persona.handle}` : post.persona_id;
    return `<article class="list-item">
      <p class="meta">${escapeHtml(name)} · ${escapeHtml(post.kind || "update")}</p>
      ${post.title ? `<p><strong>${escapeHtml(post.title)}</strong></p>` : ""}
      <p>${escapeHtml(post.body || "")}</p>
      <div class="actions">
        <button type="button" class="ghost" data-react="like" data-post="${escapeHtml(post.id)}">like</button>
        ${own
          ? `<button type="button" class="danger" data-delete-post="${escapeHtml(post.id)}">Delete</button>`
          : `<button type="button" class="danger" data-block-persona="${escapeHtml(post.persona_id)}">Block author</button>`}
      </div>
      ${own ? "" : reportForm("post", post.id)}
    </article>`;
  }

  function reportForm(targetKind, targetId) {
    const loaded = typeof globalThis !== "undefined" && globalThis.AliaSpacesLiveContract;
    const reasons = (loaded && loaded.CONTRACT.reportReasons) || ["spam", "harassment", "impersonation", "illegal", "other"];
    return `<details class="report">
      <summary>Report</summary>
      <form data-report-form data-target-kind="${escapeHtml(targetKind)}" data-target-id="${escapeHtml(targetId)}">
        <label>Reason
          <select name="reason" required>
            ${reasons.map((reason) => `<option value="${escapeHtml(reason)}">${escapeHtml(reason)}</option>`).join("")}
          </select>
        </label>
        <label>Details (optional)
          <textarea name="details" maxlength="400"></textarea>
        </label>
        <button class="btn">Send report</button>
      </form>
    </details>`;
  }

  function hiddenPersonaKeys() {
    return new Set(blocks.flatMap((item) => [
      item.blocked_persona,
      item.blockedPersonaId,
      item.other_persona_id,
    ].filter(Boolean)));
  }

  function visiblePublicPersonas() {
    const hidden = hiddenPersonaKeys();
    return publicPersonas.filter((persona) => !hidden.has(persona.id) && !hidden.has(persona.handle));
  }

  function renderDiscover() {
    const cards = visiblePublicPersonas().map((persona) => personaCard(persona)).join("");
    const open = openPersona ? `
      <div class="card">
        <h2>@${escapeHtml(openPersona.handle)}</h2>
        <p>${escapeHtml(openPersona.bio || openPersona.tagline || "No public bio.")}</p>
        <p class="meta">${openPosts.length} visible post${openPosts.length === 1 ? "" : "s"} after client block filters.</p>
      </div>
      <div class="list">${openPosts.map((post) => postCard(post, openPersona)).join("") || `<div class="empty">No visible posts for this persona.</div>`}</div>
    ` : "";
    panels.discover.innerHTML = `
      <form id="lookupForm" class="card">
        <h1>Public discovery</h1>
        <p class="meta">Anonymous reads use the website's publishable key. An empty list is a real empty result, not invented users.</p>
        <label>Handle
          <input name="handle" maxlength="48" placeholder="persona_handle">
        </label>
        <div class="actions">
          <button class="btn" type="submit">Look up</button>
          <button class="ghost" type="button" id="refreshPublic">Reload public list</button>
        </div>
      </form>
      ${open}
      <div class="list">${cards || `<div class="empty">No public published personas were returned. That is not treated as a network of online users.</div>`}</div>
    `;
  }

  function renderFeed() {
    const status = client.status();
    const actor = activePersona();
    if (!status.signedIn) {
      panels.feed.innerHTML = `<div class="empty"><h1>Signed-in feed</h1><p>Sign in under You. The app will not show a live feed until Auth verifies a session.</p></div>`;
      return;
    }
    if (!actor) {
      panels.feed.innerHTML = `<div class="empty"><h1>No owned persona</h1><p>This account has no personas the social RPC returned. Create one on the website if needed.</p></div>`;
      return;
    }
    const visible = client.visiblePosts(feedPosts, blocks.map((item) => ({
      kind: "block",
      other_persona_id: item.blocked_persona || item.blockedPersonaId || item.other_persona_id,
    })), actor.id);
    panels.feed.innerHTML = `
      <div class="card">
        <h1>Acting as @${escapeHtml(actor.handle)}</h1>
        <p class="meta">${visible.length} visible post${visible.length === 1 ? "" : "s"}. Blocked authors are excluded on the client. Server-side block projections remain an owner-gated migration.</p>
      </div>
      <div class="list">${visible.map((post) => {
        const persona = personas.find((item) => item.id === post.persona_id) || openPersona;
        return postCard(post, persona, { own: post.persona_id === actor.id });
      }).join("") || `<div class="empty">No visible posts for this persona session.</div>`}</div>
    `;
  }

  function renderCompose() {
    const status = client.status();
    const actor = activePersona();
    panels.compose.innerHTML = `
      <form id="composeForm" class="card">
        <h1>Submit a post</h1>
        <p class="meta">This calls save_persona_post. It is not auto-published. Existing review/publish gates still apply.</p>
        <label>Title
          <input name="title" maxlength="120" ${status.signedIn && actor ? "" : "disabled"}>
        </label>
        <label>Body
          <textarea name="body" maxlength="2000" required ${status.signedIn && actor ? "" : "disabled"} placeholder="What should this persona submit for review?"></textarea>
        </label>
        <button class="btn" ${status.signedIn && actor ? "" : "disabled"}>Submit for review</button>
      </form>
    `;
  }

  function renderSafety() {
    const status = client.status();
    if (!status.signedIn) {
      panels.safety.innerHTML = `<div class="empty"><h1>Safety</h1><p>Blocks, mutes and reports need a verified session. Reports go to a staff review queue; they never remove content by themselves.</p></div>`;
      return;
    }
    const items = blocks.map((item) => {
      const target = item.blocked_persona || item.blockedPersonaId || item.other_persona_id || "unknown";
      return `<article class="list-item">
        <p>Blocked persona ${escapeHtml(target)}</p>
        <div class="actions"><button type="button" class="ghost" data-unblock-persona="${escapeHtml(target)}">Unblock</button></div>
      </article>`;
    }).join("");
    panels.safety.innerHTML = `
      <div class="card">
        <h1>Account blocks</h1>
        <p>set_persona_visibility_rule(block) is account-wide. Hidden-by-block is applied here as a client filter. Report a post from its card; reports go to the staff review queue, which is not part of this client.</p>
      </div>
      <div class="list">${items || `<p class="meta">No account blocks returned.</p>`}</div>
    `;
  }

  function renderYou() {
    const status = client.status();
    const switcher = personas.map((persona) => `
      <article class="list-item">
        <p><strong>${escapeHtml(persona.name || persona.handle)}</strong> · @${escapeHtml(persona.handle)}</p>
        <p class="meta">identity-projection: ${escapeHtml(persona.lifecycle_state || persona.publication_state || "unknown")}</p>
        <div class="actions">
          <button type="button" class="ghost" data-act-persona="${escapeHtml(persona.id)}">Act as this persona</button>
        </div>
      </article>
    `).join("");
    panels.you.innerHTML = `
      <form id="authForm" class="card">
        <h1>${status.signedIn ? "Session" : "Sign in"}</h1>
        <p class="meta">Audience ${escapeHtml(status.audience)}. Network ${escapeHtml(status.network)}. State ${escapeHtml(status.sessionState)}.</p>
        ${status.signedIn ? `
          <p>Verified account: <strong>${escapeHtml(status.email || status.accountId)}</strong></p>
          <div class="actions"><button type="button" class="ghost" id="signOut">Sign out</button></div>
        ` : `
          <label>Email
            <input name="email" type="email" required ${fixtureMode ? "value=\"fixture.north@example.invalid\"" : ""}>
          </label>
          <label>Password
            <input name="password" type="password" required ${fixtureMode ? "value=\"fixture-only-not-production\"" : ""}>
          </label>
          <div class="actions">
            <button class="btn" type="submit">Sign in</button>
            ${fixtureMode ? "" : `<button class="ghost" type="button" id="signUp">Create account</button>`}
          </div>
          <p class="meta">Google and magic-link redirects are not claimed here. Use the Website tab or Chrome if those are required.</p>
        `}
      </form>
      <div class="card">
        <h2>Owned personas</h2>
        <div class="list">${switcher || `<p class="meta">${status.signedIn ? "No personas returned for this account." : "Sign in to load identity-projection rows."}</p>`}</div>
      </div>
      <div class="card">
        <h2>What this client will not do</h2>
        <p>It will not copy automation, billing, or provider credentials. It will not treat a local-demo JSON import as a network publish. It will not say signed in after a failed Google WebView login.</p>
        ${lastError ? `<p class="meta">Last error: ${escapeHtml(lastError)}</p>` : ""}
      </div>
    `;
  }

  function render() {
    renderChrome();
    if (currentPanel === "discover") renderDiscover();
    if (currentPanel === "feed") renderFeed();
    if (currentPanel === "compose") renderCompose();
    if (currentPanel === "safety") renderSafety();
    if (currentPanel === "you") renderYou();
  }

  async function refreshPublic() {
    const result = await client.listPublicPersonas();
    if (!result.ok) {
      publicPersonas = [];
      fail(result, "Public personas could not be loaded.");
    } else {
      publicPersonas = Array.isArray(result.data) ? result.data : [];
    }
    render();
  }

  async function refreshMine() {
    const status = client.status();
    if (!status.signedIn) {
      personas = [];
      feedPosts = [];
      blocks = [];
      return;
    }
    const mine = await client.myPersonas();
    if (!mine.ok) {
      fail(mine, "Owned personas could not be loaded.");
      personas = [];
      return;
    }
    personas = (mine.projections || []).map((projection, index) => Object.assign({}, mine.data[index], projection));
    if (!activePersonaId || !personas.some((item) => item.id === activePersonaId)) {
      activePersonaId = personas[0] ? personas[0].id : null;
    }
    const actor = activePersona();
    if (actor) {
      const feed = await client.myProfilePosts({
        actorPersonaId: actor.id,
        targetPersonaId: actor.id,
      });
      feedPosts = feed.ok && Array.isArray(feed.data) ? feed.data : [];
      if (!feed.ok) fail(feed, "Persona posts could not be loaded.");
    }
    const blockResult = await client.myBlocks();
    blocks = blockResult.ok && Array.isArray(blockResult.data) ? blockResult.data : [];
    if (!blockResult.ok) fail(blockResult, "Blocks could not be loaded.");
  }

  async function openHandle(handle) {
    const personaResult = await client.getPersonaByHandle(handle);
    if (!personaResult.ok || !personaResult.data) {
      openPersona = null;
      openPosts = [];
      fail(personaResult.ok ? { error: { message: "No published persona matched that handle." } } : personaResult, "Persona lookup failed.");
      render();
      return;
    }
    openPersona = personaResult.data;
    if (hiddenPersonaKeys().has(openPersona.id) || hiddenPersonaKeys().has(openPersona.handle)) {
      openPersona = null;
      openPosts = [];
      fail({ error: { message: "That persona is blocked for this account." } }, "Blocked persona stays hidden.");
      render();
      return;
    }
    const posts = await client.listPublicPosts(openPersona.id);
    const raw = posts.ok && Array.isArray(posts.data) ? posts.data : [];
    openPosts = client.visiblePosts(raw, blocks.map((item) => ({
      kind: "block",
      other_persona_id: item.blocked_persona || item.other_persona_id,
    })));
    if (!posts.ok) fail(posts, "Posts could not be loaded.");
    render();
  }

  document.addEventListener("click", async (event) => {
    const nav = event.target.closest("[data-nav]");
    if (nav) return setPanel(nav.getAttribute("data-nav"));
    if (event.target.id === "refreshPublic") return refreshPublic();
    if (event.target.id === "signOut") {
      await client.signOut();
      personas = [];
      feedPosts = [];
      blocks = [];
      showToast("Signed out. The app no longer claims a session.");
      return render();
    }
    if (event.target.id === "signUp") {
      const form = document.getElementById("authForm");
      const data = new FormData(form);
      const result = await client.signUp({
        email: String(data.get("email") || ""),
        password: String(data.get("password") || ""),
      });
      if (!result.ok) return fail(result, "Sign-up failed.");
      showToast(result.message);
      await refreshMine();
      return render();
    }
    const open = event.target.closest("[data-open-persona]");
    if (open) return openHandle(open.getAttribute("data-open-persona"));
    const act = event.target.closest("[data-act-persona]");
    if (act) {
      activePersonaId = act.getAttribute("data-act-persona");
      await refreshMine();
      showToast("Now acting as that owned persona.");
      return render();
    }
    const react = event.target.closest("[data-react]");
    if (react) {
      const actor = activePersona();
      if (!actor) return showToast("Sign in and choose a persona first.");
      const result = await client.toggleReaction({
        postId: react.getAttribute("data-post"),
        personaId: actor.id,
        kind: react.getAttribute("data-react"),
      });
      if (!result.ok) return fail(result, "Reaction was not saved.");
      showToast("Reaction sent to the live social RPC.");
      return;
    }
    const block = event.target.closest("[data-block-persona]");
    if (block) {
      if (!window.confirm("Block this persona for the whole account?")) return;
      const result = await client.setVisibilityRule({
        otherPersonaId: block.getAttribute("data-block-persona"),
        kind: "block",
        enabled: true,
      });
      if (!result.ok) return fail(result, "Block was not saved.");
      await refreshMine();
      showToast("Block saved on the account. Hidden both in this client filter and by the visibility RPC.");
      return render();
    }
    const unblock = event.target.closest("[data-unblock-persona]");
    if (unblock) {
      const result = await client.setVisibilityRule({
        otherPersonaId: unblock.getAttribute("data-unblock-persona"),
        kind: "block",
        enabled: false,
      });
      if (!result.ok) return fail(result, "Unblock was not saved.");
      await refreshMine();
      showToast("Account block removed.");
      return render();
    }
    const remove = event.target.closest("[data-delete-post]");
    if (remove) {
      const result = await client.deletePost({ postId: remove.getAttribute("data-delete-post") });
      if (!result.ok) return fail(result, "Delete failed.");
      await refreshMine();
      showToast("Post deleted through the owner RPC.");
      return render();
    }
  });

  document.addEventListener("submit", async (event) => {
    const reportFormEl = event.target.closest("[data-report-form]");
    if (reportFormEl) {
      event.preventDefault();
      const actor = activePersona();
      const data = new FormData(reportFormEl);
      const result = await client.reportContent({
        targetKind: reportFormEl.getAttribute("data-target-kind"),
        targetId: reportFormEl.getAttribute("data-target-id"),
        reason: String(data.get("reason") || ""),
        details: String(data.get("details") || ""),
        reporterPersonaId: actor ? actor.id : null,
      });
      if (!result.ok) return fail(result, "Report was not sent.");
      reportFormEl.closest("details").open = false;
      showToast(result.message);
      return;
    }
    if (event.target.id === "authForm") {
      event.preventDefault();
      const data = new FormData(event.target);
      const result = await client.signInWithPassword({
        email: String(data.get("email") || ""),
        password: String(data.get("password") || ""),
      });
      if (!result.ok) return fail(result, "Sign-in failed. This is not treated as signed in.");
      showToast("Verified session. Signed in.");
      await refreshMine();
      return render();
    }
    if (event.target.id === "lookupForm") {
      event.preventDefault();
      const handle = String(new FormData(event.target).get("handle") || "");
      return openHandle(handle);
    }
    if (event.target.id === "composeForm") {
      event.preventDefault();
      const actor = activePersona();
      if (!actor) return showToast("Sign in and choose a persona first.");
      const data = new FormData(event.target);
      const result = await client.savePost({
        personaId: actor.id,
        title: String(data.get("title") || ""),
        body: String(data.get("body") || ""),
      });
      if (!result.ok) return fail(result, "Post was not submitted.");
      showToast(result.message);
      await refreshMine();
      return render();
    }
  });

  window.AliaSpacesLiveApp = {
    client,
    status: () => client.status(),
  };

  (async () => {
    const verified = await client.verifySession();
    if (!verified.ok && verified.error) lastError = verified.error.message;
    await refreshPublic();
    await refreshMine();
    render();
  })();
})();
