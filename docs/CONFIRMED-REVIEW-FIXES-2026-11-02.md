# Confirmed review fixes — 2 November 2026

Owner authorized implementation after the post-release review. This branch starts
from deployed AliaSpaces `bb7027e`; canonical owner work is preserved. The release
coordinator owns cross-repository orchestration, final upstream pin and deployment.
This source lane does not change the Pages workflow or install on a phone.

## Packaging integrity

- The social builder inventories selected committed HEAD paths as well as current
  files. Deleted wildcard members/directories now fail before output is created;
  wrong revisions, modifications, untracked members and symlinks still fail.
- Both builders require an empty real output directory, rejecting linked output
  or linked ancestors before writing. Existing files are preserved, never cleaned.
- Successful builds verify final output membership. Rollback must contain exactly
  the five front-door files; reusing a social output now fails instead of reporting
  a misleading five-file result.

## Bounded native recovery

The native payload cap remains **10 MiB**. Akasha preflights actual UTF-8 bytes
before native dispatch. Ordinary backups and small corrupt-storage recovery files
keep their existing formats. If JSON escaping alone makes a recovery copy too
large, a compact recovery envelope can preserve its raw UTF-16 code units within
the same cap, including NUL and lone surrogates. The reproduced 2 MiB NUL case
now fits without raising native memory limits. Copies that cannot fit even in
compact form fail explicitly before requesting a file; original storage remains.

- Legacy envelope: `aliaspaces-akasha-storage-recovery-v1`, `rawStorage` text.
- Compact envelope: `aliaspaces-akasha-storage-recovery-v2`,
  `encoding: utf-16le-base64`, `rawStorageBase64`.
- `decodeRecoveryCopy(payload)` returns the exact original raw string for either
  format. It does not write storage, repair records or make the file importable.
  Recovery remains separate from validated version-1 collection backups.
- Base64 is encoding, not encryption. Both formats contain personal records and
  belong outside source, install packages and public evidence.

Native export limits are extracted into a pure tested policy, without widening
origin/frame/page access. Over-budget bridge messages now produce an explicit
error; cancellation/save behavior and normal backup import limits are unchanged.

## Verification / delivery boundaries

76 Node tests and the 41-file boundary check pass. Four headless browser smokes
pass, including real browser storage containing 2 MiB NUL plus a lone surrogate,
compact native dispatch, exact decode and unchanged raw storage. Kotlin unit tests,
release build/vital lint, signature and 19-file source-matched APK payload checks
pass. Android source/build is **0.5.2/code 10**, local-demo signed; **not installed**.
Candidate APK SHA256:
`67a9cc6e39e721098c7e6ae98034972cc73e8e8cee9a838f03a6db6bfebc8bba`.

The previous successful website release/parity/routing verification remains a
separate receipt. A fresh source build is not live delivery. Cross-repository
lease/active-backend fixes are owned by the coordinator; their independent review,
final pin, exact backend evidence and guarded two-site deployment must still be
completed. No reports integration, SQL, paid model call, credentials or account
settings are changed here.
