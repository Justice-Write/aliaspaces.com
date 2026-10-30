# Akasha: platform account history

Owner correction, 2026-10-28 Anchorage: use the history retained by the user's platform account, including records of phone-app consumption. A browser observer is not an equivalent source. The abandoned browser-capture prototype is not integrated or required.

## Implemented locally

Open `apps/social-mobile/akasha.html` through a local HTTP server. Under **History recorded by your accounts**, choose a platform and an account label, select a file, review the row counts/sample, then import into pending review. No login or account connection is performed by this page. It says automatic transfer is not connected.

- YouTube: JSON watch-history arrays and Google YouTube My Activity arrays. Google documents activity title, URL, timestamp, products and activity controls. Records not confirmed as watched remain visible as `account-activity-unconfirmed`; search/subscription/activity events are not silently represented as video watches. Unavailable/deleted-link records remain visible.
- TikTok: `Your Activity > Watch History > VideoList` and `Activity > Video Browsing History > VideoList`, including separated history JSON and watch-history text containing Date/Link fields. Original timestamps without a timezone remain unknown unless the user supplies a confirmed fixed offset. Source dates are never replaced with import time.
- Facebook: recognized JSON containers `videos_watched_v2` or `videos_watched`, using original timestamps/data entries. Availability depends on the export. The parser does not infer watched history from posts, likes or saves.
- Instagram: `videos_watched` or `impressions_history_videos_watched` containers, if supplied by the account export. The latter is labeled `video-exposure`, not verified watching. This is not a claim that the export contains the entire in-app Reels Watch history. Meta's current export schema/coverage needs verification against an actual owner-supplied history-only file.

Import accepts a history JSON/TXT directly or a bounded ZIP (30 MB compressed, at most 40 MB selected uncompressed history). ZIP reads only recognized history filenames, ignores unrelated entries, verifies CRC/size, rejects unsafe paths/encryption/ZIP64 and does not extract anything to disk. If a history filename differs, select the unzipped file directly. HTML archives are not executed or parsed; request JSON. Limits are visible errors, never successful empty syncs. JSON history is limited to 20 MB and a combined import to 10,000 rows.

Every row from a recognized history section remains available, including unknown timestamps, unresolved links and unclassified content. Full original row values are retained and inspectable as text. IDs are stable per platform, user-provided account label and source event. Repeat imports do not overwrite approvals, tags or rejections. Reuse the same label for the same source account; labels are not verified identities. Known dates are UTC; unknown dates remain `unknown` and appear after clearing the date filter. Backup export/import supports existing manual records and new account-history records using the unchanged local storage key. Saving is atomic at the storage boundary; quota/corrupt storage/cross-tab conflicts do not acknowledge success.

## Automatic account transfer: specific remaining blockers

Local code inspection found existing `youtube-oauth`, `tiktok-oauth` and `meta-oauth` functions in the MyPersonas repository. They serve upload/publishing use cases; no portability scopes or account-history endpoints were found in those OAuth functions. Their source was inspected read-only; no tokens or accounts were accessed. Existing publishing consent is not viewing-history consent.

Google supports recurring Data Portability access to resource `myactivity.youtube`, with scope `https://www.googleapis.com/auth/dataportability.myactivity.youtube`. Archive requests are jobs, not a realtime watch stream; repeated requests have documented timing constraints. Connecting it requires the approved Google app, eligibility checks, separate consent, server-side token lifecycle, owner-scoped transfer jobs and retained coverage/time windows.

TikTok documents Watch History (Date, video link, post title) in Activity transfers. It requires Login Kit plus Data Portability approvals and `portability.activity.single` or `.ongoing` consent. Current Data Portability product eligibility covers TikTok users in EEA/UK. It is not a general US-account API. API jobs must preserve errors, expiry, retry/cancel state and actual covered ranges.

`PROJECT-BOUNDARY.md` assigns external-provider secrets, refresh and reconciliation workers to MyPersonas. This local AliaSpaces change does not move those privileged functions into the social client. No automatic transfer backend or credentials were created, no new permissions were granted, and no accounts were connected. A separate approved MyPersonas provider-history backend is the next integration dependency. Facebook/Instagram require verification of an actual supported watched-history transfer interface; no API endpoint is invented here. Native-app scraping or extracting private app storage is not used.

## Sources checked

- Google activity export schema: https://developers.google.com/data-portability/schema-reference/my_activity
- Google recurring authorization and archive timing: https://developers.google.com/data-portability/user-guide/time-based
- Google Takeout: https://support.google.com/accounts/answer/3024190
- TikTok watch-history transfer fields: https://developers.tiktok.com/docs/en/data-portability-data-types
- TikTok approval flow: https://developers.tiktok.com/docs/en/data-portability-api-get-started
- TikTok regional coverage: https://developers.tiktok.com/products/data-portability-api/
- Meta account history help: https://help.instagram.com/460411108811350/ (full export history availability not established by this page; Meta help access was limited during research).

## Verification and limits

Run `node --test apps/social-mobile/tests/account-history.test.mjs apps/social-mobile/tests/pantry.test.mjs`, `npm test`, and the boundary checker. The new `scripts/account-history-smoke.mjs` uses installed Playwright/Chromium; optional absolute `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` environment variables select an existing runtime. `scripts/pantry-smoke.mjs` remains the regression smoke. New tests use explicitly synthetic native-shaped exports, including stored/deflated ZIP, and never connect a real account. Genuine provider-export coverage remains unverified. Physical JSON/TXT/ZIP pickers, native save, reload, restore/merge and production-baseline preservation passed on 30 October; see [phone acceptance](PHONE-ACCEPTANCE-2026-10-30.md).
