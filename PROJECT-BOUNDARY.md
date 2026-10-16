# AliaSpaces / MyPersonas project boundary

**Owner direction:** maintain two separate repositories and products.

**Status:** approved product direction; extraction is in progress. This document
does not authorize a deployment, database migration, DNS change, provider
permission, publication, payment activation, or account change.

## AliaSpaces owns

- Persona and business page presentation, custom fields, widgets, layout, and
  image placement.
- Public discovery, persona search, feeds, posts, albums, comments, reactions,
  and first-party moderation presentation.
- Persona follows, friendship requests, blocks, mutes, family links, backups,
  projects, business roles, and persona-perspective interaction.
- Page publication review, social visibility, field visibility, attached social
  handle presentation, public affiliate offers, review-request forms, and the
  public social PWA identity.

## AliaSpaces does not own

- External-provider secrets, token refresh, mailboxes, automated publishing,
  or provider reconciliation workers.
- AI provider routing, model budgets, task runners, research briefs, or private
  persona source libraries.
- Stripe webhooks, subscription remediation, refunds, trial-abuse controls, or
  staff billing tools.
- Global-administrator security operations, provider-wide incident response,
  or the current production database migration runner.

## Shared contracts

Authentication/MFA, canonical account and persona identifiers, entitlements,
media ingest, provenance, audit events, and account export/deletion are shared
contracts. AliaSpaces consumes narrow versioned projections and operations; it
does not copy privileged implementations. Every shared interface must be
authenticated, owner-scoped, and fail closed.

No Edge Function or migration may have two deployment owners. Historical
migrations stay in the MyPersonas ledger until a separately reviewed handoff
assigns a new single authority.

## Release gates

1. Keep the current front door available as the rollback artifact.
2. Stage the independent social client without changing production routing.
3. Public media must expose opaque asset identifiers, never stable owner UUIDs,
   raw storage paths, or reusable private signed URLs.
4. Pass signed-in iOS/Android testing and the unrelated two-account privacy
   matrix before cutover.
5. Verify entitlement loss unpublishes pages exactly once and pauses automation;
   payment restoration must not silently republish or resume posting.
6. Treat deployment, production migration, DNS, provider authorization,
   publication, and money actions as separate approval gates.
