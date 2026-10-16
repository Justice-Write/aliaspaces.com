# Mobile evidence (2026-09-20)

Owner phone-test prototypes are not in this checkout and are not claimed.

## Unit and boundary

```bash
npm test
```

Covers local block exclusion, local/demo honesty, live host allowlist,
automation-route redirects, first-party fail-closed client, Android
Website/Social/Local wiring, deep links, and Pages boundary.

## Local demo smoke

`node apps/social-mobile/scripts/browser-smoke.mjs`

- Local/demo banner
- Two device profiles, posts, symmetric block

## Live website smoke

`node apps/social-mobile/scripts/live-site-smoke.mjs`

- `https://mypersonas.online/` returns AliaSpaces
- Injected social shell hides Matrix/studio and redirects `#/studio`
- Sign-in control remains
- Screenshots: `aliaspaces-live-website-before-shell.png`,
  `aliaspaces-live-website-social-shell.png`

This proves the live site is reachable and the app shell can hide
automation. It is not a signed-in real-phone session.

## First-party social client smoke

`node apps/social-mobile/scripts/live-client-smoke.mjs`

- `live.html?demo=1` uses the fixture transport, not production
- Signed-in is claimed only after fixture Auth succeeds
- Block hides the other fixture author's post
- `save_persona_post` is labeled review-gated / not auto-published
- Screenshots: `aliaspaces-social-client-signed-out.png`,
  `aliaspaces-social-client-after-block.png`,
  `aliaspaces-social-client-review-gated.png`

Read-only live check (no writes): anonymous `my_personas` is HTTP 401.

## Android debug package

`apps/social-mobile/scripts/build-apk.sh`

| Field | Value |
| --- | --- |
| Application id | `com.aliaspaces.social.local` |
| Label | AliaSpaces |
| Version | `0.3.1-social` (versionCode 4; was 0.3.0-social / 3) |
| Default mode | Website `https://mypersonas.online/` |
| Other modes | First-party Social, Local demo |
| Internet permission | required for Website/Social |
| Signing | committed `android/debug.keystore` |

Install with the same key (`adb install -r`) to keep local demo data and
website cookies. A differently signed APK installs beside this one.

## Not verified here

- Physical device Google OAuth, TOTP/MFA, or two-account privacy
- Store listing or submission
- Production content-report RPC or staff queue
- Server-side block projections (client filter only)

## Phone install (2026-10-16)

Built on Windows from `main` f1ebc43 with `:app:testDebugUnitTest :app:assembleDebug`
(BUILD SUCCESSFUL), then installed over USB with `adb install -r` on device
R3CR20S9GZM. Script, transcript and summary: `_ops/release-2026-10-16/` in the
parent GitHub folder.

| Check | Result |
| --- | --- |
| Signer SHA-256 | `3679276f…d855`, same as the installed package, so data is kept |
| Badging | `com.aliaspaces.social.local` code 4, `0.3.1-social`, target 36 |
| APK SHA-256 | `59c6f9943a3b47b4977835afc565034182dc561b3203d61b540f5877060af760` |
| Install | `Success` |
| Launch | Process running (pid 24117); crash buffer empty for the package |
| Screen | First-run guide "A place for your different spaces", 1 of 4 |

The device already reported code 4 before this install: another session
installed the same build minutes earlier. The guide appearing is expected:
`AppGuide` shows it only while the persisted `portfolio_app_guide_v1/completed`
flag is false, and `install -r` keeps SharedPreferences. It had never been
completed on this phone. It does not mean data was reset. Still not
verified: signed-in MFA and two-account privacy.

