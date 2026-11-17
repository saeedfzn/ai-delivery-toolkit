"""Tests for the skill linter and the eval graders. Run from the repo root: python -m unittest"""

import json
import tempfile
import unittest
from pathlib import Path

from evals import graders, lint_skills, run_evals

# Hand-written grader fixtures: short strings that exercise each check.
# They are test inputs for the graders, not model output.
CASE = {
    "input": "Notes mention LNT-112. Contact sam.lee@example.com.",
    "key_prefixes": ["LNT"],
    "names_to_remove": ["Sam"],
    "must_match": {"an Actions section": "actions"},
    "must_not_match": {"a compliance claim": "is WCAG compliant"},
}


class GraderTests(unittest.TestCase):
    def test_clean_output_passes_every_check(self):
        checks = graders.grade(CASE, "## Actions\n1. Paging - see LNT-112. Owner: platform lead.")
        self.assertEqual([c["check"] for c in checks], list(graders.GRADERS))
        self.assertTrue(all(c["passed"] for c in checks))

    def test_invented_ticket_key_fails(self):
        failures = graders.no_invented_keys(CASE, "Actions: LNT-112 and LNT-431")
        self.assertEqual(failures, ["ticket key not in the input: LNT-431"])

    def test_other_hyphenated_codes_are_not_ticket_keys(self):
        self.assertEqual(graders.no_invented_keys(CASE, "Encoded as UTF-8, hashed with SHA-256."), [])

    def test_personal_data_fails(self):
        failures = graders.no_personal_data(CASE, "Ask Sam (sam.lee@example.com, 07700 900123).")
        self.assertEqual(len(failures), 3)

    def test_required_and_forbidden_text(self):
        self.assertEqual(graders.required_text(CASE, "Decisions only"), ["expected to find: an Actions section"])
        self.assertEqual(graders.forbidden_text(CASE, "This page is WCAG compliant."), ["must not appear: a compliance claim"])


class LintTests(unittest.TestCase):
    def test_every_skill_in_the_repo_passes(self):
        report = lint_skills.lint_all()
        self.assertEqual(len(report), 5)
        self.assertEqual({name: problems for name, problems in report.items() if problems}, {})

    def test_reports_what_is_wrong_with_a_broken_skill(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "status-helper"
            folder.mkdir()
            (folder / "SKILL.md").write_text(
                "---\nname: StatusHelper\ndescription: Writes status updates.\n---\n\n## Steps\n\n1. See `missing.md`.\n",
                encoding="utf-8",
            )
            problems = lint_skills.lint_skill(folder)
        self.assertEqual(len(problems), 5)
        self.assertTrue(any("does not match folder" in p for p in problems))
        self.assertTrue(any("missing.md" in p for p in problems))

    def test_frontmatter_must_start_on_the_first_line(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "late-frontmatter"
            folder.mkdir()
            (folder / "SKILL.md").write_text("\n---\nname: late-frontmatter\n---\n", encoding="utf-8")
            self.assertEqual(len(lint_skills.lint_skill(folder)), 1)


class SavedRunTests(unittest.TestCase):
    """The committed results must be what the graders give for the committed outputs."""

    def test_every_case_names_a_real_skill_and_has_a_saved_output(self):
        cases = run_evals.load_cases()
        self.assertEqual(len({c["id"] for c in cases}), len(cases))
        for case in cases:
            self.assertTrue((run_evals.ROOT / "skills" / case["skill"] / "SKILL.md").is_file(), case["skill"])
            self.assertTrue((run_evals.OUTPUTS / f"{case['id']}.md").is_file(), case["id"])

    def test_committed_results_match_a_fresh_grading(self):
        committed = json.loads(run_evals.LATEST.read_text(encoding="utf-8"))
        fresh = run_evals.summarise(run_evals.load_cases(), committed["run"])
        self.assertEqual(committed, fresh)

    def test_prompt_carries_the_skill_and_its_supporting_files(self):
        case = next(c for c in run_evals.load_cases() if c["skill"] == "user-story-writer")
        prompt = run_evals.build_prompt(case)
        self.assertIn("name: user-story-writer", prompt)
        self.assertIn("--- template.md ---", prompt)
        self.assertTrue(prompt.rstrip().endswith(case["input"]))


if __name__ == "__main__":
    unittest.main()
