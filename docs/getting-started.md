# Get started in 10 minutes

Self-service guide for anyone on Project Lantern (a fictional programme) who wants to use the toolkit. The same steps appear on the [site](../index.html#start).

## Before you start

- Git, Node.js 22.12 or later, Python 3.10 or later. On Windows, use `py -3` wherever this guide says `python`.
- Claude Code installed and signed in (`claude --version` works).
- Read the house rules: no personal data, secrets or live case data in prompts; a person reviews every output.

## 1. Clone (1 minute)

```bash
git clone <repo-url>
cd ai-delivery-toolkit
```

## 2. Add skills to your project (1 minute)

Skills are folders containing a `SKILL.md`. Claude Code loads them from `.claude/skills/` in a project, or `~/.claude/skills/` for every project.

```bash
mkdir -p /path/to/your-repo/.claude/skills
cp -r skills/user-story-writer skills/pr-review-checklist /path/to/your-repo/.claude/skills/
```

You do not need to call a skill by name. Ask for the task ("write stories for this", "review my diff") and Claude picks the skill whose description matches. You can also call one directly: `/user-story-writer`.

To try all five without copying anything, load the repo as a plugin for one session: `claude --plugin-dir /path/to/ai-delivery-toolkit`. The skills then appear as `/ai-delivery-toolkit:user-story-writer` and so on.

## 3. Build and register the MCP server (3 minutes)

```bash
cd mcp-server
npm ci
npm run build
claude mcp add lantern-delivery -- node "$(pwd)/dist/index.js"
claude mcp list
```

`claude mcp list` should show `lantern-delivery` as connected. Add `--scope project` to the `add` command if you want to share the registration with your team through a committed `.mcp.json`.

## 4. Try it (3 minutes)

Start `claude` in your repo and ask:

1. "Summarise Sprint 15 status and list what is blocked." Expect 31 story points, 1 done, two blocked tickets with reasons.
2. "Write a user story for caseworkers who want to filter their queue." Expect Given/When/Then criteria and a list of open questions.

## 5. Check the guardrails (1 minute)

Ask: "Show me ticket LNT-999." The server returns "No ticket with key LNT-999", and Claude should say so rather than inventing one.

## 6. See usage (1 minute)

```bash
python scripts/usage_report.py data/usage-log.jsonl --out data/adoption-metrics.json
```

This regenerates the JSON behind the dashboard. Change the cost rates with `--input-rate` and `--output-rate` (per million tokens).

The log is a plain JSONL file with one event per use. Claude Code can supply the token, cost and skill fields through its OpenTelemetry export (`CLAUDE_CODE_ENABLE_TELEMETRY=1`): the `claude_code.token.usage` and `claude_code.cost.usage` metrics carry a `skill.name` attribute once `OTEL_LOG_TOOL_DETAILS=1` is set. Team comes from your own mapping of pseudonymous users to teams, and outcome from a one-click rating or the pull request.

## 7. Check the skills still behave (1 minute)

```bash
python -m evals.lint_skills     # format and house rules for every SKILL.md
python -m evals.run_evals       # re-grades the saved eval outputs; add --live to call the model
```

See [evals/README.md](../evals/README.md).

## Getting help

- Something wrong with a skill? Raise a pull request that changes its `SKILL.md` (see [CONTRIBUTING.md](../CONTRIBUTING.md)).
- Want a new skill? Start with a prompt in `prompts/`. If people use it every week, promote it to a skill.
