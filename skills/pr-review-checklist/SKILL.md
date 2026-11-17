---
name: pr-review-checklist
description: Review a pull request or local diff against the programme's review checklist (correctness, tests, security, accessibility, docs, size) and produce a short, prioritised review. Use when asked to "review this PR", "check my diff before I raise it", or "is this ready to merge".
---

# PR review checklist

Give the author a review they can act on in minutes: a verdict, the few things that matter, and nothing padded.

## Inputs

- A PR number (use `gh pr view <n>` and `gh pr diff <n>`), a branch (`git diff main...HEAD`), or a pasted diff.
- The linked ticket, if any. If the Lantern MCP server is connected, read it with `get_ticket` to compare the change with the acceptance criteria.

## Steps

1. Read the PR description and the linked ticket first, then the diff.
2. Check the size. More than about 400 changed lines (excluding lock files and generated code) is a finding in itself: suggest how to split it.
3. Work through `checklist.md` in this folder. Only report items that fail or need a decision.
4. For each finding, give the file and line, what is wrong, why it matters, and a concrete fix.
5. Rank findings: **Blocker** (must fix before merge), **Should fix**, **Nit** (optional, at most three).
6. Give a verdict: `Approve`, `Approve with nits`, or `Request changes`.

## Guardrails

- **Only comment on code in the diff.** Do not review unchanged files except to explain an impact.
- **Do not claim a test passes unless you ran it.** Say "not run" otherwise.
- **Never approve a change that adds secrets, credentials or personal data**, including in test fixtures or logs. That is always a Blocker.
- **Never repeat a secret's value in the review.** Refer to it by name, file and line (`NOTIFY_API_KEY` at `src/notify.ts:3`), so the review does not become a second copy of the leak.
- If the PR has no linked ticket or no description, flag it rather than guessing intent.
- Do not post comments to GitHub unless the user asks. By default, return the review as text.
- Be direct and kind. Critique the code, not the author.

## Output format

```markdown
**Verdict:** Request changes (1 blocker, 2 should-fix)

**Blockers**
1. `src/upload.ts:42` - file size is checked after the whole file is read into memory. A 2 GB upload will exhaust the container. Check `Content-Length` and stream with a limit.

**Should fix**
1. `src/upload.test.ts` - no test for a rejected file type. Add one for `.exe`.

**Nits**
1. `src/upload.ts:17` - `tmp` could be `scanQueue` for clarity.

**Checked and fine:** tests added for the happy path; error message follows the design-system pattern; no new dependencies.
```
