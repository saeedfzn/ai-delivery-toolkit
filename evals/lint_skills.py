"""Static checks for every skill in skills/. Standard library only.

    python -m evals.lint_skills            # exits 1 if any skill fails

Checks the parts of the Claude Code skill format that break silently when they
are wrong (a skill with unparseable frontmatter still loads, just with no
description to match on), plus this repo's house rules.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKILLS = ROOT / "skills"

NAME = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
LISTING_LIMIT = 1536  # description text beyond this is truncated in the skill listing
REQUIRED_SECTIONS = ("## Steps", "## Guardrails")
FILE_REF = re.compile(r"`(?:\$\{CLAUDE_SKILL_DIR\}/)?([A-Za-z0-9_-]+\.(?:md|py))`|\$\{CLAUDE_SKILL_DIR\}/([A-Za-z0-9_-]+\.(?:md|py))")


def parse_frontmatter(text: str) -> tuple[dict[str, str], str]:
    """Return (fields, body). Frontmatter only counts if '---' is the first line."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, text
    try:
        end = lines.index("---", 1)
    except ValueError:
        return {}, text
    fields: dict[str, str] = {}
    for line in lines[1:end]:
        key, sep, value = line.partition(":")
        if sep and key.strip() and not key.startswith((" ", "\t", "#")):
            fields[key.strip()] = value.strip().strip("\"'")
    return fields, "\n".join(lines[end + 1:])


def lint_skill(folder: Path) -> list[str]:
    problems: list[str] = []
    skill_md = folder / "SKILL.md"
    if not skill_md.is_file():
        return ["no SKILL.md"]
    fields, body = parse_frontmatter(skill_md.read_text(encoding="utf-8"))
    if not fields:
        return ["frontmatter missing: '---' must be the first line and be closed"]

    name = fields.get("name", "")
    if name != folder.name:
        problems.append(f"name {name!r} does not match folder {folder.name!r}")
    if not NAME.match(folder.name):
        problems.append("folder name must be lower-case words joined by hyphens")

    description = fields.get("description", "")
    if not description:
        problems.append("description is empty; Claude matches requests against it")
    elif len(description) > LISTING_LIMIT:
        problems.append(f"description is {len(description)} characters; the listing truncates at {LISTING_LIMIT}")
    elif "use when" not in description.lower():
        problems.append('description should say when to use the skill ("Use when ...")')
    if "<" in description or ">" in description:
        problems.append("description contains angle brackets")

    for section in REQUIRED_SECTIONS:
        if section not in body:
            problems.append(f"missing section {section!r}")
    if not re.search(r"\bnever\b", body, re.IGNORECASE):
        problems.append("guardrails should state at least one thing the skill must never do")

    for match in FILE_REF.finditer(body):
        ref = match.group(1) or match.group(2)
        if ref != "SKILL.md" and not (folder / ref).is_file():
            problems.append(f"refers to {ref}, which is not in the skill folder")
    return sorted(set(problems))


def lint_all(skills_dir: Path = SKILLS) -> dict[str, list[str]]:
    return {d.name: lint_skill(d) for d in sorted(skills_dir.iterdir()) if d.is_dir()}


def main() -> int:
    report = lint_all()
    for name, problems in report.items():
        print(f"{'FAIL' if problems else 'ok  '} {name}")
        for p in problems:
            print(f"       - {p}")
    failed = sum(1 for p in report.values() if p)
    print(f"{len(report) - failed} of {len(report)} skills pass")
    return 1 if failed or not report else 0


if __name__ == "__main__":
    sys.exit(main())
