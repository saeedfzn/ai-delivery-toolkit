# Output format

```markdown
## Meeting: <title from notes> - <date from notes, or "date not stated">

Personal data removed: 2 names replaced with roles, 1 email address removed.

### Decisions
1. Free-text caseworker notes wait for the data protection impact assessment. ("We won't build notes until the DPIA is signed off.")

### Actions
| # | Action | Owner (role) | Due | Ticket |
|---|--------|--------------|-----|--------|
| 1 | Add server-side paging to the case queue | Platform lead | not stated | Existing: LNT-112 |
| 2 | Write the Welsh start page content | Content designer | 21 Nov | Draft A |

### Open questions
1. Should queue filters persist between sessions? Raised by the caseworker lead, not resolved.

### Draft tickets (not created - approve, edit or drop each)
**Draft A** - Story - Team Kestrel
Summary: Welsh language version of the start page
Acceptance criteria: ...
Warnings: none
```

Notes:

- `Ticket` says `Existing: <key>` only when `search_tickets` returned that key. Otherwise it points to a draft.
- Keep quotes short and only where they settle what was agreed.
