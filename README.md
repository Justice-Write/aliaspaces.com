# AliaSpaces

AliaSpaces is the first-party social product for presenting, discovering, and
interacting through owner-controlled personas. It is being separated from the
MyPersonas automation and owner-control plane.

## Current release state

**2 November reconciliation:** the release coordinator owns deployment of both
sites. This source combines the October 31 domain split with PR #6's local
Akasha features, preserving reflections, reversible library rules, recovery
exports and the no-hiding Website adapter. Website opens AliaSpaces and explicitly
links to MyPersonas management. Android source is now 0.5.1/code 9; no new APK
was built or installed. See [reconciliation receipt](docs/DOMAIN-RECONCILIATION-2026-11-02.md).

**Owner ruling, 2026-10-31:** `aliaspaces.com` is the social media site, and
`mypersonas.online` is reserved for managing the AI-assisted persona platform.

The Pages workflow publishes the live site on `aliaspaces.com` from a pinned
MyPersonas commit (`SOCIAL-SITE-SOURCE.json`), split by view. Owner-workspace
views open on mypersonas.online; persona pages, discovery and Persona view stay
on aliaspaces.com. See [docs/DOMAIN-SPLIT.md](docs/DOMAIN-SPLIT.md). Until that
change is merged and deployed, `main` still publishes the old redirect.

The old redirect lives in `front-door/` and is the rollback artifact
(`artifact: front-door`). It preserves the incoming path, query and hash. This
is not a claim that the independent social application is production-ready.

Independent social application work must remain non-deploying until its shared
contracts, opaque public media, signed-in mobile tests, and two-account privacy
matrix pass. See [PROJECT-BOUNDARY.md](PROJECT-BOUNDARY.md) and
[ROADMAP-PROGRESS-2026-09-24.md](ROADMAP-PROGRESS-2026-09-24.md).

The isolated local/demo social mobile prototype lives in
`apps/social-mobile/` and is not part of the Pages artifact. See
`docs/ROADMAP.md` and `AGENTS.md`.

## Akasha mobile prerelease — 29 October 2026

**Next candidate, 30 October:** 0.5.0-akasha/code 8 adds local reflection notes,
reversible library rules, lossless corrupt-storage recovery and Website owner
controls/routes preservation. Built and source-verified; its phone QA is queued,
so code 7 remains the installed release. See [current roadmap checkpoint](docs/ROADMAP-CHECKPOINT-2026-10-30.md).

**30 October:** Android 0.4.1-akasha/code 7 is installed and the physical
picker/save/restore gate passed. See [phone acceptance](docs/PHONE-ACCEPTANCE-2026-10-30.md).
Personal records/backups stay outside the APK; automatic session/history backup
and device transfer are excluded by the Android policy.

The Android candidate now includes Akasha's local inbox and account-history
file imports, native JSON backup dispatch, and the reviewed social-session
verification fixes. See [release evidence and remaining acceptance](docs/RELEASE-2026-10-29.md)
and [program versus personal data](docs/DATA-AND-PACKAGING.md).

Build on Windows with `pwsh -File apps/social-mobile/scripts/build-apk.ps1`.
This produces a local-demo-signed release APK and checks its payload against
source hashes. Provider history syncing and production moderation acceptance
remain separate roadmap work.
