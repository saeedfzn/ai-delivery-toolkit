"""Automated part of the WCAG 2.2 quick check. Standard library only.

    python scan_html.py page.html [more.html ...]

Prints findings as JSON and exits 1 if any were found. This covers only what
can be checked mechanically; see manual-checks.md for the rest.
"""

from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

SKIP_INPUT_TYPES = {"hidden", "submit", "button", "reset", "image"}
PERSONAL_FIELDS = {
    "email": "email",
    "tel": "tel",
    "phone": "tel",
    "postcode": "postal-code",
    "given-name": "given-name",
    "first-name": "given-name",
    "family-name": "family-name",
    "last-name": "family-name",
    "full-name": "name",
}


class Scanner(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.findings: list[dict] = []
        self.has_lang = False
        self.title_text = ""
        self.in_title = False
        self.label_for: set[str] = set()
        self.label_depth = 0
        self.fields: list[tuple[int, dict, bool]] = []  # (line, attrs, wrapped in label)
        self.last_heading = 0
        self.open_named: list[dict] = []  # links/buttons waiting for accessible text

    def add(self, line: int, sc: str, message: str) -> None:
        self.findings.append({"line": line, "criterion": sc, "issue": message})

    def handle_starttag(self, tag: str, attrs_list: list[tuple[str, str | None]]) -> None:
        attrs = {k: (v or "") for k, v in attrs_list}
        line = self.getpos()[0]
        if tag == "html" and attrs.get("lang", "").strip():
            self.has_lang = True
        elif tag == "title":
            self.in_title = True
        elif tag == "img":
            if "alt" not in attrs:
                self.add(line, "1.1.1 Non-text Content", f"<img src=\"{attrs.get('src', '')}\"> has no alt attribute")
            elif self.open_named and attrs["alt"].strip():
                self.open_named[-1]["text"] = True
        elif tag == "label":
            self.label_depth += 1
            if attrs.get("for"):
                self.label_for.add(attrs["for"])
        elif tag in ("input", "select", "textarea"):
            if tag != "input" or attrs.get("type", "text").lower() not in SKIP_INPUT_TYPES:
                self.fields.append((line, attrs, self.label_depth > 0))
        elif re.fullmatch(r"h[1-6]", tag):
            level = int(tag[1])
            if self.last_heading and level > self.last_heading + 1:
                self.add(line, "1.3.1 Info and Relationships", f"<{tag}> follows <h{self.last_heading}>: heading level skipped")
            self.last_heading = level
        elif tag in ("a", "button"):
            labelled = bool(attrs.get("aria-label", "").strip() or attrs.get("aria-labelledby", "").strip())
            if tag == "a" and "href" not in attrs:
                labelled = True  # not a link, nothing to name
            self.open_named.append({"tag": tag, "line": line, "text": labelled})
        if "tabindex" in attrs:
            try:
                if int(attrs["tabindex"]) > 0:
                    self.add(line, "2.4.3 Focus Order", f"<{tag}> has tabindex=\"{attrs['tabindex']}\"; positive tabindex breaks focus order")
            except ValueError:
                pass

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self.in_title = False
        elif tag == "label":
            self.label_depth = max(0, self.label_depth - 1)
        elif tag in ("a", "button") and self.open_named and self.open_named[-1]["tag"] == tag:
            item = self.open_named.pop()
            if not item["text"]:
                kind = "Link" if tag == "a" else "Button"
                sc = "2.4.4 Link Purpose (In Context)" if tag == "a" else "4.1.2 Name, Role, Value"
                self.add(item["line"], sc, f"{kind} has no accessible text")

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_text += data
        if data.strip() and self.open_named:
            self.open_named[-1]["text"] = True

    def finish(self) -> list[dict]:
        if not self.has_lang:
            self.add(1, "3.1.1 Language of Page", "<html> has no lang attribute")
        if not self.title_text.strip():
            self.add(1, "2.4.2 Page Titled", "Page has no <title> text")
        for line, attrs, wrapped in self.fields:
            fid = attrs.get("id", "")
            named = wrapped or (fid and fid in self.label_for) or attrs.get("aria-label", "").strip() or attrs.get("aria-labelledby", "").strip()
            ident = fid or attrs.get("name", "") or "(unnamed)"
            if not named:
                self.add(line, "1.3.1 Info and Relationships / 4.1.2 Name, Role, Value", f"Form field '{ident}' has no associated label")
            key = (attrs.get("type", "") if attrs.get("type") in ("email", "tel") else ident).lower()
            for hint, token in PERSONAL_FIELDS.items():
                if hint in key and "autocomplete" not in attrs:
                    self.add(line, "1.3.5 Identify Input Purpose", f"Field '{ident}' looks personal; add autocomplete=\"{token}\"")
                    break
        return sorted(self.findings, key=lambda f: f["line"])


def scan(html: str) -> list[dict]:
    scanner = Scanner()
    scanner.feed(html)
    scanner.close()
    return scanner.finish()


def main(paths: list[str]) -> int:
    if not paths:
        print(__doc__, file=sys.stderr)
        return 2
    report = {p: scan(Path(p).read_text(encoding="utf-8")) for p in paths}
    print(json.dumps(report, indent=2))
    return 1 if any(report.values()) else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
