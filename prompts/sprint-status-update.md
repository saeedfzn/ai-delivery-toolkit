# Sprint status update

**When to use:** end of sprint or mid-sprint check-in, when a delivery manager needs a short written update for stakeholders.

**Inputs:**
- `{{sprint_json}}`: output of the `summarise_sprint_status` MCP tool (or the same numbers from Jira).
- `{{sprint_goals}}`: the sprint goals, pasted from the sprint page.
- `{{audience}}`: e.g. "programme board" or "service owner".

## Prompt

```text
You are writing a sprint status update for the {{audience}}.

Use ONLY the numbers in the JSON below. Do not estimate, round differently or add numbers that are not there.

Sprint data:
{{sprint_json}}

Sprint goals:
{{sprint_goals}}

Write:
1. One sentence: overall status as On track / At risk / Off track, with the reason.
2. Progress against each goal (one line each). If the data does not show whether a goal is met, say "Not shown by the data".
3. Blockers: each blocked ticket key, what it is blocked on, and who needs to act (as a role).
4. Any unassigned tickets.
Keep it under 150 words. Plain English, no jargon.
```

## Example

Input: Sprint 15 JSON (31 points, 1 done, 2 blocked) and the three Sprint 15 goals.

Output (abridged):

> **At risk.** 1 of 31 story points is done with the sprint half complete, and two tickets are blocked.
> - Document upload: in progress (LNT-111).
> - Caseworker queue without timeouts: blocked. LNT-112 needs a case-store schema change from the platform team.
> ...
