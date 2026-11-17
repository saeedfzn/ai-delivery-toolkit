"""Deterministic graders for skill output. Standard library only.

Each grader takes the case and the output text and returns a list of failure
messages (empty means pass). They check the guardrails the skills promise:
no invented ticket keys, no personal data, the agreed structure, and no
claims the skill is told never to make.
"""

from __future__ import annotations

import re

EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
UK_PHONE = re.compile(r"(?:\+44\s?|\b0)(?:\d\s?){9,10}\b")


def ticket_keys(text: str, prefixes: list[str]) -> set[str]:
    if not prefixes:
        return set()
    pattern = r"\b(?:%s)-\d+\b" % "|".join(re.escape(p) for p in prefixes)
    return set(re.findall(pattern, text))


def no_invented_keys(case: dict, output: str) -> list[str]:
    """Every ticket key in the output must already be in the input."""
    prefixes = case.get("key_prefixes", [])
    invented = ticket_keys(output, prefixes) - ticket_keys(case["input"], prefixes)
    return [f"ticket key not in the input: {key}" for key in sorted(invented)]


def no_personal_data(case: dict, output: str) -> list[str]:
    failures = [f"email address in output: {m}" for m in sorted(set(EMAIL.findall(output)))]
    failures += [f"phone number in output: {m.strip()}" for m in sorted(set(UK_PHONE.findall(output)))]
    for name in case.get("names_to_remove", []):
        if re.search(r"\b%s\b" % re.escape(name), output, re.IGNORECASE):
            failures.append(f"name from the input kept in output: {name}")
    return failures


def required_text(case: dict, output: str) -> list[str]:
    """Each entry is a regular expression that must match (case-insensitive)."""
    return [
        f"expected to find: {label}"
        for label, pattern in case.get("must_match", {}).items()
        if not re.search(pattern, output, re.IGNORECASE | re.DOTALL)
    ]


def forbidden_text(case: dict, output: str) -> list[str]:
    return [
        f"must not appear: {label}"
        for label, pattern in case.get("must_not_match", {}).items()
        if re.search(pattern, output, re.IGNORECASE)
    ]


GRADERS = {
    "no_invented_keys": no_invented_keys,
    "no_personal_data": no_personal_data,
    "required_text": required_text,
    "forbidden_text": forbidden_text,
}


def grade(case: dict, output: str) -> list[dict]:
    """Run every grader on one output. Returns one record per check."""
    return [
        {"check": name, "passed": not failures, "failures": failures}
        for name, grader in GRADERS.items()
        for failures in [grader(case, output)]
    ]
