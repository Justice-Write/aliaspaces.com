# AliaSpaces roadmap progress — 2026-09-24

This is an evidence ledger, not a completion or release claim. Local, tested,
committed, pushed, deployed, and verified live remain separate.

## Current product boundary

AliaSpaces is the first-party social product: persona and business pages,
layouts and media presentation, discovery, feeds, posts, albums, reactions,
reports, follows/friendships, blocks/mutes, family/backups, projects, publication
review, and persona-perspective interaction.

MyPersonas remains the private control plane for provider credentials and
automation, AI routing, research/source libraries, billing internals, staff
operations, and the current production migration authority. Identity,
entitlements, media, provenance, moderation, and account lifecycle are shared
versioned contracts, not duplicated privileged code.

## Completed and pushed for review

Branch: `codex/aliaspaces-roadmap-progress-20260924`, based on current
`origin/main` (`07eabc124254a769c2ddd52d5fc1f613e30fab20`). Commit
`e5a0e02399465dc8a35b3c753af8c2ad66e63c3b` was pushed and opened as
[PR #2](https://github.com/castleism/aliaspaces.com/pull/2). At this checkpoint,
the PR was open and awaiting CI; it was not yet merged or deployed, and no
account, DNS, environment, or production-data setting was changed.

- Reconciled the README with the product split and the actual five-file public
  artifact while preserving the redirect/front-door behavior.
- Added `PROJECT-BOUNDARY.md` and this dated progress ledger.
- Pinned every Pages action to an immutable commit.
- Added a job-level main-ref guard so a workflow dispatch from another ref
  cannot deploy.
- Added a pull-request/main CI workflow and front-door regression tests.
- Added `CODEOWNERS` for the repository and public-release files.
- Made the deploy workflow run the same tests before packaging.

Validation on this branch:

- Front-door tests: **2/2 passed**.
- Workflow YAML parse: passed.
- The tests verify route/query/hash preservation, `noindex`, CSP/form blocking,
  lack of forms/analytics, immutable action pins, main-only deploy, and the exact
  five-file artifact boundary.

## Verified current release state

- `aliaspaces.com`, `www.aliaspaces.com`, and the favicon were verified live on
  2026-09-23 from `origin/main` commit `07eabc1`; Pages run `35924870221`
  succeeded.
- The live page is intentionally a transitional `noindex` front door that
  redirects to the combined application at `mypersonas.online` while preserving
  path, query, and hash.
- It has no analytics, cookies, forms, credentials, or application data.
- The canonical local checkout is one commit behind and contains an untracked
  August 31 roadmap. It was preserved rather than overwritten or committed as
  current truth.

## Application work that is not production-ready

- `split/social-platform-20260824` contains the boundary/extraction workbench
  and tested profile cropper, not a standalone social product.
- Draft PR #1 contains Website, Social, and Local/demo mobile surfaces plus a
  first-party social client. Fixture/browser tests and a debug build do not prove
  physical-device sign-in, MFA, or unrelated-account privacy.
- The newer `codex/mac-handoff-20260923` branch includes phone/API-36 changes not
  yet in PR #1 and currently has no matching CI run.
- The independent web repository does not yet contain the full persona page,
  family/backup graph, business roles, custom fields/widgets, publication
  review, friend-verification UI, or persona-perspective experience.

## Mobile merge blocker

The latest Android client globally installs the `AliaSpacesAndroid` JavaScript
bridge before loading remote Website/Social pages. Its WebView navigation allows
broad `*.supabase.co`, Google asset, CDN, and media hosts, while the bridge opens
native import/export document pickers and the chooser accepts `*/*`.

PR #1 and the newer mobile branch must not merge until:

1. The bridge exists only for the packaged Local/demo origin or a separate
   Local-only WebView and is absent from Website, Social, and remote frames.
2. Main-frame navigation uses exact product/auth hosts rather than suffix-wide
   Supabase/asset-host trust.
3. File chooser MIME types are narrowed by the active mode.
4. Tests reject attacker-controlled Supabase subdomains, arbitrary asset-host
   navigation, userinfo/scheme confusion, and bridge exposure in remote frames,
   while retaining Local JSON export/import.

UI hiding in the Website WebView is presentation, not an authorization boundary.

## Repository/security gates not yet configured

- GitHub reports `main` as unprotected.
- The `github-pages` environment is limited to main, but it has no required
  reviewer rule.
- The new `CODEOWNERS`, CI, action pins, and main-only guard are in PR #2 and do
  not protect or deploy `main` until that reviewed PR is merged.

## Remaining owner/external actions

1. Add branch protection requiring pull requests, passing CI, and CODEOWNER
   review; add a required reviewer to the `github-pages` environment.
2. Coordinate the Android bridge fix with the active mobile sprint, move the
   newer reviewed mobile commits into PR #1, and ensure CI covers that branch.
3. Provide two unrelated MFA-enabled staging accounts and physical iOS/Android
   devices for private/unlisted/public, block, friendship, cross-owner asset,
   recovery, session-revocation, and OAuth-return testing.
4. Release versioned opaque-media, identity, entitlement, and moderation
   contracts from the single MyPersonas migration authority to staging.
5. Add server-side symmetric block projections, content-report RPC, and a staff
   moderation queue before calling client filtering an authorization control.
6. Decide whether the public domain remains a redirect or cuts over to a full
   AliaSpaces home. DNS, Pages allowlist change, deployment, and store submission
   each require separate approval.
7. Approve exact persona fields, disclosures, media, destinations, visibility,
   and public associations before any profile republication.

## Recommended next sequence after those gates

1. Merge only the front-door security hardening after review; verify the live
   five-file artifact remains unchanged in behavior.
2. Fix the remote WebView bridge and extend mobile security tests before PR #1.
3. Stand up an independent staging origin against versioned shared contracts.
4. Implement a read-only public persona shell using opaque media identifiers.
5. Add the signed-in social graph, moderation, page editor, and publication
   review incrementally, keeping automation and billing out of this repository.
6. Complete physical-device and two-account evidence before any domain cutover.
