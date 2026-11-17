---
name: wcag-quick-check
description: Run a fast accessibility check of an HTML file, template or component against a focused subset of WCAG 2.2 AA, combining an automated scan with a manual review, and report issues with the success criterion and a fix. Use when asked to "check accessibility", "is this WCAG compliant", or before raising a PR that changes UI.
---

# WCAG 2.2 quick check

A first-pass check that catches the most common failures in minutes. It is not a full audit and must not be reported as one.

## Inputs

- One or more HTML files, templates (Nunjucks, JSX, Razor) or a local URL.

## Steps

1. Run `scan_html.py`, which ships in this skill's folder (Claude Code fills in `${CLAUDE_SKILL_DIR}`; use `python3` or `py -3` if `python` is not on your PATH), on each HTML file:

   ```bash
   python "${CLAUDE_SKILL_DIR}/scan_html.py" path/to/page.html
   ```

   It checks things that can be checked mechanically: missing `lang`, images without `alt`, inputs without labels, empty links and buttons, skipped heading levels, missing page title, positive `tabindex`, and `autocomplete` on common personal fields.

2. Then review the source by hand against the items in `manual-checks.md` that a script cannot judge (meaningful alt text, focus order, error handling, colour contrast, target size, reflow at 320 CSS px).
3. For templates or JSX, read the markup directly; the scanner only parses plain HTML.
4. Report every issue with: location, the WCAG 2.2 success criterion (number and name), the impact on users, and a concrete fix with corrected markup.
5. Group as **Fails**, **Needs manual testing** (cannot be confirmed from code, such as screen reader announcements), and **Passes checked**.

## Guardrails

- **Never state that a page "is WCAG compliant" or "passes WCAG".** Say which checks were run and which were not.
- Name the success criterion precisely (for example "2.4.11 Focus Not Obscured (Minimum)"). If unsure of the number, give the name and say so.
- Recommend native HTML before ARIA. Do not suggest ARIA that duplicates native semantics.
- Recommend testing with at least one screen reader and keyboard only before release.

## Output

```markdown
**Quick check: apply/contact.html** - 3 fails, 2 need manual testing. Not a full audit.

**Fails**
1. Line 42 `<input id="phone">` has no label. 1.3.1 Info and Relationships, 4.1.2 Name, Role, Value. Screen reader users hear "edit text" with no purpose.
   Fix: `<label for="phone">UK phone number</label>` and add `autocomplete="tel"` (1.3.5 Identify Input Purpose).
```
