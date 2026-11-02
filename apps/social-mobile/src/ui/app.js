(() => {
  "use strict";

  const api = window.AliaSpacesLocal;
  const toastEl = document.getElementById("toast");
  const actorLabel = document.getElementById("actorLabel");
  const panels = {
    feed: document.getElementById("panel-feed"),
    compose: document.getElementById("panel-compose"),
    profiles: document.getElementById("panel-profiles"),
    safety: document.getElementById("panel-safety"),
    you: document.getElementById("panel-you"),
  };

  let state = api.emptyState();
  let currentPanel = "feed";
  let fileInput = null;

  function persist() {
    try {
      localStorage.setItem(api.STORAGE_KEY, api.serialize(state));
    } catch (error) {
      showToast("This device could not save the local store.");
    }
  }

  function restore() {
    const raw = localStorage.getItem(api.STORAGE_KEY);
    if (!raw) return;
    try {
      state = api.parse(raw);
    } catch (error) {
      showToast("Saved local data was ignored because it was not a valid local-demo export.");
    }
  }

  function showToast(message) {
    toastEl.hidden = false;
    toastEl.textContent = message;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toastEl.hidden = true;
    }, 3200);
  }

  function activeProfile() {
    return state.profiles.find((profile) => profile.id === state.activeProfileId) || null;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function sourceChip(source) {
    return source === "fixture"
      ? '<span class="chip fixture">Demo fixture</span>'
      : '<span class="chip">Your local record</span>';
  }

  function handleError(error) {
    showToast(error && error.message ? error.message : "That local action could not be completed.");
  }

  function mutate(writer, success) {
    try {
      const result = writer(state);
      state = result.state;
      persist();
      render();
      if (success) showToast(success);
      return result;
    } catch (error) {
      handleError(error);
      return null;
    }
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

  function profileName(id) {
    const profile = state.profiles.find((item) => item.id === id);
    return profile ? `${profile.displayName} (@${profile.handle})` : "Unknown local profile";
  }

  function renderActor() {
    const profile = activeProfile();
    actorLabel.textContent = profile
      ? `Acting as @${profile.handle}`
      : "No local profile yet";
  }

  function reactionSummary(postId, viewerId) {
    const visible = api.visibleReactions(state, viewerId, postId);
    const counts = Object.fromEntries(api.REACTION_KINDS.map((kind) => [kind, 0]));
    let mine = null;
    for (const reaction of visible) {
      counts[reaction.kind] += 1;
      if (reaction.actorProfileId === viewerId) mine = reaction.kind;
    }
    return { counts, mine, visible };
  }

  function renderFeed() {
    const viewer = activeProfile();
    if (!viewer) {
      panels.feed.innerHTML = `<div class="empty"><h1>Local feed</h1><p>Create a local profile under You to write and read posts stored on this device.</p></div>`;
      return;
    }
    const posts = api.visibleFeed(state, viewer.id);
    const hidden = api.hiddenProfileIds(state, viewer.id).size;
    const cards = posts.map((post) => {
      const author = state.profiles.find((item) => item.id === post.authorProfileId);
      const summary = reactionSummary(post.id, viewer.id);
      const buttons = api.REACTION_KINDS.map((kind) => (
        `<button type="button" class="${summary.mine === kind ? "btn" : "ghost"}" data-react="${kind}" data-post="${post.id}">${kind} ${summary.counts[kind]}</button>`
      )).join("");
      const own = post.authorProfileId === viewer.id;
      return `<article class="list-item">
        <p class="meta">${escapeHtml(author ? author.displayName : "Unknown")} · @${escapeHtml(author ? author.handle : "unknown")} ${sourceChip(post.source)}</p>
        <p>${escapeHtml(post.body)}</p>
        <div class="actions">${buttons}
          ${own ? `<button type="button" class="danger" data-delete-post="${post.id}">Delete</button>` : `<button type="button" class="ghost" data-report-post="${post.id}">Report</button><button type="button" class="danger" data-block="${post.authorProfileId}">Block author</button>`}
        </div>
      </article>`;
    }).join("");
    panels.feed.innerHTML = `
      <div class="card">
        <h1>Device feed</h1>
        <p class="meta">${posts.length} visible local post${posts.length === 1 ? "" : "s"}. ${hidden} blocked profile${hidden === 1 ? "" : "s"} excluded.</p>
      </div>
      <div class="list">${cards || `<div class="empty">No visible local posts. Compose one or load demo fixtures from You.</div>`}</div>
    `;
  }

  function renderCompose() {
    const viewer = activeProfile();
    panels.compose.innerHTML = `
      <form id="composeForm" class="card">
        <h1>Write a local post</h1>
        <p class="meta">This stays on the device. It is not published and no network request is made.</p>
        <label>Body
          <textarea name="body" maxlength="500" required ${viewer ? "" : "disabled"} placeholder="What should this local profile remember?"></textarea>
        </label>
        <button class="btn" ${viewer ? "" : "disabled"}>Save locally</button>
      </form>
    `;
  }

  function renderProfiles() {
    const viewer = activeProfile();
    const profiles = viewer ? api.visibleProfiles(state, viewer.id) : state.profiles;
    const items = profiles.map((profile) => {
      const blocked = viewer ? api.pairBlocked(state, viewer.id, profile.id) : false;
      const own = viewer && viewer.id === profile.id;
      return `<article class="list-item">
        <p><strong>${escapeHtml(profile.displayName)}</strong> · @${escapeHtml(profile.handle)} ${sourceChip(profile.source)}</p>
        <p class="meta">${escapeHtml(profile.bio || "No local bio.")}</p>
        <div class="actions">
          <button type="button" class="ghost" data-switch="${profile.id}">Act as this profile</button>
          ${own || !viewer ? "" : blocked
            ? `<button type="button" class="ghost" data-unblock="${profile.id}">Unblock</button>`
            : `<button type="button" class="danger" data-block="${profile.id}">Block</button><button type="button" class="ghost" data-report-profile="${profile.id}">Report</button>`}
        </div>
      </article>`;
    }).join("");
    panels.profiles.innerHTML = `
      <form id="profileForm" class="card">
        <h1>Local profiles</h1>
        <p class="meta">These are device personas, not online accounts.</p>
        <label>Handle
          <input name="handle" required minlength="2" maxlength="24" placeholder="demo_name">
        </label>
        <label>Display name
          <input name="displayName" required maxlength="48" placeholder="Demo Name">
        </label>
        <label>Bio
          <textarea name="bio" maxlength="280" placeholder="Optional local bio"></textarea>
        </label>
        <button class="btn">Create local profile</button>
      </form>
      <div class="list">${items || `<div class="empty">No local profiles yet.</div>`}</div>
    `;
  }

  function renderSafety() {
    const viewer = activeProfile();
    if (!viewer) {
      panels.safety.innerHTML = `<div class="empty"><h1>Safety</h1><p>Create a local profile first. Reports and blocks are stored only on this device.</p></div>`;
      return;
    }
    const snapshot = api.viewerSnapshot(state, viewer.id);
    const blocks = snapshot.blocks.map((block) => {
      const otherId = block.blockerProfileId === viewer.id ? block.blockedProfileId : block.blockerProfileId;
      const direction = block.blockerProfileId === viewer.id ? "You blocked" : "Blocked you";
      return `<article class="list-item">
        <p>${direction} ${escapeHtml(profileName(otherId))}</p>
        ${block.blockerProfileId === viewer.id ? `<div class="actions"><button type="button" class="ghost" data-unblock="${block.blockedProfileId}">Unblock</button></div>` : `<p class="meta">This reverse block is honored symmetrically. Their posts stay hidden.</p>`}
      </article>`;
    }).join("");
    const reports = snapshot.reports.map((report) => (
      `<article class="list-item">
        <p><strong>${escapeHtml(report.reason)}</strong> · ${escapeHtml(report.targetType)} ${sourceChip("user")}</p>
        <p class="meta">Reporter ${escapeHtml(profileName(report.reporterProfileId))}. Target stays local; this is not a live moderation queue.</p>
        ${report.notes ? `<p>${escapeHtml(report.notes)}</p>` : ""}
      </article>`
    )).join("");
    panels.safety.innerHTML = `
      <div class="card">
        <h1>Blocks and reports</h1>
        <p>Blocked content is excluded from feed, profiles, reactions, and reports for both sides. Nothing is sent to a server.</p>
      </div>
      <div class="card">
        <h2>Local blocks</h2>
        <div class="list">${blocks || `<p class="meta">No local blocks.</p>`}</div>
      </div>
      <div class="card">
        <h2>Device-local reports</h2>
        <p class="meta">Open reports on this device only. There is no staff queue and no network receipt.</p>
        <div class="list">${reports || `<p class="meta">No visible local reports.</p>`}</div>
      </div>
    `;
  }

  function renderYou() {
    const viewer = activeProfile();
    const fixtures = api.fixtureCatalog();
    const switcher = state.profiles.map((profile) => `
      <article class="list-item">
        <p><strong>${escapeHtml(profile.displayName)}</strong> · @${escapeHtml(profile.handle)} ${sourceChip(profile.source)}</p>
        <p class="meta">Device identity switcher. This list is not a social directory and still includes blocked local profiles.</p>
        <div class="actions">
          <button type="button" class="ghost" data-switch="${profile.id}">Act as this profile</button>
        </div>
      </article>
    `).join("");
    panels.you.innerHTML = `
      <div class="card">
        <h1>This device</h1>
        <p>Active profile: <strong>${viewer ? escapeHtml(profileName(viewer.id)) : "none"}</strong></p>
        <p class="meta">${state.profiles.length} local profiles · ${state.posts.length} posts · ${state.blocks.length} blocks. Mode: local-demo. Network: offline-local.</p>
        <div class="actions">
          <button type="button" class="ghost" id="loadFixtures">Load demo fixtures</button>
          <button type="button" class="btn" id="exportData">Export JSON</button>
          <button type="button" class="ghost" id="importData">Import JSON</button>
        </div>
      </div>
      <div class="card">
        <h2>Switch local profile</h2>
        <div class="list">${switcher || `<p class="meta">No local profiles yet.</p>`}</div>
      </div>
      <div class="card">
        <h2>Fixtures vs your records</h2>
        <p>${escapeHtml(fixtures.note)}</p>
        <p class="meta">Fixture handles: ${fixtures.profiles.map((item) => `@${item.handle}`).join(", ")}</p>
      </div>
      <div class="card">
        <h2>Live website is a separate mode</h2>
        <p>The Android app’s Live tab opens aliaspaces.com. This Local tab never signs in and never writes to that database.</p>
      </div>
      <div class="card">
        <h2>If the Android signing key changes</h2>
        <p>A differently signed APK installs beside this one and does not inherit storage. Export JSON from the old install and import it here, or keep both installs while you compare.</p>
      </div>
    `;
  }

  function render() {
    renderActor();
    if (currentPanel === "feed") renderFeed();
    if (currentPanel === "compose") renderCompose();
    if (currentPanel === "profiles") renderProfiles();
    if (currentPanel === "safety") renderSafety();
    if (currentPanel === "you") renderYou();
  }

  function promptReport(targetType, targetId) {
    const viewer = activeProfile();
    if (!viewer) return showToast("Create a local profile first.");
    const reason = window.prompt(`Report reason (${api.REPORT_REASONS.join(", ")})`, "spam");
    if (!reason) return;
    const notes = window.prompt("Optional local notes", "") || "";
    mutate((current) => api.report(current, {
      reporterProfileId: viewer.id,
      targetType,
      targetId,
      reason: reason.trim(),
      notes,
    }), "Report saved on this device. No network receipt.");
  }

  function downloadExport() {
    const blob = new Blob([api.serialize(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "aliaspaces-local-demo.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    if (window.AliaSpacesAndroid && typeof window.AliaSpacesAndroid.postMessage === "function") {
      window.AliaSpacesAndroid.postMessage(JSON.stringify({ action: "export", payload: api.serialize(state) }));
    }
    showToast("Local export created. This is not an online backup.");
  }

  function ensureFileInput() {
    if (fileInput) return fileInput;
    fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "application/json,.json";
    fileInput.hidden = true;
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (!file) return;
      try {
        const text = await file.text();
        const mode = window.confirm("Replace this device store? Cancel to merge instead.") ? "replace" : "merge";
        mutate((current) => api.importBundle(current, JSON.parse(text), { mode }), `Imported as ${mode}. Still local-only.`);
      } catch (error) {
        handleError(error);
      }
    });
    document.body.appendChild(fileInput);
    return fileInput;
  }

  document.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-nav]");
    if (nav) return setPanel(nav.getAttribute("data-nav"));

    const switchTo = event.target.closest("[data-switch]");
    if (switchTo) {
      return mutate((current) => api.setActiveProfile(current, switchTo.getAttribute("data-switch")), "Now acting as that local profile.");
    }
    const react = event.target.closest("[data-react]");
    if (react) {
      const viewer = activeProfile();
      if (!viewer) return;
      return mutate((current) => api.react(current, {
        actorProfileId: viewer.id,
        postId: react.getAttribute("data-post"),
        kind: react.getAttribute("data-react"),
      }));
    }
    const block = event.target.closest("[data-block]");
    if (block) {
      const viewer = activeProfile();
      if (!viewer) return;
      if (!window.confirm("Block this local profile? Their posts and reactions will disappear for both sides.")) return;
      return mutate((current) => api.block(current, {
        blockerProfileId: viewer.id,
        blockedProfileId: block.getAttribute("data-block"),
      }), "Block saved locally. Hidden both ways.");
    }
    const unblock = event.target.closest("[data-unblock]");
    if (unblock) {
      const viewer = activeProfile();
      if (!viewer) return;
      return mutate((current) => api.unblock(current, {
        blockerProfileId: viewer.id,
        blockedProfileId: unblock.getAttribute("data-unblock"),
      }), "Local block removed.");
    }
    const reportPost = event.target.closest("[data-report-post]");
    if (reportPost) return promptReport("post", reportPost.getAttribute("data-report-post"));
    const reportProfile = event.target.closest("[data-report-profile]");
    if (reportProfile) return promptReport("profile", reportProfile.getAttribute("data-report-profile"));
    const deletePost = event.target.closest("[data-delete-post]");
    if (deletePost) {
      const viewer = activeProfile();
      if (!viewer) return;
      return mutate((current) => api.deletePost(current, {
        actorProfileId: viewer.id,
        postId: deletePost.getAttribute("data-delete-post"),
      }), "Local post deleted.");
    }
    if (event.target.id === "loadFixtures") {
      return mutate((current) => api.loadFixtures(current), "Demo fixtures loaded. They are not online users.");
    }
    if (event.target.id === "exportData") return downloadExport();
    if (event.target.id === "importData") {
      if (window.AliaSpacesAndroid && typeof window.AliaSpacesAndroid.postMessage === "function") {
        window.AliaSpacesAndroid.postMessage(JSON.stringify({ action: "import" }));
        return;
      }
      ensureFileInput().click();
    }
  });

  document.addEventListener("submit", (event) => {
    if (event.target.id === "profileForm") {
      event.preventDefault();
      const data = new FormData(event.target);
      mutate((current) => api.createProfile(current, {
        handle: String(data.get("handle") || ""),
        displayName: String(data.get("displayName") || ""),
        bio: String(data.get("bio") || ""),
        source: "user",
      }), "Local profile saved on this device.");
    }
    if (event.target.id === "composeForm") {
      event.preventDefault();
      const viewer = activeProfile();
      if (!viewer) return;
      const data = new FormData(event.target);
      mutate((current) => api.createPost(current, {
        authorProfileId: viewer.id,
        body: String(data.get("body") || ""),
      }), "Post saved locally. It was not published online.");
    }
  });

  window.AliaSpacesLocalApp = {
    replaceFromAndroid(text) {
      mutate((current) => api.importBundle(current, JSON.parse(text), { mode: "replace" }), "Imported from Android storage. Still local-only.");
    },
  };

  restore();
  render();
})();
