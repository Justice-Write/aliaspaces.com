# AliaSpaces mobile app

The package has three distinct modes, separate from the five-file Pages redirect:

1. **Website** opens the existing MyPersonas owner command center at
   `https://mypersonas.online/#/owner`. Persona switching, research briefs,
   four-channel drafts, approvals, inbox and other owner controls are not hidden
   by this adapter. Website authentication and permissions remain authoritative.
2. **Social** is the first-party social client. It uses only its narrow public
   contract, verifies sessions before private access, and review-gates posts.
3. **Local demo** keeps profiles/social examples and Akasha on the device.
   Akasha supports explicit history-file imports, reflections and reversible
   library view rules. It does not connect a provider or alter an external feed.

Google may require the **Chrome** button; Chrome has a separate session. Preserving
owner controls is source/fixture-tested, not proof of signed-in MFA, two-account
privacy or full owner-workflow acceptance. No privileged website code is copied
into this repository. Moderation deployment still belongs to MyPersonas.

## Data and backup

Account history, original rows, reviews, reflection notes, view preferences,
sessions and backups are personal data, not install assets. JSON backup includes
all saved records, even those hidden by view rules. Existing records/edits win on
merge. Old version-1 backups remain compatible. Corrupt storage is paused and can
be exported losslessly in a recovery envelope; it is not a normal import backup.
Automatic OS backup/device transfer is excluded. See `docs/DATA-AND-PACKAGING.md`.

## Verify

Run `npm test`. Browser smokes use an installed Playwright runtime; optional
`PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` select existing tools:

- `scripts/pantry-smoke.mjs` and `scripts/account-history-smoke.mjs`
- `scripts/akasha-reflection-smoke.mjs`
- `scripts/live-site-smoke.mjs` (synthetic owner-interface fixture)

## Build

Windows: `pwsh -File apps/social-mobile/scripts/build-apk.ps1` from repo root.
Linux/macOS: `bash apps/social-mobile/scripts/build-apk.sh` with JDK 17+, SDK
platform 36/build-tools 36.0.0 and the committed wrapper/signing key already present.
The Bash helper no longer installs SDKs, writes license acceptances, downloads
wrapper code or silently creates a new signing identity. Linux runtime build is
unverified in this Windows session.

Release APKs go to `dist/AliaSpaces-<version>-local-signed.apk`. Before publication,
run `scripts/verify-apk.ps1`: web/native asset hashes and allowlists must pass.
The `.acceptance` build is separately labeled **AliaSpaces QA (synthetic)** and is
not a release asset. Same-key `adb install -r` preserves the owner installation;
never uninstall/clear it to bypass a signer conflict. Store submission remains gated.
