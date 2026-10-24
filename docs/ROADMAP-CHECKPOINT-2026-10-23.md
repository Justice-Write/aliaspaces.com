# AliaSpaces roadmap checkpoint — October 23, 2026 (Alaska)

## Evidence and scope correction

Source baseline: main commit `b4ccde00aeb00e2722d7f42bd1bc73d2fa504ace`.
Read AGENTS.md, PROJECT-BOUNDARY.md, both roadmap files, the mobile contract,
client, and tests. The September delegation packet is historical planning.
The repository boundary defines AliaSpaces as social presentation/client and
MyPersonas as automation, AI routing, billing, and migration authority.
Soulular (`Soul-Concept`) and the consent/provenance engine
(`soul-concept-engine`) are distinct repositories/products.

## Work completed

Fixed cached-session trust in apps/social-mobile/src/live/social-client.js.
Previously status() accepted a stored token and user id as signed in before
verifySession() contacted Auth. It now hides identity and blocks session-only
operations until verification. Successful password/signup Auth responses mark
the session verified; failed verification clears it. A stale verification
response cannot overwrite a signed-out or replaced session.

This is client state hardening, not a claim of a server authorization bypass.
Server-side authorization remains required. The existing behavior of clearing
saved tokens after verification failures is retained; token refresh and MFA
completion are separate follow-up work.

## Verification performed

- npm test: 31/31 pass, zero skipped, including two existing read-only network checks.
- Boundary check: passes for 26 mobile source files.
- New regressions: restored credentials cannot write or expose authenticated
  identity before Auth; rejected credentials clear storage; delayed verification
  cannot undo sign-out.
- Official Supabase getUser guidance reviewed: verify identity against Auth
  rather than trusting an embedded stored user object.
- No production writes, database migrations, public-site changes, APK build,
  phone installation, or signed-in two-account checks were performed.

## Next milestones in order

| Order | Action | Owner | Acceptance evidence | Status |
|---|---|---|---|---|
| 1 | Review and integrate this session fix | Code reviewer | Diff and green tests | Ready for review |
| 2 | Verify migration 080 and moderation workflow in the authoritative MyPersonas branch/environment | MyPersonas authority | Migration record; authorized report reaches staff queue; unrelated users cannot inspect it | Unverified here |
| 3 | Run two unrelated-account tests after MFA in staging | Justice + tester | Each account sees only authorized records; blocking works both ways; reports respect visibility | Pending test accounts/device session |
| 4 | Build candidate APK and test on a real phone | Build/release owner | Version and signer; install/launch; re-open session; sign-out; network failure | Pending integration |
| 5 | Deliver public persona page against the approved opaque-media projection | Client developer | Confirmed contract; loading/not-found/private cases; no raw private paths | Pending contract verification |
| 6 | Decide full homepage/PWA cutover | Justice | Approved content, routing, rollback, and privacy acceptance | Owner decision |

Keep the live transition page as rollback. Migration status in the old roadmap
is a historical claim until checked in the authoritative environment. The
previous `push main` blocker is stale as a blanket statement: the October 16
commits are already visible on GitHub main. No claim is made about any newer
unpushed local work on Justice's computer.
