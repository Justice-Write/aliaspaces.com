# Reports/import source preservation — October 30, 2026

This branch preserves the historical reports and local-demo import source from
8fb22d7 on its already-public parent. Device identifiers in its evidence notes
are redacted. The later production security finding in d4dbb04 is deliberately
excluded from the branch's ancestry and tree.

The historical source passes 38 Node tests and its 27-file mobile boundary
check. These checks do not establish current database, account or phone
acceptance. This is a source preservation branch, not an APK update or a
replacement for the active AliaSpaces/Akasha release. Main and its public front
door are unchanged. No migration, provider request, owner-data access or phone
operation was performed.
