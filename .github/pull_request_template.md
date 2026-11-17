## What and why

<!-- One or two sentences. Link the ticket, e.g. LNT-123. Do not invent a key; write "no ticket" if there is none. -->

## Type of change

- [ ] New or changed skill / prompt
- [ ] MCP server
- [ ] Usage report or dashboard
- [ ] Docs only

## Checklist

- [ ] Small and focused (under about 400 changed lines, excluding lock files)
- [ ] Tests added or updated, and run locally (`npm test` in `mcp-server/`, `python -m unittest` at the root)
- [ ] Skills: `python -m evals.lint_skills` passes and the eval results in `evals/results/` are refreshed if a SKILL.md changed
- [ ] No secrets, credentials or personal data, including in examples and test data
- [ ] Skills: `name` matches the folder, `description` says what it does and when to use it, guardrails included
- [ ] Docs updated (README, getting-started, or the site) if behaviour changed
- [ ] If an AI assistant helped, the skill or prompt used is named below and I have reviewed every line

## AI assistance

<!-- e.g. "Claude Code with pr-review-checklist", or "none". -->

## How to test

<!-- Exact commands or steps for the reviewer. -->
