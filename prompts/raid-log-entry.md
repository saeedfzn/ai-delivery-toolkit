# RAID log entry

**When to use:** someone raises a concern in a meeting and it needs recording as a Risk, Assumption, Issue or Dependency.

**Inputs:**
- `{{concern}}`: what was said, with personal data removed.
- `{{context}}`: the project or workstream.

## Prompt

```text
Turn this concern into a RAID log entry for {{context}}.

Concern: {{concern}}

1. Classify it as Risk (might happen), Assumption (we are relying on it), Issue (has happened) or Dependency (needs someone else). Explain the choice in one line.
2. Write: Title; Description (cause, event, effect); Impact (High/Medium/Low) with reason; Likelihood (risks only); Proposed mitigation or action; Owner (role, or "to be agreed"); Review date ("to be agreed" unless one was stated).
Do not invent owners, dates or numbers.
```

## Example

Input: "If the DPIA isn't signed off by the 20th, the notes feature slips to the next release."

Output: **Risk** - "Caseworker notes delayed by DPIA approval". Impact Medium (one feature, one release). Mitigation: agree a decision date with the data protection officer; prepare a release without notes. Owner: delivery manager (to be agreed).
