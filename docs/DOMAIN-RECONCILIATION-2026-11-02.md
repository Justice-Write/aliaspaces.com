# Domain reconciliation — 2 November 2026

This source combines PR #6 (`13ef803`) with the October 31 domain branch
(`5a43610`). The release coordinator sequences MyPersonas first, then the exact
AliaSpaces source pin, review and deployment. This lane does not deploy or merge.

## Reconciled behavior

- `aliaspaces.com` is the social site; `mypersonas.online` is the automation
  platform. Website mode starts on AliaSpaces and includes an explicit MyPersonas
  owner-command-center link. The shell hides no controls and rewrites no routes;
  the shared website domain module owns routing and callback handling.
- PR #6's local Akasha reflections, reversible rules, recovery exports, native
  recovery-save naming, strict host trust and backup exclusions are retained.
  Original storage/version-1 backups and current-edit-wins merging remain intact.
- Android source becomes 0.5.1/code 9 to distinguish this payload from the code-8
  artifact. No native build/install is claimed; code 7's last accepted installation
  is unchanged by this work.
- The social builder uses the pinned MyPersonas public include rule and byte audit,
  refusing mismatched checkout revisions, dirty or untracked public files, symlinks,
  missing domain/PWA modules and changed metadata structure.
- Alia output overrides index metadata/apple title/WebSite JSON-LD, public manifest
  name/description/categories/shortcuts, offline identity, CNAME/robots/sitemap/404.
  Manifest `id`, `scope`, `start_url` remain `./`; icons/display remain intact.
  Social shortcuts do not launch owner tools. Copy does not promise anonymity or
  unlinkability. Public media privacy/projection gates remain separate.
- Service-worker changes affect only public-shell cache namespace/version, bound
  to the source pin. Its network-only owner code/API policy and cached file allowlist
  remain unchanged; no owner data is introduced into offline storage.
- The old five-file front door is preserved under `front-door/` as explicit rollback.

## Release gates

Pages is manual-only on main. A source merge cannot automatically publish the
newer shared app while bypassing MyPersonas release evidence. Social deployment
requires the same migration/provider confirmations, signed-in image-caption
canary confirmation and exact backend run/artifact receipt as MyPersonas. It checks
the expected workflow, exact pinned main revision, successful dispatch, receipt
SHA/scope/functions and both repositories' current main tips before deploying.
Cross-repository artifact read failures stop the workflow; they are not skipped.
The read-only `verify-upstream-receipt.yml` probe uses the production token and
download settings against backend run `41519827174`. It has only contents/actions
read permissions and cannot deploy or assert private-canary success. Both paths
use the same exact three-line receipt validator, tested against wrong revisions,
scope/function drift, duplicate/missing fields and unsupported extra assertions.
Hosted probe `41520222409` at source `7f63517` successfully downloaded that
cross-repository artifact with the existing token and passed the exact receipt
validator. No broader token was required. The PR check records overall job
completion separately; these checks do not assert private-canary success.

The final MyPersonas main pin is
`95edd7fbdff684079d65784a77c8a3e30e33b4c2` (PR #49 merged). The coordinator
verified its tree equals tested candidate `6cc4c75`; this lane verified the
actual frozen checkout HEAD equals the pin before building. Local artifact tests do not
prove backend deployment, canary success, production auth settings or live release.
Owner MFA/Auth redirect setup, exact backend evidence and signed-in canary remain
release dependencies; no SQL or provider changes are performed here.

## Validation

**Final validation: 70/70 Node tests and 39-file boundary PASS; all four local
headless browser smokes PASS; workflow YAML syntax PASS.** The final pin produces
126 source-audited public files before explicit social rewrites/additions. The
real-artifact headless smoke passes on that exact merged revision, including
actual router/discovery description writes, hostname routing, callback retention,
manifest and offline identity. A previous candidate failed the runtime privacy
copy assertion; the upstream correction was incorporated before this pass.

The full Node suite includes rollback, privacy/identity, pin provenance and
release-gate checks, plus the original Akasha/session/report safety tests.
Headless browser smokes cover local features and the Website management link.
`scripts/domain-artifact-smoke.mjs` accepts built social and control public trees
to check real hostname routing, callback host retention and static identity in a
network-isolated browser. These tests use synthetic data and no authenticated
accounts. It does not constitute signed-in canary or production device acceptance.

Root handoffs, personal histories/reflections/rules, cookies/sessions, exports,
backups, inventories and device evidence remain local and outside packages.
Canonical dirty source and the separate reports/projection branches are preserved.
No reports integration or unrelated migration source is included.
