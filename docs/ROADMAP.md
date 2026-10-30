# AliaSpaces roadmap

This repository is the AliaSpaces product home. `main` still publishes only
the four-file HTTPS front door that redirects `aliaspaces.com` to
`https://mypersonas.online`. Application work lives in separate directories
and is not part of that Pages artifact.

The combined MyPersonas/AliaSpaces historical roadmap remains in the
MyPersonas repository. This file records **verified work in this checkout**
and the next AliaSpaces-owned milestones.

## Verified in this checkout (2026-09-20)

### Front door (unchanged)

- [x] `index.html`, `404.html`, `CNAME`, and `.nojekyll` remain the public
      Pages allowlist. Path, query, and hash are preserved on redirect.
- [x] No analytics, cookies, forms, or application data on the public site.
- [x] This branch does not merge, deploy, publish to stores, change account
      permissions, or start paid services.

### Milestone 1 — isolated local social mobile surface

Status: **implemented and locally verified in this cloud checkout**. Existing
phone-test prototypes mentioned by the owner are **not present here** and are
not claimed.

- [x] Isolated app at `apps/social-mobile/`, separate from the front door.
- [x] Persistent local profiles, posts, reactions, reports, and blocks.
- [x] Symmetric block rules exclude hidden profiles, posts, reactions, and
      reports from every viewer query. Covered by `npm test`.
- [x] UI and docs label the prototype **local/demo**. No fake online users
      and no network success path (`connect-src 'none'`, no `fetch`).
- [x] Demo fixtures are explicit `source: fixture` records, separate from
      user-created records.
- [x] Export/import JSON for data preservation when Android signing differs.
- [x] Reproducible Android debug build via
      `apps/social-mobile/scripts/build-apk.sh`.

### Milestone 1.5 — live website APK

Status: **implemented in this checkout**.

- [x] Website mode opens `https://mypersonas.online/` with cookies, so
      sign-in and social data are the website’s Supabase project.
- [x] Automation studio, briefings, schedule, agent board, HQ, composer,
      provider setup, fan inbox, and business settings are hidden or
      redirected to Home in the website shell. Discovery stays social.
- [x] Local demo remains a separate tab and still says local/demo.
- [x] Chrome button is an explicit separate browser session. Google login
      inside WebView may fail; that is not treated as app sign-in success.

### Milestone 2 first slice — first-party social client

Status: **implemented in this checkout** as far as an agent can go without
owner-gated Auth dashboard, production SQL, or a real phone.

- [x] First-party client at `apps/social-mobile/live.html` over the public
      website project and publishable key. No service-role key.
- [x] Allowed social RPCs only: personas, posts, reactions, comments,
      account blocks/mutes, friendships. Automation RPCs are rejected.
- [x] Fail-closed adapters: unsigned writes do not run; "signed in" is
      claimed only after Auth returns a user id and access token.
- [x] `identity-projection` rows (`account_id`, `persona_id`, `handle`,
      `lifecycle_state`) from `my_personas`.
- [x] Client-side block/mute filter, as defense in depth. Server-side
      block projections were already live (see 2026-10-16 below).
- [x] Posts submitted through `save_persona_post` stay review-gated and
      are not described as auto-published.
- [x] Fixture transport for tests/smoke never writes to production.
- [x] Android **Social** tab, last-mode restore, https/aliaspaces deep
      links, offline banner, and load-error page.
- [x] Installable Android debug APK `0.3.0-social` (versionCode 3), same
      package `com.aliaspaces.social.local` and committed debug keystore.

Browser smoke verified in this cloud checkout (390×844 Chromium, not a
physical phone and not the owner's local phone-test builds):

- Local/demo banner is visible and states there are no online users.
- Two local profiles can post; a block hides the other author's post for
  both sides.
- Live website shell hides Matrix/studio and keeps Sign in.
- First-party Social tab fixture mode signs in, blocks, and review-gates
  a post without touching production.

## Next milestones (owner-gated or later product work)

1. **Milestone 2 remainder — production authorization and moderation**
   Concrete contract: [docs/MOBILE-MILESTONE-2.md](MOBILE-MILESTONE-2.md).
   Block projections are live. Reports are MyPersonas migration 080,
   written and tested but not applied; holds are the 081 draft. Next: the
   owner applies 080, then a staff queue surface.
2. **Public read-only persona page** consuming a versioned public projection
   with opaque media identifiers (from the extraction plan on
   `split/social-platform-20260824`). Putting that on `aliaspaces.com`
   would change the Pages allowlist and is owner-gated.
3. **Signed-in identity shell** with dashboard audience/origin redirects
   for magic-link and Google return URLs. Email/password already works
   in the first-party client; OAuth return URIs do not.
4. **PWA / origin identity** after staging gates, still without changing
   the live redirect until cutover is approved.

## Concrete blockers

- Shared Auth, entitlement, media, and moderation services are still owned
  by the MyPersonas production authority. This repo must consume versioned
  contracts, not copy privileged implementations.
- No production database, Edge Function, OAuth callback, DNS, or Pages
  allowlist change is authorized from this mobile milestone.
- Real-device Android/iOS install proof is owner-gated. This cloud checkout
  does not have the owner's existing phone prototypes.
- Store listings and submissions wait for a later owner pass. Both store
  accounts are recorded as verified; Google is personal; do not submit.
- Two-account privacy, MFA recovery, and live moderation staffing are
  milestone 2+ gates, not implied by the first-party client or local store.


## Design and phone checkpoint — 23 September 2026

Readable native Website/Social/Local mode controls, compact shared-account explanation and refined local/social styling. Actual live website remains its existing design.

Android debug build and automated checks passed; signature verified, installed in place and launched on Samsung SM-N986U1. This is not full workflow or store-release verification.

Remaining: Production authorization/moderation integration and two-account privacy, sign-in/MFA and real-device release verification.

Portfolio evidence: `mobile-publishing-2026-09-20/design-apks/phone-verification.json`, app build log, and `DESIGN-ROADMAP-STATUS.md`. Older environment limitations above are historical; the phone is now connected.

## Changelog

### 2026-10-16 — Milestone 2 server slices (branch `codex/aliaspaces-m2-reports-20261016`)

Verified in this checkout:

- Read-only readback of project `nwsqyuucwzihruszocge` (`pg_policies`,
  `pg_proc`). Symmetric server-side blocks are live; that is recorded in
  `contracts/visibility-projection.md`. No report objects exist on the
  server yet.
- Reports: two sessions built them in parallel. The owner chose the
  reviewed design, now MyPersonas migration 080 (`report_content`,
  `my_content_reports`, staff list and review). Holds are the 081 draft.
  The SQL, its verify snippet, and the PostgreSQL harness live in the
  MyPersonas ledger. This repository keeps the consumed interface,
  `contracts/content-reports.md`, checked by
  `tests/content-reports-contract.test.mjs`.
- An independent review of the first draft found eleven defects. All are
  fixed and covered. The worst were:
  - the hold predicate was callable through PostgREST;
  - muting a persona could confirm that it had blocked you;
  - held content could still be reported;
  - a null assignee unassigned the report.
  After the fixes, 29 of 30 targeted mutations are caught; the survivor
  is equivalent.
- Client on top of `main` b4ccde0: one report path, *My reports*,
  `reports-not-enabled` honesty, *also block*, contract refusal of staff
  RPCs, local-demo import as review-gated drafts, and `p_tags` sent as text.
- `npm test`: 36 of 38 pass. The other two are the live-network tests,
  which this sandbox cannot reach.
- The fixture browser smoke `scripts/report-import-smoke.mjs` passes.

Owner-gated:

- Apply 080 in the SQL Editor, then run the verify snippet.
- Adopt 081 with its seven RPC edits.
- Decide excerpt retention, rate limits, and persona-level moderation.
- Choose the staff surface and who staffs it.
