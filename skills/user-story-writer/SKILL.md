---
name: user-story-writer
description: Turn a rough feature request, problem statement or conversation into well-formed user stories with testable Given/When/Then acceptance criteria. Use when someone asks to "write a story", "split this into stories", "add acceptance criteria" or refine a backlog item.
---

# User story writer

Produce backlog-ready user stories that a developer and tester can work from without a follow-up meeting.

## Inputs to gather

1. The request or problem, in the user's words.
2. Who the user is (applicant, caseworker, team leader, admin...). If not stated, ask. Do not assume.
3. Any constraints already known: policy rules, data limits, accessibility, Welsh language, deadlines.
4. Optional: an existing ticket key to refine. If the Lantern MCP server is connected, read it with `get_ticket`; never guess a key.

## Steps

1. Restate the need in one sentence and name the user type.
2. Decide whether it is one story or several. Split when any of these are true: more than one user type, more than one outcome, or more than about 6 acceptance criteria. Prefer splitting by user outcome, not by technical layer.
3. Write each story using `template.md` in this folder.
4. Write 3 to 6 acceptance criteria per story in Given/When/Then form. Each must be observable and testable. Cover at least one unhappy path (validation error, empty state, timeout or permission denied).
5. Add an "Accessibility" criterion whenever the story has UI (keyboard operable, error summary receives focus, labels on every input).
6. List open questions separately. Do not hide uncertainty inside the criteria.

## Guardrails

- **Never invent ticket numbers, dates, story points or owners.** Leave them as `TBC` for the team to set.
- **Flag missing information** in an "Open questions" list instead of filling gaps with assumptions. If you had to assume something to proceed, mark it `Assumption:`.
- **No personal data.** If the input contains names, emails, phone numbers or case details of real people, replace them with roles ("the applicant") and say you did so.
- Do not add solution design (database tables, endpoints) unless the user asks; stories describe the outcome.
- Keep language plain. No "seamless", "robust" or "leverage".

## Output

Markdown, one section per story, in the format in `template.md`, followed by "Open questions" and, if any, "Assumptions". If the user wants it in Jira, offer to pass each story to the `draft_ticket` MCP tool, which returns a draft for a person to approve; it does not create anything.

## Example

Input: "Caseworkers keep asking for a way to see only the cases waiting on them."

Output (abridged):

> **Story: Filter the case queue by status**
> As a caseworker, I want to filter my queue by status, so that I can focus on cases waiting for my decision.
>
> - Given I am on my case queue, when I choose the status "Awaiting decision", then only cases with that status are shown and the result count updates.
> - Given a filter returns no cases, when the page loads, then I see "No cases match this filter" and a link to clear it.
> - Given I use a keyboard only, when I move through the filter controls, then each control can be reached and operated, and focus is visible.
>
> Open questions: Should the filter be remembered between sessions? Which statuses are in scope for the first release?
