"""Run the skills against fixed cases and grade the output. Standard library only.

    python -m evals.run_evals            # re-grade the saved outputs (offline, runs in CI)
    python -m evals.run_evals --live     # generate fresh outputs with Claude Code, then grade
    python -m evals.run_evals --live --only <case-id>    # try one case, save nothing

--live sends each case to `claude -p` with the skill's SKILL.md and supporting
files as instructions, tools switched off, and records the model, tokens and
cost that Claude Code reports. Outputs are saved under evals/results/outputs/
so a reviewer can read exactly what was graded, and grading can be repeated
without a model call.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

from evals.graders import grade

ROOT = Path(__file__).resolve().parent.parent
CASES = ROOT / "evals" / "cases.json"
RESULTS = ROOT / "evals" / "results"
OUTPUTS = RESULTS / "outputs"
LATEST = RESULTS / "latest.json"


def load_cases() -> list[dict]:
    return json.loads(CASES.read_text(encoding="utf-8"))


def build_prompt(case: dict) -> str:
    """The skill's instructions and supporting files, then the user's request."""
    folder = ROOT / "skills" / case["skill"]
    parts = [f"You are running the `{case['skill']}` skill. Follow these instructions exactly.", ""]
    parts.append((folder / "SKILL.md").read_text(encoding="utf-8"))
    for extra in sorted(folder.glob("*.md")):
        if extra.name != "SKILL.md":
            parts += ["", f"--- {extra.name} ---", extra.read_text(encoding="utf-8")]
    parts += [
        "",
        "No tools or MCP servers are connected in this run, so work from the text you are given.",
        "",
        "--- User request ---",
        case["input"],
    ]
    return "\n".join(parts)


def run_live(case: dict, model: str | None, timeout: int = 300) -> dict:
    """One model call through the Claude Code CLI, isolated from local settings."""
    exe = shutil.which("claude")
    if not exe:
        raise SystemExit("claude was not found on PATH; install Claude Code or run without --live")
    cmd = [exe, "-p", "--output-format", "json", "--tools", "", "--setting-sources", "",
           "--strict-mcp-config", "--no-session-persistence"]
    if model:
        cmd += ["--model", model]
    with tempfile.TemporaryDirectory() as cwd:  # a clean folder, so no project instructions leak in
        done = subprocess.run(cmd, input=build_prompt(case), capture_output=True, text=True,
                              encoding="utf-8", cwd=cwd, timeout=timeout)
    start = done.stdout.find("{")
    if done.returncode != 0 or start < 0:
        raise SystemExit(f"claude failed for {case['id']}: {done.stderr.strip()[:300]}")
    reply = json.loads(done.stdout[start:])
    usage = reply.get("usage", {})
    return {
        "output": reply.get("result", ""),
        "model": ", ".join(sorted(reply.get("modelUsage", {}))) or "unknown",
        "input_tokens": usage.get("input_tokens", 0) + usage.get("cache_creation_input_tokens", 0)
        + usage.get("cache_read_input_tokens", 0),
        "output_tokens": usage.get("output_tokens", 0),
        "cost_usd": round(reply.get("total_cost_usd", 0.0), 4),
        "seconds": round(reply.get("duration_ms", 0) / 1000, 1),
    }


def summarise(cases: list[dict], run: dict | None = None, outputs: dict[str, str] | None = None) -> dict:
    """Grade each case's output: the saved file, or the text in `outputs` if given.

    `run` carries the facts of a live run, if there was one.
    """
    results = []
    for case in cases:
        path = OUTPUTS / f"{case['id']}.md"
        if outputs is None and not path.is_file():
            results.append({"id": case["id"], "skill": case["skill"], "tests": case["tests"], "status": "no output saved", "checks": []})
            continue
        checks = grade(case, outputs[case["id"]] if outputs is not None else path.read_text(encoding="utf-8"))
        results.append({
            "id": case["id"],
            "skill": case["skill"],
            "tests": case["tests"],
            "status": "pass" if all(c["passed"] for c in checks) else "fail",
            "checks": checks,
        })
    graded = [r for r in results if r["checks"]]
    return {
        "schema": "skill-evals/v1",
        "run": run,
        "totals": {
            "cases": len(results),
            "cases_passed": sum(r["status"] == "pass" for r in results),
            "checks": sum(len(r["checks"]) for r in graded),
            "checks_passed": sum(c["passed"] for r in graded for c in r["checks"]),
        },
        "results": results,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--live", action="store_true", help="generate fresh outputs with `claude -p` before grading")
    parser.add_argument("--model", help="model alias or id to pass to claude (default: the CLI's default)")
    parser.add_argument("--only", help="with --live: try one case id, print its output and grades, save nothing")
    args = parser.parse_args(argv)

    if args.only and not args.live:
        parser.error("--only needs --live")
    cases = [c for c in load_cases() if not args.only or c["id"] == args.only]
    if not cases:
        parser.error(f"no case with id {args.only!r}")
    previous = json.loads(LATEST.read_text(encoding="utf-8")) if LATEST.is_file() else {}
    run = previous.get("run")
    trial: dict[str, str] | None = None

    if args.live:
        per_case = {}
        texts = {}
        for case in cases:
            print(f"running {case['id']} ...", flush=True)
            live = run_live(case, args.model)
            texts[case["id"]] = live.pop("output").strip() + "\n"
            per_case[case["id"]] = live
        if args.only:
            trial = texts
            print(texts[args.only])
            print(json.dumps(per_case[args.only]))
        else:
            OUTPUTS.mkdir(parents=True, exist_ok=True)
            for case_id, text in texts.items():
                (OUTPUTS / f"{case_id}.md").write_text(text, encoding="utf-8", newline="\n")
        run = {
            "date": date.today().isoformat(),
            "runner": "claude -p, tools off, one attempt per case",
            "model": ", ".join(sorted({v["model"] for v in per_case.values()})),
            "input_tokens": sum(v["input_tokens"] for v in per_case.values()),
            "output_tokens": sum(v["output_tokens"] for v in per_case.values()),
            "cost_usd": round(sum(v["cost_usd"] for v in per_case.values()), 4),
            "per_case": per_case,
        }

    report = summarise(cases, run, trial)
    if not args.only:
        RESULTS.mkdir(parents=True, exist_ok=True)
        LATEST.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8", newline="\n")

    for r in report["results"]:
        print(f"{r['status']:<16} {r['id']}")
        for c in r["checks"]:
            for failure in c["failures"]:
                print(f"                   - {c['check']}: {failure}")
    t = report["totals"]
    print(f"{t['cases_passed']} of {t['cases']} cases pass ({t['checks_passed']} of {t['checks']} checks)")
    return 0 if t["cases_passed"] == t["cases"] else 1


if __name__ == "__main__":
    sys.exit(main())
