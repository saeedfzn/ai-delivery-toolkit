"""Group one-line git log output into release-note sections. Standard library only.

    git log --no-merges --pretty=format:"%h %s" v2.3.0..HEAD | python group_commits.py   # run from this skill's folder, or give its full path

Understands Conventional Commit prefixes (feat, fix, perf, docs, chore...).
Ticket keys are taken only from the commit text (e.g. LNT-107); none are invented.
Prints JSON so the skill can write the prose from facts, not from memory.
"""

from __future__ import annotations

import json
import re
import sys

SECTIONS = {
    "feat": "New features",
    "fix": "Bug fixes",
    "perf": "Performance",
    "security": "Security",
    "docs": "Documentation",
    "refactor": "Internal changes",
    "chore": "Internal changes",
    "build": "Internal changes",
    "ci": "Internal changes",
    "test": "Internal changes",
}
LINE = re.compile(r"^(?P<sha>[0-9a-f]{7,40})\s+(?P<subject>.+)$")
CONVENTIONAL = re.compile(r"^(?P<type>[a-z]+)(?:\((?P<scope>[^)]+)\))?(?P<breaking>!)?:\s*(?P<text>.+)$")
TICKET = re.compile(r"\b[A-Z][A-Z0-9]+-\d+\b")


def group(lines: list[str]) -> dict:
    sections: dict[str, list[dict]] = {}
    breaking: list[str] = []
    unparsed: list[str] = []
    for raw in lines:
        raw = raw.strip()
        if not raw:
            continue
        m = LINE.match(raw)
        if not m:
            unparsed.append(raw)
            continue
        subject = m["subject"]
        c = CONVENTIONAL.match(subject)
        kind = c["type"] if c else None
        section = SECTIONS.get(kind or "", "Other changes")
        text = c["text"] if c else subject
        entry = {
            "sha": m["sha"],
            "text": text,
            "scope": c["scope"] if c else None,
            "tickets": sorted(set(TICKET.findall(subject))),
        }
        sections.setdefault(section, []).append(entry)
        if (c and c["breaking"]) or "BREAKING CHANGE" in subject:
            breaking.append(m["sha"])
    order = list(dict.fromkeys(list(SECTIONS.values()) + ["Other changes"]))
    return {
        "commit_count": sum(len(v) for v in sections.values()),
        "sections": {name: sections[name] for name in order if name in sections},
        "breaking_changes": breaking,
        "unparsed_lines": unparsed,
    }


if __name__ == "__main__":
    print(json.dumps(group(sys.stdin.read().splitlines()), indent=2))
