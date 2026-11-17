"""Turn an anonymised AI-tool usage log into adoption metrics JSON.

Standard library only. Reads JSONL or CSV with these fields per event:

    ts, user, team, tool, skill, input_tokens, output_tokens, outcome

`user` must be a pseudonymous token such as u-014; rows that look like they
carry an email address are rejected so personal data never reaches the report.
Output: weekly active users by team, top skills, acceptance rate, token totals,
estimated cost, and cost per accepted output for each skill.

    python scripts/usage_report.py data/usage-log.jsonl --out data/adoption-metrics.json

Cost is an ESTIMATE from configurable per-million-token rates. The defaults are
illustrative placeholders, not a quoted price; set the rates your contract uses.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Iterable, Iterator

DEFAULT_INPUT_RATE = 3.00  # currency units per million input tokens (illustrative)
DEFAULT_OUTPUT_RATE = 15.00  # currency units per million output tokens (illustrative)
OUTCOMES = ("accepted", "edited", "rejected")
REQUIRED = ("ts", "user", "team", "tool", "skill", "input_tokens", "output_tokens", "outcome")
PSEUDONYM = re.compile(r"^u-\d{3,}$")
NO_SKILL = "(no skill)"


class LogError(ValueError):
    """Raised for a row that cannot be used."""


def read_rows(path: Path) -> Iterator[dict]:
    """Yield raw rows from a .jsonl or .csv file."""
    if path.suffix.lower() == ".csv":
        with path.open(encoding="utf-8", newline="") as fh:
            yield from csv.DictReader(fh)
        return
    with path.open(encoding="utf-8") as fh:
        for line_no, line in enumerate(fh, start=1):
            if line.strip():
                try:
                    yield json.loads(line)
                except json.JSONDecodeError as exc:
                    yield {"_error": f"line {line_no}: invalid JSON ({exc.msg})"}


def clean(row: dict) -> dict:
    """Validate and normalise one event, raising LogError if it is unusable."""
    if "_error" in row:
        raise LogError(row["_error"])
    missing = [k for k in REQUIRED if k not in row]
    if missing:
        raise LogError(f"missing fields: {', '.join(missing)}")
    user = str(row["user"]).strip()
    if not PSEUDONYM.match(user):
        raise LogError("user is not a pseudonymous token (expected u-NNN)")
    outcome = str(row["outcome"]).strip().lower()
    if outcome not in OUTCOMES:
        raise LogError(f"unknown outcome {outcome!r}")
    try:
        ts = datetime.fromisoformat(str(row["ts"]).replace("Z", "+00:00"))
        input_tokens = int(row["input_tokens"])
        output_tokens = int(row["output_tokens"])
    except (TypeError, ValueError) as exc:
        raise LogError(f"bad timestamp or token count ({exc})") from None
    if input_tokens < 0 or output_tokens < 0:
        raise LogError("token counts cannot be negative")
    skill = row["skill"]
    skill = NO_SKILL if skill in (None, "", "null", "None") else str(skill).strip()
    year, week, _ = ts.isocalendar()
    return {
        "week": f"{year}-W{week:02d}",
        "date": ts.date().isoformat(),
        "user": user,
        "team": str(row["team"]).strip(),
        "tool": str(row["tool"]).strip(),
        "skill": skill,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "outcome": outcome,
    }


def cost(input_tokens: int, output_tokens: int, input_rate: float, output_rate: float) -> float:
    return round(input_tokens / 1_000_000 * input_rate + output_tokens / 1_000_000 * output_rate, 2)


def rate(part: int, whole: int) -> float:
    return round(part / whole, 3) if whole else 0.0


def per_accepted(total_cost: float, accepted: int) -> float | None:
    """Estimated cost of each output that was accepted as-is; None when nothing was accepted."""
    return round(total_cost / accepted, 3) if accepted else None


def build_report(
    rows: Iterable[dict],
    input_rate: float = DEFAULT_INPUT_RATE,
    output_rate: float = DEFAULT_OUTPUT_RATE,
    currency: str = "GBP",
    top_n: int = 5,
) -> dict:
    events: list[dict] = []
    rejected: Counter = Counter()
    for row in rows:
        try:
            events.append(clean(row))
        except LogError as exc:
            # Keep only the reason category, never the row content.
            rejected[str(exc).split(" (")[0]] += 1

    weekly_users: dict[str, dict[str, set]] = defaultdict(lambda: defaultdict(set))
    teams: dict[str, dict] = defaultdict(lambda: {"events": 0, "users": set(), "in": 0, "out": 0, "outcomes": Counter()})
    skills: dict[str, dict] = defaultdict(lambda: {"events": 0, "users": set(), "in": 0, "out": 0, "outcomes": Counter()})
    tools: Counter = Counter()
    outcomes: Counter = Counter()
    for e in events:
        weekly_users[e["week"]][e["team"]].add(e["user"])
        t = teams[e["team"]]
        t["events"] += 1
        t["users"].add(e["user"])
        t["in"] += e["input_tokens"]
        t["out"] += e["output_tokens"]
        t["outcomes"][e["outcome"]] += 1
        s = skills[e["skill"]]
        s["events"] += 1
        s["users"].add(e["user"])
        s["in"] += e["input_tokens"]
        s["out"] += e["output_tokens"]
        s["outcomes"][e["outcome"]] += 1
        tools[e["tool"]] += 1
        outcomes[e["outcome"]] += 1

    team_names = sorted(teams)
    total_in = sum(e["input_tokens"] for e in events)
    total_out = sum(e["output_tokens"] for e in events)
    dates = sorted(e["date"] for e in events)

    no_skill = skills.pop(NO_SKILL, {"events": 0, "users": set(), "in": 0, "out": 0, "outcomes": Counter()})
    total_cost = cost(total_in, total_out, input_rate, output_rate)

    def skill_cost(s: dict) -> dict:
        estimated = cost(s["in"], s["out"], input_rate, output_rate)
        return {"estimated_cost": estimated, "cost_per_accepted": per_accepted(estimated, s["outcomes"]["accepted"])}

    ranked_skills = sorted(
        skills.items(),
        key=lambda item: (-item[1]["events"], item[0]),
    )

    return {
        "schema": "adoption-metrics/v1",
        "period": {"start": dates[0] if dates else None, "end": dates[-1] if dates else None},
        "assumptions": {
            "currency": currency,
            "input_rate_per_million_tokens": input_rate,
            "output_rate_per_million_tokens": output_rate,
            "note": "Estimated cost uses illustrative rates. Replace them with your contracted rates.",
            "acceptance_rate": "accepted / all events; edited outputs are counted separately",
            "cost_per_accepted": "estimated cost of all events / outputs accepted as-is",
        },
        "totals": {
            "events": len(events),
            "rejected_rows": sum(rejected.values()),
            "active_users": len({e["user"] for e in events}),
            "input_tokens": total_in,
            "output_tokens": total_out,
            "estimated_cost": total_cost,
            "cost_per_accepted": per_accepted(total_cost, outcomes["accepted"]),
            "acceptance_rate": rate(outcomes["accepted"], len(events)),
            "accepted_or_edited_rate": rate(outcomes["accepted"] + outcomes["edited"], len(events)),
            "skill_share": rate(len(events) - no_skill["events"], len(events)),
        },
        "rejected_row_reasons": dict(sorted(rejected.items())),
        "outcomes": {o: outcomes[o] for o in OUTCOMES},
        "tools": dict(sorted(tools.items(), key=lambda kv: (-kv[1], kv[0]))),
        "weekly_active_users": [
            {
                "week": week,
                "total": len(set().union(*by_team.values())),
                "by_team": {team: len(by_team.get(team, ())) for team in team_names},
            }
            for week, by_team in sorted(weekly_users.items())
        ],
        "teams": [
            {
                "team": name,
                "events": teams[name]["events"],
                "active_users": len(teams[name]["users"]),
                "input_tokens": teams[name]["in"],
                "output_tokens": teams[name]["out"],
                "estimated_cost": cost(teams[name]["in"], teams[name]["out"], input_rate, output_rate),
                "acceptance_rate": rate(teams[name]["outcomes"]["accepted"], teams[name]["events"]),
            }
            for name in team_names
        ],
        "top_skills": [
            {
                "skill": name,
                "events": s["events"],
                "users": len(s["users"]),
                "acceptance_rate": rate(s["outcomes"]["accepted"], s["events"]),
                **skill_cost(s),
            }
            for name, s in ranked_skills[:top_n]
        ],
        "no_skill": {
            "events": no_skill["events"],
            "acceptance_rate": rate(no_skill["outcomes"]["accepted"], no_skill["events"]),
            **skill_cost(no_skill),
        },
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("log", type=Path, help="usage log (.jsonl or .csv)")
    parser.add_argument("--out", type=Path, help="write JSON here instead of stdout")
    parser.add_argument("--input-rate", type=float, default=DEFAULT_INPUT_RATE, help="cost per million input tokens")
    parser.add_argument("--output-rate", type=float, default=DEFAULT_OUTPUT_RATE, help="cost per million output tokens")
    parser.add_argument("--currency", default="GBP")
    parser.add_argument("--top", type=int, default=5, help="number of skills to rank")
    args = parser.parse_args(argv)

    if not args.log.exists():
        print(f"error: {args.log} not found", file=sys.stderr)
        return 2
    report = build_report(read_rows(args.log), args.input_rate, args.output_rate, args.currency, args.top)
    text = json.dumps(report, indent=2) + "\n"
    if args.out:
        args.out.write_text(text, encoding="utf-8", newline="\n")
        print(f"Wrote {args.out} ({report['totals']['events']} events, {report['totals']['rejected_rows']} rejected rows)")
    else:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
