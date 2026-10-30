# Program files and personal data

Reviewed 29 October 2026. Application code and user records are separable.
An installer needs the program; it must not contain the owner's account history,
persona libraries, sessions, exports or recovery archives.

## Product relationships

| Project | Responsibility | Relationship to this APK |
| --- | --- | --- |
| AliaSpaces | First-party persona social UI, local demo and Akasha | This repository and package |
| Akasha / Akashic records | User-chosen digital-history inbox, review and memory collection | Local feature, not a separate backend |
| MyPersonas | Private owner control plane, provider secrets, billing, shared migration authority | Website mode and public social contracts; no privileged source copied here |
| Personas | Electron lounge, desktop companions and extensions | Related client; not required by this APK |
| Soulular / Soul Concept | Desktop creative studio, characters/media/model tooling | Related workflow; not an APK dependency |
| Persona brands / Noo YouNiverse | Content and applications coordinated elsewhere | Not automatically bundled or published with AliaSpaces |

Legacy clones/worktrees are source history, not additional installed products.
Do not delete or consolidate them solely because their names overlap.

## What belongs in each package

| Material | Included? | Purpose / preservation |
| --- | --- | --- |
| Five front-door files | Pages only | Redirect HTML, icon, CNAME and .nojekyll |
| Five mobile HTML entrypoints and src JS/CSS | APK | 19 exact source-matched web assets in this candidate |
| Compiled Android code, resources, static guide, dependencies | APK | Runtime program, not owner content |
| Public Supabase URL/key and RPC contract | APK | Public client configuration; authorization remains server-side |
| Private/service credentials or refresh tokens | No | Never package or publish |
| Android WebView cookies, localStorage, preferences | No | Device app data; keep across in-place upgrades |
| Akasha original history rows, account labels, reviews, tags | No | Personal records; explicit JSON export/merge backup |
| Source history archives, saved exports and backup tar files | No | Private owner files; store outside checkout/releases |
| Desktop character/media/project/history libraries and model weights | No | External user assets and optional model dependencies |
| Tests/fixtures, screenshots, handoffs, node_modules, SDK/cache | No | Development/review material, not runtime payload |

`verify-apk.ps1` compares the complete assets/www member list to the source
allowlist and hashes every member. It also rejects development/private filenames
throughout the APK. This is a packaging check, not an exhaustive secret detector.

## Data stores

- Android application ID: `com.aliaspaces.social.local`. Android stores its
  private WebView files, preferences and cookies beneath its app-data directory,
  typically `/data/user/0/com.aliaspaces.social.local/`. These are separate from
  the installed APK. Do not clear app storage or uninstall during an upgrade.
- Local social key: `aliaspaces.social.local.v1`.
- Akasha key: `aliaspaces.pantry.local.v1`. The old name deliberately preserves
  compatibility. Data includes the original imported records; backup JSON is
  personal even if the visible titles appear harmless.
- Social session key: `aliaspaces.social.live.session.v1`. Treat sessions and
  WebView cookie databases as credentials. Akasha JSON backup is not a session
  backup and should not acquire tokens or cookies.
- Browser use: localStorage belongs to the browser profile and exact origin.
  Changing hostname/port does not migrate data. Export before moving origins.
- Website data is stored under MyPersonas's shared backend authority. A local
  browser or APK backup is not a database backup or evidence of provider consent.

## Computer inventory and limits

A private inventory outside Git records 45 matching directory locations across
Desktop, Downloads, Documents/GitHub, Documents/Projects, source/repos, Roaming
and Local/Programs, plus six explicitly checked installed/data paths. It uses
names and metadata, not private file contents. A broader recursive scan was
interrupted; exhaustive computer-wide discovery is not claimed.

Verified local locations include the canonical AliaSpaces/MyPersonas/Personas
checkouts, linked worktrees, organized MyPersonas and Soulular project folders,
the Soulular install under Local/Soul Concept, Roaming/personas,
Roaming/soul-persona-studio, and the older C:/AI/PersonaStudio install.
Windows registry reports Soulular 1.2.41 and Persona Studio 0.1.0. Their current
source/release work is handled in associated chats; no desktop update is implied
by this Android release. External model archives and cloud/provider records were
not exhaustively inventoried by this pass.

The pre-upgrade Android backup is a local private tar archive with 137 files.
It was checked as a readable tar and hashed. Keep it outside public repositories,
GitHub releases, screenshots and shared source packages. Recovery archives may
contain sessions. Do not relocate/delete originals merely to reduce package size.

## Associated chat review

Read relevant turn summaries, not only idle/active labels:

- **Map Project Steps Tools**: AliaSpaces roadmap, PR #3 session verification,
  moderation/two-account/device acceptance still separate.
- **Reconcile persona platform history**: MyPersonas roadmap automation/history;
  a stale checkpoint is insufficient proof of current work or deployment.
- **Personas — intention and roadmap**: concurrent desktop/family release lane.
- **MyPersonas portfolio stock-take**: concurrent portfolio Git/data inventory.
- **Plan coordinated persona launches**: concurrent MyPersonas release authority.
- This chat: **personas/aliaspaces Roadmap sweep, APKs, PWAs** owns this release.

Active Codex history was paginated to its end and ChatGPT active/archive indexes
were checked for associated project entries. Individual persona-brand chats were
indexed as related content work, not treated as implementation/deployment proof.
Historical APK/PWA claims are superseded only where fresh evidence is recorded.
