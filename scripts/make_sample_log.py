"""Generate the fictional, anonymised AI-tool usage log used by the demo.

The output is deterministic (fixed seed), so the committed log, the committed
metrics JSON and the dashboard always agree. Users are pseudonymous tokens
(u-001 ...); there are no names, emails or free text in the log.

    python scripts/make_sample_log.py            # writes data/usage-log.jsonl
"""

from __future__ import annotations

import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "usage-log.jsonl"

SEED = 20261117
START = datetime(2026, 10, 5, tzinfo=timezone.utc)  # Monday of ISO week 41
WEEKS = 6

# team -> (headcount, how quickly the team adopts, 0..1)
TEAMS = {
    "Team Kestrel": (9, 0.9),
    "Team Heron": (8, 0.7),
    "Platform": (6, 0.8),
    "Service Design": (7, 0.45),
}

SKILLS = {
    "user-story-writer": 0.22,
    "pr-review-checklist": 0.2,
    "release-notes-drafter": 0.08,
    "meeting-notes-to-jira": 0.14,
    "wcag-quick-check": 0.11,
    None: 0.25,  # ad hoc prompting, no skill
}

TOOLS = {"claude-code": 0.65, "chat-assistant": 0.35}

# Probability of each outcome, per skill. Structured skills get accepted more often.
OUTCOMES = {
    "user-story-writer": (0.62, 0.30, 0.08),
    "pr-review-checklist": (0.70, 0.22, 0.08),
    "release-notes-drafter": (0.55, 0.38, 0.07),
    "meeting-notes-to-jira": (0.50, 0.38, 0.12),
    "wcag-quick-check": (0.66, 0.24, 0.10),
    None: (0.38, 0.37, 0.25),
}


def pick(rng: random.Random, weights: dict):
    keys = list(weights)
    return rng.choices(keys, weights=[weights[k] for k in keys])[0]


def generate() -> list[dict]:
    rng = random.Random(SEED)
    events: list[dict] = []
    user_no = 0
    for team, (headcount, speed) in TEAMS.items():
        users = [f"u-{user_no + i + 1:03d}" for i in range(headcount)]
        user_no += headcount
        for week in range(WEEKS):
            # Adoption ramps up over the six weeks, faster for some teams.
            share_active = min(1.0, 0.25 + speed * week / (WEEKS - 1) * 0.75)
            for user in users:
                if rng.random() > share_active:
                    continue
                for _ in range(rng.randint(2, 9)):
                    skill = pick(rng, SKILLS)
                    accepted, edited, _rejected = OUTCOMES[skill]
                    roll = rng.random()
                    outcome = "accepted" if roll < accepted else "edited" if roll < accepted + edited else "rejected"
                    ts = START + timedelta(
                        days=week * 7 + rng.randint(0, 4),
                        hours=rng.randint(8, 17),
                        minutes=rng.randint(0, 59),
                    )
                    events.append(
                        {
                            "ts": ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
                            "user": user,
                            "team": team,
                            "tool": pick(rng, TOOLS),
                            "skill": skill,
                            "input_tokens": rng.randint(800, 9000),
                            "output_tokens": rng.randint(150, 2200),
                            "outcome": outcome,
                        }
                    )
    events.sort(key=lambda e: (e["ts"], e["user"]))
    return events


def main() -> None:
    events = generate()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="\n") as fh:
        for e in events:
            fh.write(json.dumps(e) + "\n")
    print(f"Wrote {len(events)} events to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
