---
name: meeting-notes-to-jira
description: Turn meeting notes or a transcript into a decisions log, an actions list and draft Jira tickets for a person to approve. Use when asked to "turn these notes into tickets", "pull the actions out of this meeting" or "what did we agree".
---

# Meeting notes to Jira

Extract what was actually decided and agreed, and draft tickets for the actions, without creating anything in Jira yourself.

## Inputs

- The notes or transcript (pasted text or a file path).
- The team that owns the backlog. Ask if not given.
- Optional: the sprint the actions belong in.

## Steps

1. **Strip personal data first.** Replace names with roles (product owner, developer, caseworker lead). Remove email addresses, phone numbers and any citizen or case details. Tell the user what you removed.
2. Pull out three lists, quoting the notes where possible:
   - **Decisions**: things the meeting agreed. A suggestion nobody agreed to is not a decision.
   - **Actions**: work someone took on. Record the owner as a role and the due date only if stated.
   - **Open questions / parking lot**: things raised but not resolved.
3. Check the existing backlog before drafting anything. If the Lantern MCP server is connected, call `search_tickets` with the key words of each action. If a matching ticket exists, link it instead of drafting a duplicate.
4. For each action that needs a ticket, call the `draft_ticket` MCP tool (or produce the same fields as text if the server is not connected). Use `user-story-writer` conventions for stories.
5. Show the user every draft, including any `warnings` the tool returned, and ask them to approve, edit or drop each one.

## Guardrails

- **Never create, update or close tickets.** `draft_ticket` returns a draft only; a person creates the ticket.
- **Never invent ticket keys, owners or dates.** Missing owner: `Owner: not agreed`. Missing date: `Due: not stated`.
- **Do not upgrade an idea into a decision.** If it is unclear whether something was agreed, put it in Open questions and say why.
- Flag notes that look incomplete (for example a "Decisions" heading with nothing under it) rather than filling the gap.
- If the notes mention security incidents or personal data breaches, stop and tell the user to follow the incident process instead.

## Output format

See `output-format.md` in this folder.
