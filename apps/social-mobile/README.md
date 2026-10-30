# AliaSpaces mobile app

Isolated from the `aliaspaces.com` GitHub Pages front door. The Android
package has three modes:

1. **Website (APK default)** — the real site at `https://mypersonas.online/`,
   same accounts and database. Automation studio, agent board, provider
   setup, fan inbox, business settings, and scheduled publishing controls
   are hidden in the app.
2. **Social** — first-party client (`live.html`) over the same public
   Auth/database. Email/password sign-in, owned personas, public handle
   lookup, review-gated posts, reactions, and account blocks. Automation
   RPCs are rejected. "Signed in" only after Auth verifies a session.
3. **Local demo** — device-only profiles/posts/reactions/reports/blocks.
   This mode still says local/demo and does not talk to the website.

## Website mode — what is real

- Sign in with the same AliaSpaces / MyPersonas account used on the website
  (email, password, magic link). Google may be blocked inside the WebView;
  use **Chrome** in the app bar if that happens. Chrome is a separate browser
  session, not a silent success inside the app.
- Persona discovery, pages, owner home, publication review, follows/friends,
  posts, albums, and other website social surfaces run in the live site.
- Cookies persist in the app WebView for that website origin.

## Social mode — what is real

- Same public Supabase project the website already publishes.
- Fail-closed owner RPCs: `my_personas`, `save_persona_post`,
  `delete_persona_post`, `toggle_persona_reaction`,
  `set_persona_visibility_rule`, friendships.
- Posts submitted here still need the website review/publish gates.
- Blocks are enforced by the server in both directions (`persona_visible`,
  see `contracts/visibility-projection.md`). The client filter only covers
  the moment right after a new block.
- **Report** on someone else's post or persona (with an optional *also
  block*), and **Safety → My reports**, call `report_content` and
  `my_content_reports` (contract: `contracts/content-reports.md`). They come
  from MyPersonas migration 080, which is not applied yet. Until it is, the
  app says *No report was sent*. It never claims a report was filed.
- **You → Bring in local-demo posts** turns a Local demo export into
  review-gated drafts on personas you pick. Fixture records, reactions,
  reports and blocks stay on the device.
- Deep links: `https://mypersonas.online/…` opens Website mode;
  `aliaspaces://social` and `aliaspaces://local` open those tabs.
- Last mode is restored. Offline shows an error, not a fake session.

## What this is not

- Not a copy of the fused website into this repository.
- Not the automation platform.
- Not a staff moderation queue. Staff RPCs are refused in this client by
  contract; the queue needs its own authorized surface.
- Not a deployer of SQL. Report and moderation SQL lives in the MyPersonas
  migration ledger (080 and the 081 holds draft).
- No production secrets. The app uses the public publishable key.

## Local demo

Open `apps/social-mobile/index.html` or tap **Local** in the APK. Create two
local profiles, post, then block. Hidden content must disappear both ways.
Export/import JSON if a differently signed APK is installed beside this one.

## Tests

```bash
npm test
```

First-party fixture smoke (no production writes):

```bash
node apps/social-mobile/scripts/live-client-smoke.mjs
node apps/social-mobile/scripts/report-import-smoke.mjs
```

The report SQL is tested in the MyPersonas repository:
`npm run test:content-reports-sql` (Windows, Docker) or
`scripts/test-content-reports-sql.sh` (Linux, PostgreSQL 16).

## Android debug package

Package id `com.aliaspaces.social.local` (same-key updates keep local demo
storage and live-site cookies). Version `0.3.0-social`.

```bash
apps/social-mobile/scripts/build-apk.sh
```

Writes `apps/social-mobile/dist/AliaSpaces-local-demo-debug.apk` and a copy
under `/opt/cursor/artifacts/` when present.

Store submission is owner-gated. Google Play is personal; submissions later.
