# AliaSpaces agent guide

> **Read `status-handoff.md` (repo root) before doing anything.** Before you start
> work, record what you are about to do in its *In progress* section; when you
> finish or stop, move that entry to the *Work log* and update current state and
> next steps. This applies to every model and tool working in this repository.

Read this file, `docs/ROADMAP.md`, and the current source before changing
anything.

## Repository shape

- The selected GitHub Pages site is a **redirect/front door** only:
  `index.html`, `404.html`, `CNAME`, `.nojekyll`. Preserve it.
- The Pages workflow publishes those files plus `favicon.svg` from `main`. Do not add
  application source to that artifact.
- Social product work lives under `apps/`. The isolated mobile surface is
  `apps/social-mobile/`: Local demo, Website WebView, and first-party
  Social client (`live.html`).
- `split/social-platform-20260824` holds the earlier extraction workbench
  (profile crop) and product-boundary docs. Do not copy fused MyPersonas
  pages, automation, billing, or provider functions into this repository.

## Product boundary

AliaSpaces owns personas, pages, feeds, posts, reactions, reports, blocks,
and first-party social presentation. MyPersonas owns provider credentials,
automation, AI routing, billing internals, and the current production
migration authority. Shared identity, entitlements, media, and account
lifecycle are consumed as versioned contracts.

## Working rules

- Implement; do not only plan.
- Keep approved public copy and the front-door redirect behavior.
- Local prototypes must say **local/demo**. Do not invent online users or
  network success. Live website mode may open `mypersonas.online` and must
  say so; do not hide a failed Google/WebView login as success.
- Separate user-created records from fixtures.
- Preserve user data. Provide export/import. If Android signing differs,
  tell the owner to keep both installs or import JSON.
- Existing phone-test prototypes may exist on the owner's devices and are
  **not** in this cloud checkout. Do not claim access to them.
- Do not merge to `main`, deploy Pages, publish to stores, change account
  permissions, use production secrets, or start paid services.
- Store accounts are recorded as verified (Google personal). Submissions
  are later and owner-gated.

## Tests and evidence

- Run `npm test` before you finish.
- Domain tests must prove blocked content is excluded from feed, profiles,
  reactions, and reports.
- Record what was actually verified (browser, unit, APK build) and what
  remains owner-gated (real phone, two-account live privacy).
