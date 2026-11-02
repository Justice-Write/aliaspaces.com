# Akasha: local Akashic records

Implemented against canonical `aliaspaces.com` commit `b4ccde0`, in an isolated workspace snapshot. The patch was subsequently integrated into the canonical checkout with scoped write approval. Existing dirty agent instructions are preserved.

Serve `apps/social-mobile` using a local HTTP server, open `index.html`, and follow **Akasha: your Akashic records** (or open `akasha.html`). ES modules require an HTTP origin. No build or package install is needed.

Choose standard or custom categories. Paste one title, note, or URL per line and select its day. Every nonblank line becomes a separate pending item, including duplicates and content without suggested tags. Keyword suggestions use selected standard categories or literal custom-category matches. They do not inspect linked pages or videos. Edit any comma-separated tags, save to your Akashic records, reject, or return an item to pending. The daily inbox includes all statuses; use collection, day, and text/tag search filters. Rejected content stays stored. Category changes affect future suggestions only.

Storage follows the local demo's device-local JSON pattern with a separate versioned key (`aliaspaces.pantry.local.v1`), without changing existing social storage. JSON export and import merge preserve existing items by ID; existing IDs win. No fixture history is preloaded. Data is shared by people using the same browser profile; this slice has no account-level isolation or cloud backup. Export before clearing browser storage. Failed persistence does not silently update the displayed state, unreadable existing storage pauses mutations, and detected changes from another tab block stale saves pending reload.

## Verification

- `node --test apps/social-mobile/tests/pantry.test.mjs`
- `node apps/social-mobile/scripts/pantry-smoke.mjs` with installed Playwright. Optional `PLAYWRIGHT_MODULE` is an absolute module entry and `CHROMIUM_PATH` selects an existing browser executable.
- `npm test` runs all Node tests; two existing tests require live network access.
- `node scripts/check-boundaries.mjs`
- JavaScript syntax checks: `node --check` for both `src/domain/pantry.js` and `src/ui/pantry.js`.

The Android asset task includes the page in local mode only. The 29 October
candidate adds Akasha JSON/TXT/ZIP picker permissions and native JSON backup-save
dispatch restricted to the exact local Akasha page. Android navigation tests and
the release build pass. Code 7 is installed in place on the physical phone.
The complete picker/save/restore walkthrough passed on 30 October, with
synthetic tests isolated from production and private baseline preservation
verified. See [phone acceptance](PHONE-ACCEPTANCE-2026-10-30.md).

## Next integration step

The feature is integrated locally in the canonical checkout. Review its working diff before any later commit or release. The public redirect and Pages allowlist are unchanged. Akasha now includes platform account-history export imports; see [AKASHA-ACCOUNT-HISTORY.md](AKASHA-ACCOUNT-HISTORY.md). File imports are explicitly separate from automatic account syncing. Real provider coverage, authenticated owner storage, content extraction, and model-based tagging require separately designed contracts and authorization; no credentials, network integrations, migrations, paid services, or automatic plans were added.


## Naming and product direction (owner, 2026-10-26 Anchorage)

Akasha is the feature name and proposed AliaSpaces help AI. Akashic records are the user-controlled collection of digital experiences: what they consumed, chose to remember, and experienced through their phone. The spiritual framing is a product metaphor, not a claim that this implementation records thoughts or consciousness.

Future direction: users can talk with Akasha about their captured consumption, document memories, reflect on emotional effects and influences on their actions, and choose editable feed filters for their own wellbeing. Preserve the original captured history; filtering should change what they see going forward, under their control. No automatic moral classification or hidden relevance deletion.

Code 8 adds local reflection notes, emotional effects and next steps, plus reversible library view rules. Conversation/AI, external provider feed changes and automatic syncing remain blocked on separate contracts. The legacy pantry storage key and version-1 backup importer remain compatible so the rename does not strand existing records. Old pantry.html bookmarks redirect to akasha.html on the same origin.

Reflection limits are 5,000 characters for notes and 2,000 each for effects/next
steps. Rules support at most 100 entries per category of 200 characters each.
Search includes saved reflections; hiding rules match original content/tags, not
personal reflection text. Full backups retain hidden/rejected records, notes and
rules. Existing edits/rules win on merge. Corrupt raw storage can be exported in
a lossless JSON recovery envelope; it is not a validated normal backup and cannot
be directly imported. No mutation or empty fallback replaces the unreadable data.


## Account-history update
Platform history JSON/TXT and bounded ZIP import are implemented locally. Account-history records can include phone-app activity retained in the source export. No browser recorder is integrated. Automatic account transfers are not connected; see AKASHA-ACCOUNT-HISTORY.md for provider prerequisites and verification limits.
