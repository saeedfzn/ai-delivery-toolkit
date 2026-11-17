# Contributing

Changes go through a pull request with one reviewer. The aim is small changes that are easy to review and easy to undo.

## The flow

1. **Branch** from `main`: `git switch -c lnt-123-short-description` (use the ticket key if there is one).
2. **Make one change.** A new skill, a fix to a tool, a docs update. Not all three.
3. **Run the checks locally** before pushing:
   ```bash
   cd mcp-server && npm ci && npm run typecheck && npm test && npm run build && npm run proof
   cd .. && python -m unittest && python -m evals.lint_skills && python -m evals.run_evals
   ```
4. **Open a pull request** and fill in the template. Name any AI assistant, skill or prompt you used.
5. **One reviewer** who is not the author approves. CI must be green. The `pr-review-checklist` skill can give you a first pass before you ask a person, but it does not replace the human review.
6. **Reviewer response time:** within one working day. If a review needs a conversation, have it, then summarise the outcome in the PR.
7. **Squash and merge.** Delete the branch.

## Size

Aim for under about 400 changed lines, excluding lock files and generated output. If a change is bigger, split it: for example, the data change in one PR and the code that uses it in the next.

## Reviewing

- Use the checklist in [skills/pr-review-checklist/checklist.md](skills/pr-review-checklist/checklist.md).
- Mark comments as **Blocker**, **Should fix** or **Nit**. Nits never block a merge.
- Comment on the code, not the person.
- Approve when it is better than what is on `main` and safe to ship, not when it is perfect.

## Adding a skill

1. Create `skills/<name>/SKILL.md` with YAML frontmatter: `name` (same as the folder) and `description` (what it does and the phrases that should trigger it).
2. Include: inputs, steps, guardrails, output format and a short example.
3. Every skill must say how it handles missing information and personal data.
4. Put helper scripts next to the SKILL.md and add tests for them under `tests/`.
5. Add at least one case to `evals/cases.json` with a trap the guardrails should catch, and run `python -m evals.run_evals --live` (see [evals/README.md](evals/README.md)).
6. Add the skill to the catalogue in `index.html`. If you also add it to `SKILLS` in `scripts/make_sample_log.py`, regenerate the sample log and the metrics in the same pull request.

## Changing a skill

Run the evals before and after. If the change fixes a behaviour, add or tighten the case that would have caught it, so the fix stays fixed.

## Promoting a prompt to a skill

If a prompt in `prompts/` is being used most weeks, or people keep adapting it the same way, turn it into a skill so the improvements are shared.

## Data rules

- All sample data is fictional. Never commit real names, emails, case details or usage logs that identify people.
- Usage logs use pseudonymous user tokens (`u-014`). The report rejects rows that look like they contain an email address.
