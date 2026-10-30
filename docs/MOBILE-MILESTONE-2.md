# Milestone 2 — authenticated multi-user storage, authorization, and moderation

Milestone 1 is a **local/demo** device store. Milestone 1.5 is the live
website WebView. This document is the authenticated first-party client
and the remaining server work.

## Goal

Replace the device-only store with owner-authenticated, server-authorized
social records while keeping AliaSpaces inside its product boundary.

## In scope

1. **Identity**
   - Sign in through the shared Auth authority already used by MyPersonas.
   - Map one account to one or more personas through the versioned
     `identity-projection` contract (`account_id`, `persona_id`, `handle`,
     `lifecycle_state`).
   - Keep authentication/MFA configuration under one authority. Add explicit
     audience and origin checks for the AliaSpaces app id.
2. **Authorized storage**
   - Persist profiles, posts, reactions, reports, and blocks in the shared
     database under row-level security.
   - Every write is owner-scoped and fail-closed. The mobile client never
     sees a service-role key.
   - Symmetric blocks remain a server rule, not only a client filter.
3. **Moderation**
   - User reports create server records with reporter, target, reason, and
     a staff-visible state (`open`, `needs_review`, `resolved`).
   - A review queue is a separate authorized surface. Local milestone 1
     reports are not that queue.
   - Hidden-by-block and hidden-by-moderation are distinct states.
4. **Client honesty**
   - The app may say "signed in" only after a verified session.
   - Offline cache, if added, must still label unsynced local drafts.
   - Import of milestone 1 JSON is an explicit owner migration, not a silent
     network publish.

## Done in this checkout (client slice)

- First-party client (`apps/social-mobile/src/live/social-client.js`) over
  the public project `nwsqyuucwzihruszocge` and publishable key.
- Email/password Auth, `my_personas` identity projection, public handle
  lookup, owner posts, reactions, comments, and
  `set_persona_visibility_rule` for account-wide block/mute.
- Fail-closed unsigned writes. Automation RPCs rejected.
- `save_persona_post` labeled review-gated, not auto-published.
- Android Social tab, last mode, deep links, offline/error chrome.
- Tests use a fixture transport. No production writes from CI.

## Still owner-gated

- Dashboard Auth redirect URIs / audience for magic-link and Google so
  those methods can return into the app origin.
- Applying MyPersonas migration 080 (reports and staff queue) in the SQL
  Editor, then `supabase/snippets/verify_080_content_reports.sql`.
- Adopting the 081 holds draft. The ledger owner must first add the hold
  filter to seven SECURITY DEFINER social RPCs; the draft refuses to apply
  until they do.
- A staff surface for the report queue, plus who staffs it.
- Real-phone MFA, two-account privacy, store builds, and merge/deploy.

## Out of scope

- Store submission or production DNS/Pages cutover.
- Copying automation, billing, provider credentials, or AI routing.
- Auto-publishing native posts without the existing review/publish gates.
- Claiming the owner's existing phone-test prototypes as evidence.

## Acceptance checks

- Two unrelated accounts cannot read each other's private personas.
- A block created by either side hides posts, reactions, and profile
  projections for both sides on a fresh session.
- A report is visible to staff through an authorized queue and is not
  writable by the reported party.
- Revoking a session or entitlement unpublishes or hides exactly as the
  shared contract specifies.
- No milestone 1 "local demo" banner remains on a signed-in production
  build; a staging build may keep a staging banner.

The first two signed-in checks need an owner phone or staging accounts.
The client already fails closed without a session and hides blocked
fixture posts.

## Remaining slices — status 2026-10-16

1. Owner adds Auth redirect URIs for the app / Custom Tabs origin.
   **Owner-gated.**
2. Server-side block projections. **Already live.** `persona_visible` and
   `persona_mode_can_view` enforce symmetric blocks on every social read.
   No migration is needed. See `contracts/visibility-projection.md`.
3. Report RPC and staff queue read model. **Written and tested, not
   applied.** MyPersonas migration 080 covers reports, reporter RPCs, the
   staff queue and transitions. The 081 draft covers moderation holds and
   per-viewer state. The client calls `report_content` and
   `my_content_reports`, and says reporting is not enabled until 080 is
   applied. Interface: `contracts/content-reports.md`.
4. Import of a milestone 1 export. **Done in the client.**
   `planLocalDemoImport` and `importLocalDemoDrafts` map chosen local
   profiles onto owned personas as review-gated drafts. Fixtures,
   reactions, reports and blocks are never imported.

## Owner gates

Production migrations, function deploys, provider credentials, and store
builds remain owner-confirmed. Agents may prepare code, tests, and staging
artifacts only.

## Changelog

### 2026-10-16 — Milestone 2 server slices

- Correction: server-side block projections were already in production. A
  read-only `pg_policies`/`pg_proc` readback confirmed it.
- Two sessions built reports in parallel. The owner chose the reviewed
  design and merged it into MyPersonas migration 080, keeping the RPC name
  `report_content`; holds are the 081 draft. The SQL and its PostgreSQL
  harness live in the MyPersonas ledger. This repository keeps the
  consumed interface, `contracts/content-reports.md`.
- Client: one report path (inline *Report* on others' posts and personas,
  with *also block*), *My reports*, an honest `reports-not-enabled` state,
  refusal of staff RPCs, and local-demo import as review-gated drafts.
- Fix: `savePost` sent `p_tags` as a JSON array, but `save_persona_post`
  takes text, so posts would have stored the literal `[]`. It now sends a
  comma-separated string.
