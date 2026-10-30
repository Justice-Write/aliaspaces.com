# Android picker, save and restore acceptance — 30 October 2026

**PASS for this local-client milestone.** Samsung SM-N986U1 has production package
`com.aliaspaces.social.local`, **0.4.1-akasha / code 7**, installed in place.
Its pulled installed APK exactly matches the release candidate SHA256:

`c607f83b50cb6d7e0cba79bb799f86423a494e6f4afeaf17f088030921947e0c`

The existing public local-demo certificate is unchanged. This is a test release,
not a Play Store signing identity.

| Physical-device check | Result |
| --- | --- |
| Native OpenDocument: YouTube JSON | Two rows previewed, imported only after explicit commit |
| Native picker: TikTok watch-history TXT | One row imported; unknown viewing time retained |
| Native picker: deflated YouTube ZIP | One row imported; unrelated synthetic entry skipped |
| Native CreateDocument export | Both completed exports equal all five synthetic records, original source fields, reviews/tags and categories |
| Restore after resetting only the synthetic collection | Complete five-record state exactly restored, including IDs and metadata |
| Re-import after later edits/manual capture | Six-record state unchanged; later rejection/tags and additional manual record preserved; no duplicates |
| Malformed backup | Error shown; complete stored state unchanged |
| Picker and save cancellation | Native dialogs fully closed; complete stored state unchanged |
| Reload and force-stop/relaunch | Six-record state preserved |
| Production code-6 to code-7 update | In-place install succeeded; no owner-package clear/uninstall |
| Production preservation | Native JSON exports before/after upgrade byte-identical; existing collection contained zero records |
| Production native restore | Private baseline merge acknowledged; zero records retained |
| QA label update | Separate app says AliaSpaces QA (synthetic); six synthetic records preserved |

The first immediate read saw Android's temporary empty file before its asynchronous
save callback finished. That same untouched file later contained the correct
4,410-byte JSON. This was a harness timing error, not a product save defect.
Completed writes were compared as parsed JSON, not inferred from file creation.
An earlier cross-project device interruption was discarded; affected cases were
repeated under a confirmed exclusive interval, then the phone was released.

## Personal-data boundary

- Full restore/reset tests used the separate `.acceptance` application ID with
  **19 byte-identical web assets**. Debug inspection is limited to debug builds.
  No synthetic records were inserted into the production collection.
- The test variant was initialized empty before fixtures existed. Restore
  simulation later removed only its verified synthetic localStorage collection.
  The owner package was never cleared or uninstalled. QA remains labeled;
  no package was uninstalled for cleanup.
- JSON backups contain only `version`, `categories`, and `items`; no session,
  cookie or token fields. Private baselines, full app-data tar, snapshots, UI XML,
  screenshots and synthetic files stay outside Git and APKs.
- Automatic backup is disabled and all nine storage domains excluded from
  cloud backup/device transfer. Compiled manifest/rules checked; actual cloud
  migration services were not exercised. Explicit JSON backup remains available.
- Package verification checks source hashes and native-asset allowlists.
  Three altered APKs (extra data asset, private database, modified guide) were
  rejected. Acceptance and altered APKs remain unpublished test artifacts.

Node **49/49**, Android navigation **3/3**, release build/vital lint, both browser
smokes, signature and package checks pass. Private receipts are referenced only
by the excluded root handoff.

These results clear the owner's PR #5 picker/save/restore gate. Genuine provider
exports, automatic sync, two-account MFA/privacy, production moderation/staffing,
owner-command-center parity, republication and social-home cutover remain separate
roadmap items. Pages still publishes only the five-file redirect.
