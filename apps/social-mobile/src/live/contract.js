(() => {
  "use strict";

  const CONTRACT = Object.freeze({
    audience: "aliaspaces-social-mobile",
    supabaseUrl: "https://nwsqyuucwzihruszocge.supabase.co",
    publishableKey: "sb_publishable_vN6BdSvBKf_yTJt0eeK20w_afKz1Df2",
    productOrigin: "https://mypersonas.online",
    sessionStorageKey: "aliaspaces.social.live.session.v1",
    identityProjection: Object.freeze([
      "account_id",
      "persona_id",
      "handle",
      "lifecycle_state",
    ]),
    publicPersonaFields: "id,handle,name,tagline,bio,nsfw,visibility,avatar_url,banner_url,theme,topics,hashtags,title,focus,publication_state,created_at,updated_at",
    allowedRpcs: Object.freeze({
      my_personas: Object.freeze({ auth: "session", writes: false }),
      persona_by_handle: Object.freeze({ auth: "optional", writes: false }),
      my_persona_mode_profile_posts: Object.freeze({ auth: "session", writes: false }),
      save_persona_post: Object.freeze({ auth: "session", writes: true }),
      delete_persona_post: Object.freeze({ auth: "session", writes: true }),
      toggle_persona_reaction: Object.freeze({ auth: "session", writes: true }),
      add_persona_comment: Object.freeze({ auth: "session", writes: true }),
      delete_persona_comment: Object.freeze({ auth: "session", writes: true }),
      set_persona_visibility_rule: Object.freeze({ auth: "session", writes: true }),
      respond_persona_friendship: Object.freeze({ auth: "session", writes: true }),
      remove_persona_friendship: Object.freeze({ auth: "session", writes: true }),
      update_my_profile: Object.freeze({ auth: "session", writes: false }),
      // MyPersonas migration 080. Until it is applied the client reports
      // "reports-not-enabled" and never claims a report was filed.
      report_content: Object.freeze({ auth: "session", writes: true, server: "080" }),
      my_content_reports: Object.freeze({ auth: "session", writes: false, server: "080" }),
    }),
    // Staff moderation needs its own authorized surface, not this client.
    staffOnlyRpcs: Object.freeze([
      "staff_list_content_reports",
      "staff_review_content_report",
      "staff_set_content_hold",
    ]),
    allowedTables: Object.freeze({
      personas: Object.freeze({ auth: "optional", writes: false }),
      posts: Object.freeze({ auth: "optional", writes: false }),
      blocks: Object.freeze({ auth: "session", writes: false }),
      follows: Object.freeze({ auth: "session", writes: false }),
      comments: Object.freeze({ auth: "optional", writes: false }),
      reactions: Object.freeze({ auth: "optional", writes: false }),
      albums: Object.freeze({ auth: "optional", writes: false }),
      profiles: Object.freeze({ auth: "session", writes: false }),
      persona_links: Object.freeze({ auth: "optional", writes: false }),
    }),
    forbiddenRpcs: Object.freeze([
      "my_ai_backend_status",
      "save_ai_task_definition",
      "create_ai_backend",
      "update_ai_backend",
      "delete_ai_backend",
      "save_owner_draft",
      "append_agent_messages",
      "delete_agent_message_history",
      "issue_agent_draft_preview_receipt",
      "acknowledge_agent_draft_preview_receipt",
      "consume_acknowledged_agent_draft_preview",
      "save_my_agent_binding_controls",
      "set_persona_backend",
      "save_account_ledger_entry",
    ]),
    visibilityKinds: Object.freeze(["block", "mute"]),
    postKinds: Object.freeze(["update", "media", "link"]),
    reactionKinds: Object.freeze(["like", "celebrate", "support", "insight"]),
    // Mirrors MyPersonas migration 080 (report_content); contracts/content-reports.md
    // is the versioned interface and a test keeps the two in step.
    reportTargetKinds: Object.freeze(["persona", "post", "comment"]),
    reportReasons: Object.freeze([
      "spam",
      "harassment",
      "hate",
      "sexual_content",
      "violence",
      "self_harm",
      "impersonation",
      "privacy",
      "intellectual_property",
      "illegal",
      "other",
    ]),
    reportDetailsMax: 2000,
    localImportTag: "aliaspaces-local-import",
  });

  const api = { CONTRACT };
  const root = typeof globalThis !== "undefined" ? globalThis : undefined;
  if (root) root.AliaSpacesLiveContract = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
