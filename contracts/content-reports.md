# Content reports contract, v1

Status: **defined, not yet live.** The server side is MyPersonas migration
080, `MyPersonas.Online_v0/sql-updates/080-content-reports-moderation-queue.sql`
on branch `claude/content-reports-20261016`. It has not been applied to
project `nwsqyuucwzihruszocge` yet. Until it is, both reporter RPCs answer
404, and this client says *Reporting is not enabled on the server yet.
Nothing was sent.*

AliaSpaces consumes this interface. It does not own the SQL. Per
`PROJECT-BOUNDARY.md`, the MyPersonas ledger is the only deployment owner.
`tests/content-reports-contract.test.mjs` fails if
`apps/social-mobile/src/live/contract.js` drifts from the lists below.

## Reporter RPCs (this client)

| RPC | Arguments | Returns |
| --- | --- | --- |
| `report_content` | `p_target_kind`, `p_target_id`, `p_reason`, `p_details` (≤ 2000 chars), `p_reporter_persona_id` (optional, must be yours) | `{id, state, duplicate}` |
| `my_content_reports` | `p_limit` (1–100) | your reports: `id, target_kind, target_id, reason, state, created_at, updated_at` |

Both need a verified session.

## Staff RPCs (refused by this client)

`staff_list_content_reports`, `staff_review_content_report`,
`staff_set_content_hold`. They need global_administrator or technician,
an AAL2 session, and recusal. They belong on a separate staff surface.

## Values

Target kinds:

| kind |
| --- |
| `persona` |
| `post` |
| `comment` |

Reasons:

| reason |
| --- |
| `spam` |
| `harassment` |
| `hate` |
| `sexual_content` |
| `violence` |
| `self_harm` |
| `impersonation` |
| `privacy` |
| `intellectual_property` |
| `illegal` |
| `other` |

Report states seen by the reporter: `open`, `needs_review`, `resolved`. The
reporter never sees the target owner, the details, the assignee, or the
resolution.

## Rules the client may rely on

- You can report what you can see, or what only your own block or mute hides.
  So report-then-block and block-then-report both work.
- Content hidden because its author blocked you returns the same "not found"
  as missing, unpublished or private content. Muting them afterwards does
  not change that.
- You cannot report your own content.
- Repeating a report while one is unresolved returns that report with
  `duplicate: true`.
- Limits: 20 per hour and 100 per day per reporter.
- A report never hides or removes anything. Hiding content is the separate
  081 holds draft, which is not adopted. It applies to posts and comments,
  shows `hidden_by_moderation` only to the owner, and shows everyone else
  `unavailable`.
