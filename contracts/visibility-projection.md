# Visibility projection contract, v1

Status: **live in production**. This is a record of a server rule AliaSpaces
consumes. It is not a proposal.

Source: MyPersonas ledger `20260822170000_publication_social_security_governance.sql`
(`persona_visible`) and `20260823000000_persona_view_mode.sql`
(`persona_mode_can_view`). Confirmed by a read-only `pg_policies` and
`pg_proc` readback of project `nwsqyuucwzihruszocge` on 2026-10-16.

Correction: `docs/ROADMAP.md` and `docs/MOBILE-MILESTONE-2.md` listed
"server-side block projections" as missing production SQL. They were already
live. The client-side block filter is defense in depth, not the enforcement.

## Rule

A viewer account sees a persona when the viewer owns it, or when all of these
hold:

1. The persona's publication is current.
2. Its visibility is `public` or `unlisted`, or it is `private` and an accepted
   friendship links it to one of the viewer's personas.
3. The viewer has no `block` or `mute` rule on it.
4. The persona's owner has no `block` rule on any of the viewer's personas.
5. None of its publication dependencies fails rules 3 or 4.

Rules 3 and 4 make a block symmetric. A mute is one-way and only hides the
muted persona from the account that muted it.

`persona_mode_can_view(actor, target)` applies the same rules to one acting
persona. Private access needs an accepted friendship with that exact actor,
not with any persona on the account.

## Where it is enforced

| Surface | Enforcement |
| --- | --- |
| `personas` select | RLS `personas visible read`: owner, or `persona_visible(id)` |
| `posts` select | RLS `posts visible read`: `persona_visible(persona_id)` |
| `comments` select | RLS `comments read`: comment author and post author both visible |
| `reactions` select | RLS `reactions read`: reactor and post author both visible |
| `blocks` | RLS `blocks owner only`; writes only through `set_persona_visibility_rule` |
| Persona-mode reads (`my_persona_mode_feed`, `my_persona_mode_profile_posts`, `my_persona_mode_post_panel`) | `persona_mode_can_view` inside SECURITY DEFINER RPCs |

`set_persona_visibility_rule(p_other_persona_id, p_kind, p_enabled)` writes the
account-wide rule. A `block` also removes follows and friendships, in both
directions, between every persona the blocker owns and the blocked persona.

## What the client may assume

- A row the API returns has already passed this rule for the signed-in
  account.
- The client filter in `social-client.js` only covers the moment between a
  block and the next fetch. It is not a security boundary.
- The API never says *you were blocked*. Content hidden by the other side's
  block looks the same as missing or unpublished content.

## Change control

This rule belongs to the MyPersonas migration authority. AliaSpaces does not
redefine `persona_visible` or `persona_mode_can_view`. Persona-level
moderation would require such a change and is an open owner decision. See
`contracts/content-reports.md`.
