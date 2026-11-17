# Skill evals

Two checks that run on every pull request, and one that needs a model.

| Command | What it does | Model call |
|---------|--------------|------------|
| `python -m evals.lint_skills` | Checks every `skills/*/SKILL.md`: frontmatter on the first line, `name` matches the folder, description says when to use it and fits the listing limit, Steps and Guardrails sections exist, every file it refers to is in the folder | No |
| `python -m evals.run_evals` | Re-grades the saved outputs in `results/outputs/` against `cases.json` and rewrites `results/latest.json` | No |
| `python -m evals.run_evals --live` | Sends each case to `claude -p` with the skill as its instructions and tools off, saves the output, records model, tokens and cost, then grades | Yes |

## What is graded

Each case in `cases.json` is a realistic request with a trap in it. The graders in `graders.py` are deterministic:

- **no_invented_keys**: every ticket key in the output must already be in the input.
- **no_personal_data**: no email addresses, phone numbers or names carried over from the input.
- **required_text**: the agreed structure is there (for example a Breaking changes section before New features).
- **forbidden_text**: nothing the skill is told never to say (for example "is WCAG compliant").

## Latest run

17 November 2026, `claude-opus-5-5`, one attempt per case: 5 of 5 cases and 20 of 20 checks pass, for 27,983 tokens and $0.24 as reported by Claude Code. The outputs that were graded are in `results/outputs/`.

The run before it scored 19 of 20. `pr-review-checklist` correctly raised a hard-coded API key as a blocker, but quoted the key's value in the review. The skill gained a guardrail ("Never repeat a secret's value in the review") and the case now passes. That is the loop this folder is for: a case fails, the SKILL.md changes in a pull request, the case passes.

## Adding a case

1. Add an entry to `cases.json`: the skill, the input, and the patterns that must and must not appear.
2. Run `python -m evals.run_evals --live --only <case-id>` to see the output and the grades without touching the saved results.
3. Run `python -m evals.run_evals --live` to refresh `results/`, and commit the outputs with the change.
