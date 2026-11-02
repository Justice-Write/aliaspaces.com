# aliaspaces.com serves the social site

Owner ruling, 2026-10-31:

- **aliaspaces.com** is the social media site.
- **mypersonas.online** is reserved for managing the AI-assisted persona
  platform that runs inside AliaSpaces.

The owner chose to serve the current live site on aliaspaces.com, split by view,
instead of the old redirect to mypersonas.online.

## What aliaspaces.com publishes

`.github/workflows/pages.yml` builds the artifact with
`scripts/build-social-site.mjs`:

1. `SOCIAL-SITE-SOURCE.json` pins one MyPersonas commit. The workflow checks out
   MyPersonas `main` and refuses a pin that is not on `main`.
2. The build copies exactly the public files MyPersonas publishes to
   mypersonas.online. It uses MyPersonas's own Pages include rule and
   `scripts/audit-public-package.mjs` from the pinned checkout, so the byte
   parity and private-data checks are the same on both domains.
3. It refuses a build without `domain-split.js`. Without that file, aliaspaces.com
   would serve the owner workspace.
4. It applies the aliaspaces.com identity: `CNAME`, head metadata (title,
   canonical, Open Graph, Twitter, JSON-LD), the header name, plus
   aliaspaces-owned `404.html`, `robots.txt` and `sitemap.xml` from `site/`.
5. It writes `social-site-source.json` so the live site names the commit it
   serves.

The November reconciliation also checks actual checkout/pin equality and clean,
committed public source. It rewrites static manifest/offline identity and the
public-shell cache namespace/version without changing cached membership or API
handling. See [current receipt](DOMAIN-RECONCILIATION-2026-11-02.md).

The split itself lives in MyPersonas: `MyPersonas.Online_v0/domain-split.js` and
`docs/DOMAIN-SPLIT.md` in that repository. In short, owner-workspace views open
on mypersonas.online, and public persona, business, tag, search, invite and
Persona-view pages open on aliaspaces.com. Sign-in is per domain.

## Updating

To stage a newer build, set `commit` in `SOCIAL-SITE-SOURCE.json` to the exact
coordinator-verified MyPersonas main revision. Review/merge the Alia source, then
manually dispatch Pages only after the migration/provider/backend/private-canary
release evidence passes. Source merging does not auto-deploy. Both main tips and
the exact backend run are rechecked immediately before publication.

## Rollback

Run the Pages workflow by hand with `artifact: front-door`. That republishes the
old redirect (`front-door/`) to mypersonas.online. The `?hop=1` rule in
`domain-split.js` keeps this loop-free even after mypersonas.online has the
split.

## Before the first deploy

- Supabase Auth → URL Configuration: add `https://aliaspaces.com/**` and
  `https://www.aliaspaces.com/**` to Redirect URLs (owner).
- Merge the MyPersonas domain-split change into `main`, and re-pin here if it
  was squash-merged.
