# AliaSpaces website roadmap

Last reconciled: 2026-10-16 AKDT

## Current state

- `aliaspaces.com` is live as a transition page.
- `mypersonas.online` is the live persona-platform destination, but all 27
  database records currently marked for public visibility are nevertheless in
  an unpublished publication state. The September 27 read-only review snapshot contains 25 destination-link entries across the roster; these are not proof of approved provider account bindings.
- AliaSpaces and MyPersonas have special rows in the Accounts workbook. Their
  exact canonical public account set still needs a current readback and owner
  verification.

## September 27 local execution

The source checkpoint and mobile API 36 handoff are reconciled on codex/aliaspaces-roadmap-20260927. The Android bridge now uses exact-origin, main-frame WebMessageListener isolation, strict navigation policy and bounded mode-specific file handling. The front-door five-file boundary remains enforced. See docs/ANDROID-SECURITY-2026-09-27.md.

Validation: 23 Node tests and three JVM tests pass; the debug APK builds and its signing certificate matches the read-only installed package. No installation, launch, push, deployment or domain change occurred. New-binary physical-device/MFA and unrelated-account acceptance remain unverified.

The September 30 transition review was performed early against the current product boundary. A redirect still accurately routes to the shared transitional platform; a full social homepage needs finished AliaSpaces product content and an approved cutover. No public product/update copy was invented or released. Current republication preparation is complete as a private, hash-bound 27-profile review batch in the MyPersonas ignored output directory. Exact owner decisions remain pending.

## Dated plan

- **2026-09-02:** prepare the exact profile-by-profile republication brief.
- **2026-09-04:** confirm AliaSpaces/MyPersonas platform accounts, source owner,
  transition copy, and destination links.
- **2026-09-11:** audit the first owner-approved profile/link batch, if one was
  authorized; otherwise record the next approval date.
- **2026-09-30:** review whether the transition page still reflects the current
  platform roadmap and whether a dated product/update entry is warranted.

Profile publication and account linking require approval of the exact
destination, copy, media, placement, visibility, disclosures, and time zone.
No transition or provider action is authorized by this roadmap.

## Changelog

### 2026-10-16 — merge to main

- `codex/aliaspaces-roadmap-20260927` fast-forwarded into `main` (16 commits:
  mobile Milestone 1–2, API 36 handoff, Android bridge isolation, roadmap
  reconciliation).
- Line endings normalized to LF with `.gitattributes`. The Pages artifact
  (`index.html`, `404.html`, `favicon.svg`, `CNAME`) and `pages.yml` are
  byte-identical to the previous `main`, so the redeploy produces the same
  live front door.
- CI now runs `npm test` (front door, mobile, boundary check) on every branch.
- Tests: 21/23 offline pass plus the boundary check. The 2 network tests were
  re-run live from a browser: `mypersonas.online` still serves AliaSpaces
  sign-in and discovery; the public personas query returns 200 with zero
  published rows; unsigned `my_personas` returns 401.
- Surface verdicts (by `PROJECT-BOUNDARY.md`, not deferred work):
  - **Desktop program / agents:** not applicable. Automation, task runners and
    provider workers belong to MyPersonas.
  - **Desktop and mobile website:** the live app is `mypersonas.online`, which
    is in the MyPersonas repo. This repo ships only the redirect front door.
  - **Docker / virtual appliance:** not applicable. The front door is five
    static files, and the backend is hosted Supabase under the MyPersonas
    migration authority. A self-host appliance would need that backend, which
    AliaSpaces does not own.
  - **PWA:** still depends on the redirect-vs-full-home decision below.
- Android 0.3.1-social (code 4) built, unit-tested, signer-verified and installed
  with `install -r` on the phone; it launches without a crash.
- Content reports: the live client now has `reportContent()` and a Report
  control on others' posts, mapped to MyPersonas migration 080 (`report_content`).
  Until 080 is applied, the app says "Reporting is not enabled on the server
  yet". Staff queue RPCs are forbidden in this client. Android 0.3.2-social (code 5).
- Correction: server-side symmetric blocking was already live (MyPersonas
  migration 051 `persona_visible` / `can_request`). The "client filter only"
  note in ROADMAP-PROGRESS-2026-09-24 is stale.

### 2026-09-26 — roadmap sweep

- Front-door tests re-run: 2/2 pass. No code changes were needed.
- Correction: commit `401480c` ("make the public site installable on a
  phone") only added this roadmap file. `main` has no manifest or service
  worker, and `https://aliaspaces.com/manifest.webmanifest` returns 404.
- PWA work is intentionally not done here. The live page is a `noindex`
  redirect to `mypersonas.online`, its CSP is `default-src 'none'` (which
  also blocks a manifest), and the Pages artifact is a tested five-file
  boundary. An installed app would only redirect. The installable app
  belongs on `mypersonas.online`.

## Blocked (owner input needed)

| Item | What's needed |
| --- | --- |
| Republication decisions | Private current brief prepared; owner must review exact fields, canon, disclosures, media, destinations and visibility |
| 2026-09-04 account confirmation | Readback of the Accounts workbook and owner verification |
| 2026-09-11 first profile batch audit | An owner-approved batch to audit |
| Transition-page cutover | Local review completed September 27; full homepage content and owner cutover decision remain |
| Redirect vs. full AliaSpaces home | Owner decision; DNS, Pages allowlist, and deploy each need approval |
| PWA / installable site | Depends on the decision above; needs a CSP and artifact-boundary change |
| Branch protection and Pages reviewer | Owner to change GitHub repository settings |
| Android bridge release acceptance | Code 4 installed and launching on the phone (2026-10-16, see `apps/social-mobile/EVIDENCE.md`); two unrelated signed-in MFA accounts still needed for the privacy matrix |
| Apply MyPersonas migration 080 | SQL Editor, then `supabase/snippets/verify_080_content_reports.sql` (MyPersonas branch `claude/content-reports-20261016`) |
| Push `main` to GitHub | Credential needs the `workflow` scope (`ci.yml` changed); then run `_ops/release-2026-10-16/push.cmd` |

