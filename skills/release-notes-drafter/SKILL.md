---
name: release-notes-drafter
description: Draft release notes from a git log between two tags or commits, grouped into features, fixes and internal changes, with a plain-English summary for non-technical readers. Use when asked to "write release notes", "what changed since v2.3.0", or "summarise this release".
---

# Release notes drafter

Write release notes from the actual commit history, so every line can be traced to a commit.

## Inputs

- The range, e.g. `v2.3.0..HEAD`. If no range is given, find the latest tag with `git describe --tags --abbrev=0` and confirm it with the user.
- The version number of the new release. If not given, ask. Do not pick one.
- The audience: `team` (technical, default) or `service` (product owners and service users).

## Steps

1. Collect the commits and group them with `group_commits.py`, which ships in this skill's folder (Claude Code fills in `${CLAUDE_SKILL_DIR}`; use `python3` or `py -3` if `python` is not on your PATH):

   ```bash
   git log --no-merges --pretty=format:"%h %s" v2.3.0..HEAD | python "${CLAUDE_SKILL_DIR}/group_commits.py"
   ```

2. Read the JSON. Work only from it. If `unparsed_lines` is not empty, mention those commits under "Other changes".
3. Rewrite each entry as a short sentence describing the effect for the user, not the code change ("Applicants now get a confirmation email" rather than "add notify client").
4. Merge entries that describe the same change. Drop pure noise (typo fixes, formatting) from the `service` version only.
5. If `breaking_changes` is not empty, put a **Breaking changes** section first and say what people must do.
6. Write a two-sentence summary at the top.

## Guardrails

- **Every bullet must map to at least one commit.** Keep the short SHA in the `team` version.
- **Only quote ticket keys that appear in the commits** (`tickets` in the JSON). Never invent or infer a key.
- Do not mention people by name; commits are about changes, not authors.
- If the range has no commits, say so and stop. Do not write placeholder notes.
- Do not include secrets, hostnames or internal URLs that appear in commit messages; redact them and tell the user.

## Output

```markdown
# Release 2.4.0 - <date or TBC>

Applicants can now upload supporting documents and get a confirmation email. Caseworker queues load faster.

## New features
- Applicants receive an email with their application reference (LNT-107, `a1b2c3d`)

## Bug fixes
- Impossible dates such as 31 February are now rejected (LNT-108, `d4e5f6a`)

## Internal changes
- Upgraded the PDF library (`0f1e2d3`)
```
