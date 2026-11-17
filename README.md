# AI Delivery Toolkit

[![CI](https://github.com/saeedfzn/ai-delivery-toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/saeedfzn/ai-delivery-toolkit/actions/workflows/ci.yml)

Reusable AI tooling for delivery teams, built end to end: Claude Code skills with guardrails, an MCP server for Jira and Confluence data (mock data by default, with an optional GET-only REST source), evals that test the skills against a real model, and a usage report with a dashboard that shows adoption, acceptance and cost.

**Live dashboard and guide:** <https://saeedfzn.github.io/ai-delivery-toolkit/>

> **Portfolio project** by Faizaan Saeed. It is built for Project Lantern, a fictional public-sector digital programme. All teams, tickets, pages and usage data are fictional.

## What is here, and how to check it

Everything in this table runs from a clean clone. CI runs the same commands on every push.

| Piece | Where | What it is | Prove it |
|-------|-------|------------|----------|
| Skills | [`skills/`](skills/) | Five Claude Code skills (`SKILL.md` + helper scripts), also loadable as a plugin | `claude --plugin-dir .` |
| Skill evals | [`evals/`](evals/) | Linter for every SKILL.md, and 5 cases with 20 guardrail checks graded on real model output | `python -m evals.run_evals` |
| MCP server | [`mcp-server/`](mcp-server/) | TypeScript, official SDK, six read-only tools, zod validation, 30 tests | `npm test && npm run proof` |
| Jira and Confluence | [`mcp-server/src/atlassian.ts`](mcp-server/src/atlassian.ts) | GET-only REST source for the same tools; mock data is the default | `npm test` |
| Usage report | [`scripts/usage_report.py`](scripts/usage_report.py) | Python, standard library: active users, acceptance, tokens, cost per accepted output | `python -m unittest` (24 tests) |
| Dashboard | [`index.html`](index.html) | GitHub Pages site, no build step, light and dark, keyboard accessible | open the live link |
| Enablement | [`docs/`](docs/), [`prompts/`](prompts/) | 10-minute getting-started guide, 45-minute workshop plan, prompt library, Azure hosting note | read them |
| Ways of working | [`.github/`](.github/), [`CONTRIBUTING.md`](CONTRIBUTING.md) | GitHub Actions CI, pull request template, review flow | see the Actions tab |

## Run it

Requirements: Node.js 22.12 or later, Python 3.10 or later, Claude Code. On Windows, use `py -3` in place of `python`.

```bash
# MCP server: typecheck, 30 tests, build, then a raw JSON-RPC session over stdio
cd mcp-server
npm ci
npm run typecheck && npm test && npm run build && npm run proof
claude mcp add lantern-delivery -- node "$(pwd)/dist/index.js"
cd ..

# Python: 24 tests, skill lint, re-grade the saved eval outputs, rebuild the metrics
python -m unittest
python -m evals.lint_skills
python -m evals.run_evals            # add --live to call the model through `claude -p`
python scripts/usage_report.py data/usage-log.jsonl --out data/adoption-metrics.json

# Site: any static server
python -m http.server 8000           # then open http://localhost:8000/
```

Then, in Claude Code: "Summarise Sprint 15 status and list what is blocked." The numbers (31 points, 1 done, two blocked tickets) come from the `summarise_sprint_status` tool, not from the model. Ask for "ticket LNT-999" and it says there is no such ticket.

To use a skill, copy its folder into `.claude/skills/` in your repo. See [docs/getting-started.md](docs/getting-started.md).

## Why it is built this way

Teams adopting AI coding tools tend to end up with dozens of personal prompts, no shared standards, and no idea whether the tools are helping. This toolkit shows a different pattern:

- **Shared skills** that encode the team's standards (acceptance criteria, review checklist, WCAG checks) and its rules (never invent ticket numbers, flag missing information, no personal data).
- **Grounded answers** through an MCP server, so Claude reads the backlog instead of guessing it, with least-privilege tools.
- **Tested behaviour**: each skill has an eval case with a trap in it, and the guardrails are checked by code, not by eye.
- **Measured adoption**: weekly active users, which skills are used, how often output is accepted, and what each accepted output costs.
- **Self-service enablement**: a 10-minute getting-started guide and a 45-minute workshop.

## What is in each part

**Skills.** Five skills in the standard format: a folder with a `SKILL.md` whose YAML frontmatter has `name` and `description`. Each defines inputs, steps, guardrails, an output format and an example. Two include tested helper scripts, referenced through `${CLAUDE_SKILL_DIR}` so they run wherever the skill is installed: `group_commits.py` turns `git log` into structured sections so release notes come from commits, not memory, and `scan_html.py` does the mechanical part of a WCAG 2.2 check. A `.claude-plugin/plugin.json` manifest makes the set loadable as one plugin (`claude plugin validate .` passes).

**Skill evals.** `evals/lint_skills.py` checks every SKILL.md for format and house rules. `evals/run_evals.py --live` sends five fixed cases through `claude -p` with the skill as instructions, saves the outputs, and grades them with deterministic checks: no ticket key that was not in the input, no personal data carried over, required structure present, forbidden claims absent. Latest run (17 November 2026, `claude-opus-5-5`): 5 of 5 cases, 20 of 20 checks, 27,983 tokens, $0.24. The run before it caught `pr-review-checklist` quoting a hard-coded secret in its own review; the skill gained a guardrail and the case now passes. CI re-grades the saved outputs on every push without a model call. See [evals/README.md](evals/README.md).

**MCP server.** Six tools (`search_tickets`, `get_ticket`, `search_pages`, `get_page`, `summarise_sprint_status`, `draft_ticket`). All are read-only; `draft_ticket` returns a draft for approval and redacts personal data. Each call writes one JSON line to stderr (tool, outcome, duration, size, never arguments). `npm run proof` starts the built server and speaks newline-delimited JSON-RPC to it directly, so the protocol exchange is visible. See [mcp-server/README.md](mcp-server/README.md).

**Jira and Confluence.** With `ATLASSIAN_BASE_URL`, `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN` and `JIRA_JQL` set, the server loads issues from Jira Cloud REST v3 and pages from Confluence Cloud REST v2 instead of the mock JSON. Requests are GET only, responses are validated with zod, assignees are pseudonymised, and errors never include credentials.

**Usage report.** Reads JSONL or CSV events (`ts, user, team, tool, skill, input_tokens, output_tokens, outcome`) and outputs weekly active users by team, top skills, acceptance rate, token totals, estimated cost and cost per accepted output. User IDs must be pseudonymous tokens; rows that are not are rejected and counted. Cost rates are command-line options; the defaults are illustrative, not quoted prices.

**Dashboard.** Plain HTML, CSS and JavaScript. Stat tiles, a weekly active users column chart, a ranked skills bar chart, team tables and the eval results, all drawn from the committed JSON. Light and dark themes, keyboard-reachable tooltips, a table view of the weekly and team figures, direct value labels on every bar, and no horizontal scroll down to 320 px.

**CI.** GitHub Actions runs typecheck, tests, build and the stdio proof for the server; the Python tests, the skill lint and the eval re-grade; and a check that the committed metrics and eval results match a fresh run.

## About me

Faizaan Saeed, AI and Power Platform developer, Swindon.

- Builds every day with Claude Code, using MCP connectors, skills and sub-agents.
- Debugged a failing Microsoft MCP integration to a parameter-name mismatch by inspecting its JSON-RPC calls. The proof script in this repo uses the same technique.
- Runs adversarial reviews with panels of AI sub-agents, with every finding checked by hand.
- Delivered a stock-control system for a satellite and RF manufacturer on a 15-day contract: a Power Apps app, six Power Automate flows, reports and a dashboard; 56 versioned releases; signed off and handed over with user, admin and technical guides.
- Built MechAI, an AI vehicle-diagnostics platform on Python/FastAPI and PostgreSQL over about 143 million rows, which calls an LLM API.
- Portfolio: [saeedfzn.github.io](https://saeedfzn.github.io)

## Licence

MIT. See [LICENSE](LICENSE).
