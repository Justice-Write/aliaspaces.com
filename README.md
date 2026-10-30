# AliaSpaces

AliaSpaces is the first-party social product for presenting, discovering, and
interacting through owner-controlled personas. It is being separated from the
MyPersonas automation and owner-control plane.

## Current release state

The public GitHub Pages artifact on `main` is still a rollback-safe transition
front door. It gives `aliaspaces.com` and `www.aliaspaces.com` a valid HTTPS
endpoint while the transitional combined application remains at
`https://mypersonas.online`. This is not a claim that the independent social
application is production-ready.

`index.html` and `404.html` preserve the incoming path, query, and hash when
redirecting. `favicon.svg` carries the same purple AliaSpaces mark used on the
front door. No analytics, cookies, forms, credentials, or private application
data are present here. The Pages workflow publishes only the five explicit
public files.

Independent social application work must remain non-deploying until its shared
contracts, opaque public media, signed-in mobile tests, and two-account privacy
matrix pass. See [PROJECT-BOUNDARY.md](PROJECT-BOUNDARY.md) and
[ROADMAP-PROGRESS-2026-09-24.md](ROADMAP-PROGRESS-2026-09-24.md).

The isolated local/demo social mobile prototype lives in
`apps/social-mobile/` and is not part of the Pages artifact. See
`docs/ROADMAP.md` and `AGENTS.md`.

## Akasha mobile prerelease — 29 October 2026

The Android candidate now includes Akasha's local inbox and account-history
file imports, native JSON backup dispatch, and the reviewed social-session
verification fixes. See [release evidence and remaining acceptance](docs/RELEASE-2026-10-29.md)
and [program versus personal data](docs/DATA-AND-PACKAGING.md).

Build on Windows with `pwsh -File apps/social-mobile/scripts/build-apk.ps1`.
This produces a local-demo-signed release APK and checks its payload against
source hashes. Provider history syncing and production moderation acceptance
remain separate roadmap work.
