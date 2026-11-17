"""Tests for scripts/usage_report.py. Run from the repo root: python -m unittest"""

import json
import unittest
from pathlib import Path

from scripts import make_sample_log, usage_report

ROOT = Path(__file__).resolve().parent.parent


def event(**overrides):
    base = {
        "ts": "2026-11-02T10:00:00Z",  # Monday, ISO week 45
        "user": "u-001",
        "team": "Team Kestrel",
        "tool": "claude-code",
        "skill": "user-story-writer",
        "input_tokens": 1_000_000,
        "output_tokens": 100_000,
        "outcome": "accepted",
    }
    base.update(overrides)
    return base


class BuildReportTests(unittest.TestCase):
    def setUp(self):
        self.rows = [
            event(),
            event(user="u-002", outcome="edited"),
            event(user="u-002", ts="2026-11-09T09:00:00Z", skill=None, outcome="rejected"),
            event(user="u-003", team="Platform", skill="pr-review-checklist", outcome="accepted"),
        ]
        self.report = usage_report.build_report(self.rows, input_rate=3.0, output_rate=15.0)

    def test_totals_and_cost(self):
        totals = self.report["totals"]
        self.assertEqual(totals["events"], 4)
        self.assertEqual(totals["active_users"], 3)
        # 4M input * 3 + 0.4M output * 15 = 12 + 6
        self.assertEqual(totals["estimated_cost"], 18.0)
        self.assertEqual(totals["acceptance_rate"], 0.5)
        self.assertEqual(totals["accepted_or_edited_rate"], 0.75)
        self.assertEqual(totals["skill_share"], 0.75)

    def test_weekly_active_users_by_team(self):
        weeks = self.report["weekly_active_users"]
        self.assertEqual([w["week"] for w in weeks], ["2026-W45", "2026-W46"])
        self.assertEqual(weeks[0]["total"], 3)
        self.assertEqual(weeks[0]["by_team"], {"Platform": 1, "Team Kestrel": 2})
        self.assertEqual(weeks[1]["by_team"], {"Platform": 0, "Team Kestrel": 1})

    def test_top_skills_exclude_ad_hoc_use(self):
        names = [s["skill"] for s in self.report["top_skills"]]
        self.assertEqual(names, ["user-story-writer", "pr-review-checklist"])
        self.assertEqual(self.report["top_skills"][0]["acceptance_rate"], 0.5)
        self.assertEqual(
            self.report["no_skill"],
            {"events": 1, "acceptance_rate": 0.0, "estimated_cost": 4.5, "cost_per_accepted": None},
        )

    def test_cost_per_accepted_output(self):
        # Each event costs 3.00 + 1.50 = 4.50. user-story-writer: 2 events, 1 accepted.
        story = self.report["top_skills"][0]
        self.assertEqual(story["estimated_cost"], 9.0)
        self.assertEqual(story["cost_per_accepted"], 9.0)
        self.assertEqual(self.report["top_skills"][1]["cost_per_accepted"], 4.5)
        # 18.00 across the log, 2 accepted outputs.
        self.assertEqual(self.report["totals"]["cost_per_accepted"], 9.0)

    def test_rejects_rows_with_personal_data_or_bad_values(self):
        rows = [
            event(),
            event(user="someone@example.com"),
            event(outcome="maybe"),
            event(input_tokens="lots"),
            {"ts": "2026-11-02T10:00:00Z"},
        ]
        report = usage_report.build_report(rows)
        self.assertEqual(report["totals"]["events"], 1)
        self.assertEqual(report["totals"]["rejected_rows"], 4)
        self.assertNotIn("example.com", json.dumps(report))

    def test_empty_log(self):
        report = usage_report.build_report([])
        self.assertEqual(report["totals"]["events"], 0)
        self.assertEqual(report["totals"]["acceptance_rate"], 0.0)
        self.assertIsNone(report["period"]["start"])
        self.assertIsNone(report["totals"]["cost_per_accepted"])


class CsvInputTests(unittest.TestCase):
    def test_reads_csv_with_blank_skill(self):
        import tempfile

        header = ",".join(usage_report.REQUIRED)
        body = "2026-11-02T10:00:00Z,u-001,Platform,claude-code,,1200,300,edited"
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "log.csv"
            path.write_text(f"{header}\n{body}\n", encoding="utf-8")
            report = usage_report.build_report(usage_report.read_rows(path))
        self.assertEqual(report["totals"]["events"], 1)
        self.assertEqual(report["no_skill"]["events"], 1)
        self.assertEqual(report["outcomes"]["edited"], 1)


class SampleDataTests(unittest.TestCase):
    def test_committed_log_matches_generator(self):
        lines = (ROOT / "data" / "usage-log.jsonl").read_text(encoding="utf-8").splitlines()
        self.assertEqual([json.loads(l) for l in lines], make_sample_log.generate())

    def test_committed_metrics_match_script_output(self):
        rows = usage_report.read_rows(ROOT / "data" / "usage-log.jsonl")
        fresh = usage_report.build_report(rows)
        committed = json.loads((ROOT / "data" / "adoption-metrics.json").read_text(encoding="utf-8"))
        self.assertEqual(committed, fresh)


if __name__ == "__main__":
    unittest.main()
