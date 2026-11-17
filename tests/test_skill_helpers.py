"""Tests for the helper scripts that ship inside skills/. Run from the repo root: python -m unittest"""

import importlib.util
import unittest
from pathlib import Path

SKILLS = Path(__file__).resolve().parent.parent / "skills"


def load(relative: str):
    path = SKILLS / relative
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


group_commits = load("release-notes-drafter/group_commits.py")
scan_html = load("wcag-quick-check/scan_html.py")


class GroupCommitsTests(unittest.TestCase):
    def test_groups_by_conventional_prefix_and_keeps_only_real_ticket_keys(self):
        result = group_commits.group([
            "a1b2c3d feat(apply): send confirmation email LNT-107",
            "d4e5f6a fix: reject impossible dates (LNT-108)",
            "0f1e2d3 chore: bump pdf library",
            "9a8b7c6 feat!: drop the legacy upload endpoint",
            "1234567 tidy things up",
            "not a log line",
        ])
        self.assertEqual(result["commit_count"], 5)
        self.assertEqual(list(result["sections"]), ["New features", "Bug fixes", "Internal changes", "Other changes"])
        first = result["sections"]["New features"][0]
        self.assertEqual(first["tickets"], ["LNT-107"])
        self.assertEqual(first["scope"], "apply")
        self.assertEqual(result["sections"]["Internal changes"][0]["tickets"], [])
        self.assertEqual(result["breaking_changes"], ["9a8b7c6"])
        self.assertEqual(result["unparsed_lines"], ["not a log line"])

    def test_empty_log(self):
        self.assertEqual(group_commits.group([])["commit_count"], 0)


class ScanHtmlTests(unittest.TestCase):
    def test_flags_common_failures(self):
        html = """<html><head></head><body>
<h1>Apply</h1>
<h3>Your details</h3>
<img src="crest.png">
<input id="email" type="email">
<a href="/next"></a>
<button tabindex="2"><img src="x.svg" alt=""></button>
</body></html>"""
        criteria = sorted(f["criterion"].split(" ")[0] for f in scan_html.scan(html))
        self.assertEqual(criteria, ["1.1.1", "1.3.1", "1.3.1", "1.3.5", "2.4.2", "2.4.3", "2.4.4", "3.1.1", "4.1.2"])

    def test_clean_page_has_no_findings(self):
        html = """<html lang="en"><head><title>Contact - Apply</title></head><body>
<h1>Contact details</h1>
<h2>Email</h2>
<label for="email">Email address</label>
<input id="email" type="email" autocomplete="email">
<label>Postcode <input name="postcode" autocomplete="postal-code"></label>
<a href="/next">Continue</a>
<button aria-label="Close"><svg></svg></button>
<img src="logo.png" alt="">
</body></html>"""
        self.assertEqual(scan_html.scan(html), [])


if __name__ == "__main__":
    unittest.main()
