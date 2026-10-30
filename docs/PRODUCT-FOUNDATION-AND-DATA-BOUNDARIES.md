# Product foundation and data boundaries

Reconciled 2026-10-29 (America/Anchorage). This document describes product responsibilities and release acceptance; it does not certify an authenticated production session, installed upgrade, or completed roadmap.

## Start from the existing owner experience

The owner's reference is the existing MyPersonas mobile owner command center, not a replacement offline social demo. Preserve the user journey across persona selection, personality and context controls, owner chat, research briefs and annotations, four-channel draft review, scheduling, fan inbox and live takeover, account portals, notifications, and the persona companion.

That experience does not require moving provider secrets or duplicating backend ownership. `PROJECT-BOUNDARY.md` keeps privileged operations in MyPersonas and the social presentation in AliaSpaces. An integrated journey and separate deployment authorities are compatible. Do not silently equate a social-only shell with owner-command-center parity.

| Component | Responsibility | Completion boundary |
| --- | --- | --- |
| MyPersonas web and owner Android app | Owner command center, provider credentials and automation, research, model routing, shared identity, production migrations | Its own signed-in acceptance and release evidence are required |
| AliaSpaces mobile | First-party social presentation; Website, Social and Local modes | Website mode currently filters owner tools; Local is a device-only demo |
| Akasha / Akashic records | Local content collection, review, account-history file imports | File import is not connected-account sync; real provider export and native file-picker acceptance remain distinct |
| Personas / legacy Personas desktop | Earlier desktop character and browser surfaces | Related source/history, not proof of current desktop feature parity |
| Soulular / Soul Concept family | Desktop creative workspace and personal media/model libraries | Separately versioned and installed; do not bundle or reinstall it as an AliaSpaces dependency |
| Shared backend | Account/persona identity, scoped social operations, media, moderation contracts | MyPersonas remains the single production migration authority |

The rest of the creator portfolio consists of potential consumers or brands. Association does not make their repositories, private material, or deployments part of an AliaSpaces package.

## What belongs in an installation package

| Category | Package treatment | Preservation requirement |
| --- | --- | --- |
| Application code, compiled native shell, CSS, icons and approved first-run guide | Include through an explicit allowlist | Record source revision, artifact hash, version and signing identity |
| Public service URL and publishable client key | May be included in the reviewed client | Enforce authorization on the server; public keys are not authorization |
| Synthetic test fixtures | Keep in tests, outside the production payload | Label as fixtures; do not import automatically as user records |
| Akasha imports, raw history rows, account labels, reviews, tags and backups | User data, never bundled | Explicit local export/restore; preserve source timestamps and unknowns |
| Local-demo personas, posts, reactions, reports and blocks | User data, never bundled | Retain app storage during same-package upgrades; export before incompatible migration |
| Live persona records, drafts, fan conversations and research | Authenticated account data, never bundled | Keep owner scoping, consent, retention and deletion contracts |
| Cookies, access/refresh tokens, browser partitions and authentication state | Private session state, never bundled or included in ordinary content exports | Require fresh verification; define OS backup/device-transfer exclusions |
| Personal photos, videos, likeness references, training data and consent records | Separate owner library | Preserve originals and provenance; installation is not consent to upload or train |
| Model weights, checkpoints and downloaded runtimes | Separately managed dependencies, not personal-media content | Preserve license, identity, version and location bindings; avoid copying the model archive into every app |
| Environment files, service-role credentials and production signing keys | Never distribute | Store separately with restricted access; the repository's development key is not a production release identity |
| Handoffs, local inventories, transcripts, screenshots and backups | Private engineering/owner evidence | Keep outside public source and artifacts; use sanitized release notes |

Current local storage contracts include `aliaspaces.social.local.v1` (demo), `aliaspaces.social.live.session.v1` (Social authentication state), and `aliaspaces.pantry.local.v1` (Akasha, retained for compatibility). These are separate data sets despite sharing an application shell. Website cookies belong to the website origin.

An application install directory is not necessarily code-only: older desktop products can store reference media under an engine/library subdirectory. Inspect the actual file inventory before packaging, moving or deleting any such directory. Folder names alone do not establish disposability.

## Acceptance before calling a release complete

1. **Source reconciliation:** account for the canonical dirty tree, open PRs and active release worktree. Review differences before integrating; no reset, blanket staging or competing writers.
2. **Owner journey:** verify the listed owner-command-center functions through the appropriate owner surface. Record deliberate social-only exclusions separately. Never mark this complete because the social shell hides those controls successfully.
3. **Package boundary:** compare every bundled web asset with the explicit source allowlist and SHA-256; reject development evidence, exports, credentials, fixtures and unexpected assets. Verify native version, package ID and signature too.
4. **Data preservation:** keep package/signing identity compatible; use update installation, not uninstall/reinstall. Verify local demo and Akasha records, reviews and website state after restart. A different signer with the same package ID is an update error, not an automatic side-by-side installation.
5. **Backup policy:** audit Android backup/device-transfer behavior separately from APK contents. The inspected manifest allows backup without explicit extraction rules, while the Social client stores session material in WebView storage. This is an unresolved release/privacy check; APK payload verification does not establish safe backup behavior.
6. **Real authentication:** prove email and Google return paths, MFA, session expiry/sign-out and re-verification on the physical device. Browser sign-in alone is not an app session. The owner requires phone sign-in before merge.
7. **Two-account isolation:** test private personas, drafts, blocks in both directions, feeds/profile projections, reactions, reports and staff permissions. Fixture success is necessary but not live isolation proof.
8. **Moderation/media:** verify deployed contracts against the migration ledger and scoped test evidence. Confirm safe public media projections before persona publication. Do not duplicate production SQL based on stale roadmap claims.
9. **Release and installation:** distinguish committed, pushed, merged, deployed, packaged, installed, launched and manually accepted. Record a separate receipt for each. Store submission requires its own production signing, listing and account checks.

## Roadmap order

- Reconcile the session-verification fix and Akasha native export/import release with clean tests and package evidence.
- Complete physical-phone update, native export/restore and restart checks; then authenticated/MFA/two-account acceptance.
- Close moderation, session and backup-policy gaps under the correct deployment authority.
- Validate owner-command-center access and workflow parity across the owner app and social app; document remaining native browser-isolation and notification work.
- Add eligible account-history transfers only with dedicated consent, supported provider interfaces and owner-scoped jobs. Existing publishing authorization is not viewing-history consent.
- Advance public persona pages, origin/PWA cutover and iOS only after their prerequisite evidence and explicit product decisions. Preserve the front door as rollback until cutover is accepted.

## For the next model

Read the root `status-handoff.md` first and claim work before edits. It remains local-only for this public Pages repository. Check other active tasks and the current release branch; do not duplicate their package or deployment work. Public docs contain the reusable product contract; machine paths, account records, inventories and task-history coverage belong in the private handoff/evidence.

The five-file Pages artifact (`index.html`, `404.html`, `favicon.svg`, `CNAME`, `.nojekyll`) is a redirect front door. Merging documentation or mobile code does not publish Akasha as a web app, and a successful Pages job does not install a phone package.
