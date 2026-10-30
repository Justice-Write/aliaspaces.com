(() => {
  "use strict";

  const contractApi = typeof globalThis !== "undefined" ? globalThis.AliaSpacesLiveContract : null;
  const CONTRACT = (contractApi && contractApi.CONTRACT) || (typeof module !== "undefined" && module.exports
    ? null
    : null);

  // Fixture-side copies of the server checks in migration 080. The client
  // itself validates against the contract.
  const REPORT_TARGET_KINDS = Object.freeze(["persona", "post", "comment"]);
  const REPORT_REASONS = Object.freeze([
    "spam", "harassment", "hate", "sexual_content", "violence",
    "self_harm", "impersonation", "privacy", "intellectual_property", "illegal", "other",
  ]);

  class LiveError extends Error {
    constructor(code, message) {
      super(message);
      this.name = "AliaSpacesLiveError";
      this.code = code;
    }
  }

  function getContract(override) {
    if (override) return override;
    if (CONTRACT) return CONTRACT;
    if (typeof require === "function") {
      try {
        return require("./contract.js").CONTRACT;
      } catch (_error) {
        return null;
      }
    }
    throw new LiveError("missing-contract", "The live social contract is not loaded.");
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeHandle(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function memoryStorage() {
    const data = new Map();
    return {
      getItem(key) {
        return data.has(key) ? data.get(key) : null;
      },
      setItem(key, value) {
        data.set(key, String(value));
      },
      removeItem(key) {
        data.delete(key);
      },
    };
  }

  function fixtureCatalog() {
    return {
      label: "First-party fixture transport",
      note: "These records are local fixtures for the live client. They are not online users and are never written to production.",
      account: {
        id: "acct_fixture_north",
        email: "fixture.north@example.invalid",
      },
      password: "fixture-only-not-production",
      personas: [
        {
          id: "persona_north",
          owner: "acct_fixture_north",
          handle: "fixture_north",
          name: "Fixture North",
          tagline: "Local fixture persona",
          bio: "Not an online account.",
          visibility: "public",
          publication_state: "published",
          nsfw: false,
        },
        {
          id: "persona_south",
          owner: "acct_fixture_south",
          handle: "fixture_south",
          name: "Fixture South",
          tagline: "Second fixture persona",
          bio: "Used to test blocks without touching production.",
          visibility: "public",
          publication_state: "published",
          nsfw: false,
        },
      ],
      posts: [
        {
          id: "post_north",
          persona_id: "persona_north",
          kind: "update",
          title: "",
          body: "Fixture post from North. Stored only in the demo transport.",
          created_at: "2026-09-20T00:00:00.000Z",
        },
        {
          id: "post_south",
          persona_id: "persona_south",
          kind: "update",
          title: "",
          body: "Fixture post from South. A block should hide this from North.",
          created_at: "2026-09-20T00:01:00.000Z",
        },
      ],
    };
  }

  function createMemoryTransport(seed = {}) {
    const catalog = fixtureCatalog();
    const state = {
      account: seed.account ? clone(seed.account) : null,
      accessToken: seed.accessToken || null,
      personas: clone(seed.personas || catalog.personas),
      posts: clone(seed.posts || catalog.posts),
      blocks: clone(seed.blocks || []),
      comments: clone(seed.comments || []),
      reactions: clone(seed.reactions || []),
      visibilityRules: clone(seed.visibilityRules || []),
      friendships: clone(seed.friendships || []),
      reports: clone(seed.reports || []),
      // Names of migration 080 RPCs this fixture should treat as not yet deployed.
      serverPending: new Set(seed.serverPending || []),
    };

    function requireSession(session) {
      if (!session || !session.access_token || !session.user || !session.user.id) {
        const error = new LiveError("unsigned", "A verified session is required.");
        return { error };
      }
      if (state.accessToken && session.access_token !== state.accessToken) {
        return { error: new LiveError("unsigned", "That session is not recognized by the fixture transport.") };
      }
      return { user: session.user };
    }

    return {
      kind: "fixture-memory",
      async authPassword({ email, password }) {
        const expectedEmail = (seed.account && seed.account.email) || catalog.account.email;
        const expectedPassword = seed.password || catalog.password;
        if (email !== expectedEmail || password !== expectedPassword) {
          return { error: new LiveError("auth-failed", "Fixture sign-in rejected those credentials.") };
        }
        state.account = seed.account ? clone(seed.account) : clone(catalog.account);
        state.accessToken = "fixture-access-token";
        return {
          session: {
            access_token: state.accessToken,
            refresh_token: "fixture-refresh-token",
            user: { id: state.account.id, email: state.account.email },
          },
        };
      },
      async authSignup() {
        return { error: new LiveError("signup-disabled", "Fixture transport does not create production accounts.") };
      },
      async authUser(session) {
        const check = requireSession(session);
        if (check.error) return { error: check.error };
        return { user: check.user };
      },
      async authLogout() {
        state.accessToken = null;
        return { ok: true };
      },
      async rpc(name, args, session) {
        if (name === "persona_by_handle") {
          const handle = normalizeHandle(args && args.h);
          const persona = state.personas.find((item) => item.handle === handle) || null;
          return { data: persona ? [persona] : [] };
        }
        const check = requireSession(session);
        if (check.error) return { error: check.error };
        const userId = check.user.id;
        if (name === "my_personas") {
          return { data: state.personas.filter((item) => item.owner === userId) };
        }
        if (name === "my_persona_mode_profile_posts") {
          const actor = state.personas.find((item) => item.id === args.p_actor_persona_id && item.owner === userId);
          if (!actor) return { error: new LiveError("unknown-persona", "That acting persona is not yours.") };
          const hidden = new Set(hiddenPersonaIds(state, userId));
          const rows = state.posts.filter((post) => {
            if (args.p_target_persona_id && post.persona_id !== args.p_target_persona_id) return false;
            if (hidden.has(post.persona_id) && post.persona_id !== actor.id) return false;
            return true;
          });
          return { data: rows };
        }
        if (name === "save_persona_post") {
          const actor = state.personas.find((item) => item.id === args.p_persona_id && item.owner === userId);
          if (!actor) return { error: new LiveError("unknown-persona", "Only the owner can save that persona's post.") };
          const post = {
            id: args.p_post_id || `post_${state.posts.length + 1}`,
            persona_id: actor.id,
            kind: args.p_kind || "update",
            title: normalizeText(args.p_title || ""),
            body: normalizeText(args.p_body || ""),
            tags: args.p_tags == null ? "" : String(args.p_tags),
            media_url: args.p_media_url || "",
            publication_state: "draft",
            created_at: new Date().toISOString(),
          };
          state.posts.unshift(post);
          return { data: post };
        }
        if (name === "delete_persona_post") {
          const post = state.posts.find((item) => item.id === args.p_post_id);
          if (!post) return { error: new LiveError("unknown-post", "That post was not found.") };
          const actor = state.personas.find((item) => item.id === post.persona_id && item.owner === userId);
          if (!actor) return { error: new LiveError("not-author", "Only the owner can delete that post.") };
          state.posts = state.posts.filter((item) => item.id !== post.id);
          return { data: { id: post.id } };
        }
        if (name === "toggle_persona_reaction") {
          const key = `${userId}:${args.p_post_id}:${args.p_kind}`;
          const existing = state.reactions.find((item) => `${item.account_id}:${item.post_id}:${item.kind}` === key);
          if (existing) {
            state.reactions = state.reactions.filter((item) => item !== existing);
            return { data: { removed: true } };
          }
          state.reactions.push({
            account_id: userId,
            persona_id: args.p_persona_id,
            post_id: args.p_post_id,
            kind: args.p_kind,
          });
          return { data: { removed: false } };
        }
        if (name === "add_persona_comment") {
          const comment = {
            id: `cmt_${state.comments.length + 1}`,
            account_id: userId,
            persona_id: args.p_persona_id,
            post_id: args.p_post_id,
            body: normalizeText(args.p_body || ""),
          };
          state.comments.push(comment);
          return { data: comment };
        }
        if (name === "delete_persona_comment") {
          state.comments = state.comments.filter((item) => item.id !== args.p_comment_id);
          return { data: { id: args.p_comment_id } };
        }
        if (name === "set_persona_visibility_rule") {
          const kind = args.p_kind;
          const other = args.p_other_persona_id;
          state.visibilityRules = state.visibilityRules.filter((item) => !(
            item.account_id === userId && item.other_persona_id === other && item.kind === kind
          ));
          if (args.p_enabled) {
            state.visibilityRules.push({
              account_id: userId,
              other_persona_id: other,
              kind,
            });
          }
          if (kind === "block") {
            const owned = new Set(state.personas.filter((item) => item.owner === userId).map((item) => item.id));
            state.friendships = state.friendships.filter((item) => (
              !owned.has(item.owned_persona_id) || item.other_persona_id !== other
            ));
          }
          return { data: { ok: true } };
        }
        if (name === "respond_persona_friendship") {
          const row = state.friendships.find((item) => item.id === args.p_request_id);
          if (!row) return { error: new LiveError("unknown-request", "That friendship request was not found.") };
          row.status = args.p_accept ? "accepted" : "declined";
          return { data: row };
        }
        if (name === "remove_persona_friendship") {
          state.friendships = state.friendships.filter((item) => !(
            item.owned_persona_id === args.p_owned_persona_id &&
            item.other_persona_id === args.p_other_persona_id
          ));
          return { data: { ok: true } };
        }
        if (name === "update_my_profile") {
          return { data: { display_name: args.p_display_name } };
        }
        if (state.serverPending.has(name)) {
          const error = new LiveError("http", `Could not find the function public.${name}`);
          error.status = 404;
          error.body = { code: "PGRST202", message: error.message };
          return { error };
        }
        if (name === "report_content") {
          if (!REPORT_TARGET_KINDS.includes(args.p_target_kind) || !args.p_target_id) {
            return { error: new LiveError("http", "Invalid report target") };
          }
          if (!REPORT_REASONS.includes(args.p_reason)) {
            return { error: new LiveError("http", "Invalid report reason") };
          }
          if (args.p_reporter_persona_id && !state.personas.some((item) => (
            item.id === args.p_reporter_persona_id && item.owner === userId
          ))) {
            return { error: new LiveError("http", "Acting persona must be yours") };
          }
          const target = fixtureReportTarget(state, userId, args.p_target_kind, args.p_target_id);
          if (!target) return { error: new LiveError("http", "Reported content was not found") };
          if (target.owner === userId) return { error: new LiveError("http", "You cannot report your own content") };
          const existing = state.reports.find((item) => (
            item.reporter === userId &&
            item.target_kind === args.p_target_kind &&
            item.target_id === args.p_target_id &&
            item.state !== "resolved"
          ));
          if (existing) return { data: { id: existing.id, state: existing.state, duplicate: true } };
          const report = {
            id: `report_${state.reports.length + 1}`,
            reporter: userId,
            reporter_persona_id: args.p_reporter_persona_id || null,
            target_kind: args.p_target_kind,
            target_id: args.p_target_id,
            target_owner: target.owner,
            reason: args.p_reason,
            details: normalizeText(args.p_details || ""),
            state: "open",
            created_at: new Date().toISOString(),
          };
          state.reports.push(report);
          return { data: { id: report.id, state: report.state, duplicate: false } };
        }
        if (name === "my_content_reports") {
          return {
            data: state.reports
              .filter((item) => item.reporter === userId)
              .map((item) => ({
                id: item.id,
                target_kind: item.target_kind,
                target_id: item.target_id,
                reason: item.reason,
                state: item.state,
                created_at: item.created_at,
                updated_at: item.updated_at || item.created_at,
              })),
          };
        }
        return { error: new LiveError("unknown-rpc", `Fixture transport has no handler for ${name}.`) };
      },
      async select(table, query, session) {
        if (table === "personas") {
          let rows = state.personas.slice();
          if (query && query.visibility) rows = rows.filter((item) => item.visibility === query.visibility);
          if (query && query.publication_state) {
            rows = rows.filter((item) => item.publication_state === query.publication_state);
          }
          if (query && query.handle) rows = rows.filter((item) => item.handle === query.handle);
          return { data: rows };
        }
        if (table === "posts") {
          let rows = state.posts.slice();
          if (query && query.persona_id) rows = rows.filter((item) => item.persona_id === query.persona_id);
          return { data: rows };
        }
        if (table === "blocks" || table === "follows" || table === "profiles") {
          const check = requireSession(session);
          if (check.error) return { error: check.error };
          if (table === "blocks") {
            return {
              data: state.visibilityRules
                .filter((item) => item.account_id === check.user.id && item.kind === "block")
                .map((item) => ({ blocker: item.account_id, blocked_persona: item.other_persona_id })),
            };
          }
          if (table === "follows") {
            return { data: state.friendships.filter((item) => item.account_id === check.user.id) };
          }
          return { data: [{ id: check.user.id, email: check.user.email }] };
        }
        if (table === "comments") {
          let rows = state.comments.slice();
          if (query && query.post_id) rows = rows.filter((item) => item.post_id === query.post_id);
          return { data: rows };
        }
        if (table === "reactions") {
          let rows = state.reactions.slice();
          if (query && query.post_id) rows = rows.filter((item) => item.post_id === query.post_id);
          return { data: rows };
        }
        if (table === "albums" || table === "persona_links") return { data: [] };
        return { error: new LiveError("unknown-table", `Fixture transport cannot read ${table}.`) };
      },
      _state: state,
    };
  }

  function hiddenPersonaIds(state, accountId) {
    return state.visibilityRules
      .filter((item) => item.account_id === accountId && (item.kind === "block" || item.kind === "mute"))
      .map((item) => item.other_persona_id);
  }

  // Mirrors moderation_private.report_persona_reachable() in migration 080: visible to
  // the account, or hidden only by the account's own block/mute of a public,
  // published persona. A block by the other side reads as not found.
  function fixturePersonaReachable(state, accountId, personaId) {
    const persona = state.personas.find((item) => item.id === personaId);
    if (!persona) return false;
    if (persona.owner === accountId) return true;
    const open = ["public", "unlisted"].includes(persona.visibility) && persona.publication_state === "published";
    if (!open) return false;
    const mine = new Set(state.personas.filter((item) => item.owner === accountId).map((item) => item.id));
    const blockedByOwner = state.visibilityRules.some((rule) => (
      rule.account_id === persona.owner && rule.kind === "block" && mine.has(rule.other_persona_id)
    ));
    const ownRule = state.visibilityRules.some((rule) => (
      rule.account_id === accountId && rule.other_persona_id === personaId &&
      (rule.kind === "block" || rule.kind === "mute")
    ));
    if (ownRule) return true;
    return !blockedByOwner;
  }

  function fixtureReportTarget(state, accountId, kind, targetId) {
    const ownerOf = (personaId) => {
      const persona = state.personas.find((item) => item.id === personaId);
      return persona ? persona.owner : null;
    };
    if (kind === "persona") {
      return fixturePersonaReachable(state, accountId, targetId) ? { owner: ownerOf(targetId) } : null;
    }
    if (kind === "post") {
      const post = state.posts.find((item) => item.id === targetId);
      if (!post || !fixturePersonaReachable(state, accountId, post.persona_id)) return null;
      return { owner: ownerOf(post.persona_id) };
    }
    const comment = state.comments.find((item) => item.id === targetId);
    if (!comment) return null;
    const post = state.posts.find((item) => item.id === comment.post_id);
    if (!post) return null;
    if (!fixturePersonaReachable(state, accountId, comment.persona_id)) return null;
    if (!fixturePersonaReachable(state, accountId, post.persona_id)) return null;
    return { owner: ownerOf(comment.persona_id) };
  }

  function normalizeTags(value) {
    if (Array.isArray(value)) return value.map((item) => normalizeText(item)).filter(Boolean).join(", ");
    return normalizeText(value || "");
  }

  function isMissingFunction(error) {
    if (!error) return false;
    if (error.body && error.body.code === "PGRST202") return true;
    return error.status === 404;
  }

  // Plans an explicit owner migration of a milestone 1 local-demo export into
  // review-gated drafts. Pure: no network. Only posts whose local profile the
  // owner maps to one of their own personas are planned. Fixture records,
  // reactions, reports, and blocks are never imported: they point at
  // device-only profiles, not real accounts.
  function planLocalDemoImport(bundle, options = {}) {
    const contract = getContract(options.contract);
    if (!bundle || typeof bundle !== "object" || bundle.format !== "aliaspaces.social.local") {
      throw new LiveError("invalid-import", "That file is not an AliaSpaces local-demo export.");
    }
    const state = bundle.state && typeof bundle.state === "object" ? bundle.state : null;
    if (bundle.network !== "offline-local" || !state || (state.network && state.network !== "offline-local")) {
      throw new LiveError("invalid-import", "Import refused a bundle that claims a network.");
    }
    const owned = new Set(options.ownedPersonaIds || []);
    const mapping = options.mapping || {};
    for (const personaId of Object.values(mapping)) {
      if (personaId && !owned.has(personaId)) {
        throw new LiveError("not-your-persona", "Local profiles can only become drafts on personas you own.");
      }
    }
    const profiles = Array.isArray(state.profiles) ? state.profiles : [];
    const posts = Array.isArray(state.posts) ? state.posts : [];
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    const items = [];
    const skipped = [];
    const ordered = posts.slice().sort((left, right) => (
      String(left.createdAt || "").localeCompare(String(right.createdAt || ""))
    ));
    for (const post of ordered) {
      const author = profileById.get(post.authorProfileId);
      if (post.source === "fixture" || (author && author.source === "fixture")) {
        skipped.push({ localPostId: post.id, reason: "fixture" });
        continue;
      }
      if (!author) {
        skipped.push({ localPostId: post.id, reason: "unknown-author" });
        continue;
      }
      const personaId = mapping[author.id];
      if (!personaId) {
        skipped.push({ localPostId: post.id, reason: "unmapped-profile" });
        continue;
      }
      const body = normalizeText(post.body);
      if (!body) {
        skipped.push({ localPostId: post.id, reason: "empty" });
        continue;
      }
      items.push({
        localPostId: post.id,
        localProfileId: author.id,
        personaId,
        kind: "update",
        title: "",
        body,
        tags: contract.localImportTag,
        localCreatedAt: post.createdAt || null,
      });
    }
    return {
      items,
      skipped,
      notImported: {
        reactions: Array.isArray(state.reactions) ? state.reactions.length : 0,
        reports: Array.isArray(state.reports) ? state.reports.length : 0,
        blocks: Array.isArray(state.blocks) ? state.blocks.length : 0,
      },
      profiles: profiles
        .filter((profile) => profile.source !== "fixture")
        .map((profile) => ({ id: profile.id, handle: profile.handle, displayName: profile.displayName || "" })),
      warning: "Local reactions, reports, and blocks stay on the device because they point at device-only profiles. Each imported post becomes a review-gated draft. Importing the same file twice creates duplicates.",
    };
  }

  function createHttpTransport(options = {}) {
    const contract = getContract(options.contract);
    const fetchImpl = options.fetchImpl || (typeof fetch === "function" ? fetch.bind(globalThis) : null);
    if (!fetchImpl) {
      throw new LiveError("no-fetch", "No fetch implementation is available for the live transport.");
    }

    async function request(path, init, session) {
      const headers = Object.assign({
        apikey: contract.publishableKey,
        "Content-Type": "application/json",
      }, init.headers || {});
      const token = session && session.access_token ? session.access_token : contract.publishableKey;
      headers.Authorization = `Bearer ${token}`;
      let response;
      try {
        response = await fetchImpl(`${contract.supabaseUrl}${path}`, Object.assign({}, init, { headers }));
      } catch (error) {
        throw new LiveError("offline", error && error.message ? error.message : "The live database could not be reached.");
      }
      const text = await response.text();
      let body = null;
      if (text) {
        try {
          body = JSON.parse(text);
        } catch (_error) {
          body = { message: text };
        }
      }
      if (!response.ok) {
        const message = (body && (body.message || body.error_description || body.msg)) || `HTTP ${response.status}`;
        const error = new LiveError(response.status === 401 || response.status === 403 ? "unsigned" : "http", message);
        error.status = response.status;
        error.body = body;
        return { error };
      }
      return { data: body };
    }

    return {
      kind: "live-supabase",
      async authPassword({ email, password }) {
        return request("/auth/v1/token?grant_type=password", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
      },
      async authSignup({ email, password }) {
        return request("/auth/v1/signup", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
      },
      async authUser(session) {
        return request("/auth/v1/user", { method: "GET" }, session);
      },
      async authLogout(session) {
        return request("/auth/v1/logout", { method: "POST" }, session);
      },
      async rpc(name, args, session) {
        return request(`/rest/v1/rpc/${name}`, {
          method: "POST",
          body: JSON.stringify(args || {}),
        }, session);
      },
      async select(table, query, session) {
        const params = new URLSearchParams();
        params.set("select", (query && query.select) || "*");
        if (query && query.visibility) params.set("visibility", `eq.${query.visibility}`);
        if (query && query.publication_state) params.set("publication_state", `eq.${query.publication_state}`);
        if (query && query.handle) params.set("handle", `eq.${query.handle}`);
        if (query && query.persona_id) params.set("persona_id", `eq.${query.persona_id}`);
        if (query && query.post_id) params.set("post_id", `eq.${query.post_id}`);
        if (query && query.blocker) params.set("blocker", `eq.${query.blocker}`);
        if (query && query.order) params.append("order", query.order);
        if (query && query.limit) params.set("limit", String(query.limit));
        return request(`/rest/v1/${table}?${params.toString()}`, { method: "GET" }, session);
      },
    };
  }

  function createClient(options = {}) {
    const contract = getContract(options.contract);
    const mode = options.mode || (options.transport && options.transport.kind === "fixture-memory" ? "fixture" : "live");
    const transport = options.transport || (mode === "fixture"
      ? createMemoryTransport(options.seed)
      : createHttpTransport({ contract, fetchImpl: options.fetchImpl }));
    const storage = options.storage || (typeof localStorage !== "undefined" ? localStorage : memoryStorage());
    let session = options.session || null;

    function persist() {
      if (!session) {
        storage.removeItem(contract.sessionStorageKey);
        return;
      }
      storage.setItem(contract.sessionStorageKey, JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token || null,
        user: session.user,
      }));
    }

    function restore() {
      if (session) return session;
      const raw = storage.getItem(contract.sessionStorageKey);
      if (!raw) return null;
      try {
        session = JSON.parse(raw);
      } catch (_error) {
        session = null;
      }
      return session;
    }

    function status() {
      restore();
      const signedIn = !!(session && session.access_token && session.user && session.user.id);
      return {
        audience: contract.audience,
        mode,
        network: transport.kind,
        signedIn,
        sessionState: signedIn ? "signed-in" : "signed-out",
        accountId: signedIn ? session.user.id : null,
        email: signedIn ? session.user.email || null : null,
      };
    }

    function requireSignedIn() {
      const current = status();
      if (!current.signedIn) {
        throw new LiveError("unsigned", "Sign in first. The app does not claim a session until Auth verifies one.");
      }
      return session;
    }

    function assertAllowedRpc(name, { write }) {
      if (contract.forbiddenRpcs.includes(name)) {
        throw new LiveError("forbidden-rpc", `${name} is automation/control-plane and is blocked in this client.`);
      }
      if ((contract.staffOnlyRpcs || []).includes(name)) {
        throw new LiveError("staff-surface", `${name} belongs to the staff moderation surface, not this client.`);
      }
      const spec = contract.allowedRpcs[name];
      if (!spec) throw new LiveError("unknown-rpc", `${name} is not in the AliaSpaces social contract.`);
      if (write && !spec.writes) {
        throw new LiveError("read-only-rpc", `${name} cannot be used to write.`);
      }
      if (spec.auth === "session") requireSignedIn();
      return spec;
    }

    function assertAllowedTable(table) {
      const spec = contract.allowedTables[table];
      if (!spec) throw new LiveError("unknown-table", `${table} is not a social table this client may read.`);
      if (spec.auth === "session") requireSignedIn();
      return spec;
    }

    async function wrap(work) {
      try {
        const result = await work();
        if (result && result.error) {
          return { ok: false, error: result.error };
        }
        return { ok: true, data: result && "data" in result ? result.data : result };
      } catch (error) {
        return { ok: false, error };
      }
    }

    async function signInWithPassword(input) {
      const email = normalizeText(input && input.email);
      const password = String((input && input.password) || "");
      if (!email || !password) {
        return { ok: false, error: new LiveError("invalid-auth", "Email and password are required.") };
      }
      const result = await wrap(() => transport.authPassword({ email, password }));
      if (!result.ok) return result;
      const payload = result.data;
      const next = payload && (payload.session || payload);
      if (!next || !next.access_token || !next.user || !next.user.id) {
        return {
          ok: false,
          error: new LiveError("unsigned", "Auth did not return a verified session. This is not treated as signed in."),
        };
      }
      session = {
        access_token: next.access_token,
        refresh_token: next.refresh_token || null,
        user: { id: next.user.id, email: next.user.email || email },
      };
      persist();
      return { ok: true, session: clone(session), status: status() };
    }

    async function signUp(input) {
      if (mode === "fixture") {
        return { ok: false, error: new LiveError("signup-disabled", "Fixture mode does not create production accounts.") };
      }
      const email = normalizeText(input && input.email);
      const password = String((input && input.password) || "");
      if (!email || !password) {
        return { ok: false, error: new LiveError("invalid-auth", "Email and password are required.") };
      }
      const result = await wrap(() => transport.authSignup({ email, password }));
      if (!result.ok) return result;
      const next = result.data && (result.data.session || result.data);
      if (next && next.access_token && next.user && next.user.id) {
        session = {
          access_token: next.access_token,
          refresh_token: next.refresh_token || null,
          user: { id: next.user.id, email: next.user.email || email },
        };
        persist();
        return {
          ok: true,
          confirmed: true,
          status: status(),
          message: "Signed in after sign-up. A verified session is present.",
        };
      }
      return {
        ok: true,
        confirmed: false,
        status: status(),
        message: "Sign-up was accepted, but no session is present yet. Confirm the email before this app says signed in.",
      };
    }

    async function signOut() {
      if (session) {
        await wrap(() => transport.authLogout(session));
      }
      session = null;
      persist();
      return { ok: true, status: status() };
    }

    async function verifySession() {
      restore();
      if (!session) return { ok: true, status: status() };
      const result = await wrap(() => transport.authUser(session));
      const user = result.ok ? (result.data && (result.data.id ? result.data : result.data.user)) : null;
      if (!result.ok || !user || !user.id) {
        session = null;
        persist();
        return {
          ok: false,
          error: new LiveError("unsigned", "Saved tokens were not a verified session. Signed-in is cleared."),
          status: status(),
        };
      }
      session.user = { id: user.id, email: user.email || session.user.email };
      persist();
      return { ok: true, status: status() };
    }

    async function callRpc(name, args, { write } = {}) {
      const result = await wrap(async () => {
        assertAllowedRpc(name, { write: !!write });
        return transport.rpc(name, args || {}, session);
      });
      const spec = contract.allowedRpcs[name];
      if (!result.ok && spec && spec.server && isMissingFunction(result.error)) {
        // PostgREST answers 404 when the function is not deployed yet.
        return {
          ok: false,
          error: new LiveError(
            "reports-not-enabled",
            "Reporting is not enabled on the server yet. Nothing was sent.",
          ),
        };
      }
      return result;
    }

    async function readTable(table, query) {
      return wrap(async () => {
        assertAllowedTable(table);
        return transport.select(table, query || {}, session);
      });
    }

    function toIdentityProjection(account, persona) {
      return {
        account_id: account.id,
        persona_id: persona.id,
        handle: persona.handle,
        display_name: persona.name || persona.display_name || "",
        lifecycle_state: persona.publication_state || persona.visibility || "unknown",
        visibility: persona.visibility || null,
      };
    }

    function pairBlocked(rules, leftPersonaId, rightPersonaId) {
      if (!leftPersonaId || !rightPersonaId || leftPersonaId === rightPersonaId) return false;
      return rules.some((rule) => (
        rule.kind === "block" && (
          (rule.other_persona_id === rightPersonaId) ||
          (rule.other_persona_id === leftPersonaId)
        )
      ));
    }

    function visiblePosts(posts, rules, viewerPersonaId) {
      const hidden = new Set(
        (rules || [])
          .filter((rule) => rule.kind === "block" || rule.kind === "mute")
          .map((rule) => rule.other_persona_id)
      );
      return (posts || []).filter((post) => {
        if (!post || !post.persona_id) return false;
        if (viewerPersonaId && post.persona_id === viewerPersonaId) return true;
        return !hidden.has(post.persona_id);
      });
    }

    const clientApi = {
      CONTRACT: contract,
      LiveError,
      status,
      restoreSession: restore,
      signInWithPassword,
      signUp,
      signOut,
      verifySession,
      fixtureCatalog,
      async listPublicPersonas(query) {
        return readTable("personas", {
          select: contract.publicPersonaFields,
          visibility: "public",
          publication_state: "published",
          order: "created_at.desc",
          limit: (query && query.limit) || 20,
        });
      },
      async getPersonaByHandle(handle) {
        const normalized = normalizeHandle(handle);
        if (!normalized) {
          return { ok: false, error: new LiveError("invalid-handle", "A handle is required.") };
        }
        const rpc = await callRpc("persona_by_handle", { h: normalized });
        if (rpc.ok && Array.isArray(rpc.data) && rpc.data[0]) return { ok: true, data: rpc.data[0] };
        const fallback = await readTable("personas", {
          select: contract.publicPersonaFields,
          handle: normalized,
          publication_state: "published",
        });
        if (!fallback.ok) return fallback;
        return { ok: true, data: Array.isArray(fallback.data) ? fallback.data[0] || null : null };
      },
      async listPublicPosts(personaId) {
        if (!personaId) return { ok: false, error: new LiveError("unknown-persona", "A persona id is required.") };
        return readTable("posts", {
          select: "id,persona_id,kind,title,body,created_at",
          persona_id: personaId,
          order: "created_at.desc",
          limit: 30,
        });
      },
      async myPersonas() {
        const result = await callRpc("my_personas", {});
        if (!result.ok) return result;
        const account = { id: session.user.id, email: session.user.email };
        const projections = (Array.isArray(result.data) ? result.data : []).map((persona) => (
          toIdentityProjection(account, persona)
        ));
        return { ok: true, data: result.data, projections };
      },
      async myProfilePosts(input) {
        return callRpc("my_persona_mode_profile_posts", {
          p_actor_persona_id: input.actorPersonaId,
          p_target_persona_id: input.targetPersonaId,
          p_before_created_at: input.beforeCreatedAt || null,
          p_before_id: input.beforeId || null,
          p_kind: input.kind || "all",
          p_search: input.search || "",
          p_limit: input.limit || 20,
        });
      },
      async savePost(input) {
        const body = normalizeText(input && input.body);
        if (!body) return { ok: false, error: new LiveError("invalid-post", "A post body is required.") };
        const result = await callRpc("save_persona_post", {
          p_post_id: input.postId || null,
          p_persona_id: input.personaId,
          p_kind: input.kind || "update",
          p_title: normalizeText(input.title || ""),
          p_body: body,
          p_tags: normalizeTags(input.tags),
          p_media_url: input.mediaUrl || "",
        }, { write: true });
        if (!result.ok) return result;
        return {
          ok: true,
          data: result.data,
          published: false,
          reviewRequired: true,
          message: "Post submitted to the live database. Existing review/publish gates still apply; this is not auto-published.",
        };
      },
      async deletePost(input) {
        return callRpc("delete_persona_post", { p_post_id: input.postId }, { write: true });
      },
      async toggleReaction(input) {
        if (!contract.reactionKinds.includes(input.kind)) {
          return { ok: false, error: new LiveError("invalid-reaction", "Unknown reaction.") };
        }
        return callRpc("toggle_persona_reaction", {
          p_post_id: input.postId,
          p_persona_id: input.personaId,
          p_kind: input.kind,
        }, { write: true });
      },
      async addComment(input) {
        const body = normalizeText(input && input.body);
        if (!body) return { ok: false, error: new LiveError("invalid-comment", "A comment body is required.") };
        return callRpc("add_persona_comment", {
          p_post_id: input.postId,
          p_persona_id: input.personaId,
          p_body: body,
        }, { write: true });
      },
      async setVisibilityRule(input) {
        if (!contract.visibilityKinds.includes(input.kind)) {
          return { ok: false, error: new LiveError("invalid-visibility", "Visibility rules are block or mute.") };
        }
        return callRpc("set_persona_visibility_rule", {
          p_other_persona_id: input.otherPersonaId,
          p_kind: input.kind,
          p_enabled: !!input.enabled,
        }, { write: true });
      },
      async respondFriendship(input) {
        return callRpc("respond_persona_friendship", {
          p_request_id: input.requestId,
          p_accept: !!input.accept,
        }, { write: true });
      },
      async removeFriendship(input) {
        return callRpc("remove_persona_friendship", {
          p_owned_persona_id: input.ownedPersonaId,
          p_other_persona_id: input.otherPersonaId,
        }, { write: true });
      },
      async myBlocks() {
        return wrap(async () => {
          const current = requireSignedIn();
          return transport.select("blocks", { blocker: current.user.id, order: "id.asc" }, current);
        });
      },
      pairBlocked,
      visiblePosts,
      toIdentityProjection,
      callRpc,
      readTable,
      async reportContent(input) {
        const kind = input && input.targetKind;
        if (!contract.reportTargetKinds.includes(kind) || !(input && input.targetId)) {
          return { ok: false, error: new LiveError("invalid-report", "Choose a persona, post, or comment to report.") };
        }
        if (!contract.reportReasons.includes(input.reason)) {
          return { ok: false, error: new LiveError("invalid-report", "Choose a reason for the report.") };
        }
        const details = normalizeText(input.details || "");
        if (details.length > contract.reportDetailsMax) {
          return {
            ok: false,
            error: new LiveError("invalid-report", `Report details are limited to ${contract.reportDetailsMax} characters.`),
          };
        }
        const result = await callRpc("report_content", {
          p_target_kind: kind,
          p_target_id: input.targetId,
          p_reason: input.reason,
          p_details: details,
          p_reporter_persona_id: input.reporterPersonaId || null,
        }, { write: true });
        if (!result.ok) return result;
        const raw = result.data || {};
        const data = {
          reportId: typeof raw === "string" ? raw : raw.id || null,
          state: raw.state || "open",
          duplicate: !!raw.duplicate,
          queued: true,
        };
        return {
          ok: true,
          data,
          duplicate: data.duplicate,
          message: data.duplicate
            ? "You already reported this. Staff still have your earlier report."
            : "Report sent to the staff review queue. It does not remove anything by itself.",
        };
      },
      async myReports(input) {
        return callRpc("my_content_reports", { p_limit: (input && input.limit) || 50 });
      },
      planLocalDemoImport(bundle, options = {}) {
        return planLocalDemoImport(bundle, Object.assign({ contract }, options));
      },
    };

    clientApi.importLocalDemoDrafts = async function importLocalDemoDrafts(plan) {
      if (!status().signedIn) {
        return { ok: false, error: new LiveError("unsigned", "Sign in first. Imports run only under a verified session.") };
      }
      if (!plan || !Array.isArray(plan.items)) {
        return { ok: false, error: new LiveError("invalid-import", "Plan the import before running it.") };
      }
      const mine = await clientApi.myPersonas();
      if (!mine.ok) return mine;
      const owned = new Set((Array.isArray(mine.data) ? mine.data : []).map((persona) => persona.id));
      if (plan.items.some((item) => !owned.has(item.personaId))) {
        return {
          ok: false,
          error: new LiveError("not-your-persona", "Every imported draft must land on a persona this account owns. Nothing was imported."),
        };
      }
      const results = [];
      for (const item of plan.items) {
        const saved = await clientApi.savePost({
          personaId: item.personaId,
          kind: "update",
          title: "",
          body: item.body,
          tags: item.tags || contract.localImportTag,
        });
        results.push({
          localPostId: item.localPostId,
          ok: saved.ok,
          postId: saved.ok && saved.data ? saved.data.id || null : null,
          error: saved.ok ? null : saved.error && saved.error.message,
        });
        if (!saved.ok) break;
      }
      const imported = results.filter((item) => item.ok).length;
      return {
        ok: imported === plan.items.length,
        imported,
        total: plan.items.length,
        results,
        published: false,
        reviewRequired: true,
        message: `${imported} of ${plan.items.length} local posts saved as review-gated drafts. Nothing was published.`,
      };
    };

    return clientApi;
  }

  const api = {
    LiveError,
    fixtureCatalog,
    planLocalDemoImport,
    createMemoryTransport,
    createHttpTransport,
    createClient,
  };

  const root = typeof globalThis !== "undefined" ? globalThis : undefined;
  if (root) root.AliaSpacesLiveClient = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
