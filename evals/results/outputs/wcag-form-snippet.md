**Quick check: pasted snippet (contact form)** - 4 fails, 6 need manual testing. Not a full audit.

**Checks not run:** `scan_html.py` was not run because no tools are available in this session, so every result below comes from reading the markup. The snippet is a fragment, so page-level checks (`lang` on `<html>`, `<title>`) could not be assessed. CSS and behaviour were not provided.

**Fails**

1. **`<input id="phone">` has no label.** It fails 1.3.1 Info and Relationships and 4.1.2 Name, Role, Value. The `<h3>Phone</h3>` above it is not programmatically associated with the input. Screen reader users hear "edit text" with no purpose, and voice control users cannot target the field by name. The field also lacks an input purpose, which fails 1.3.5 Identify Input Purpose, so autofill and personalisation tools cannot help.
   Fix: replace the heading with a real label, and add `type` and `autocomplete`:
   ```html
   <label for="phone">Phone number</label>
   <input id="phone" name="phone" type="tel" autocomplete="tel">
   ```

2. **`<a href="/help"></a>` is an empty link.** It fails 2.4.4 Link Purpose (In Context) and 4.1.2 Name, Role, Value. Keyboard users land on an invisible focus stop. Screen readers announce "link" or read out the URL, with no indication of where it goes.
   Fix: give it visible text, or remove it if it is a leftover:
   ```html
   <a href="/help">Help with contacting us</a>
   ```
   If the link wraps an icon, use visible text if possible. Otherwise give the icon image a meaningful `alt` rather than adding `aria-label`.

3. **`<button tabindex="3">` uses a positive `tabindex`.** It fails 2.4.3 Focus Order. A positive value takes the button out of the natural order, so it receives focus before every element with `tabindex="0"` or no tabindex, anywhere on the page. Keyboard and screen reader users get a confusing focus sequence.
   Fix: remove the attribute. Native buttons are already focusable in DOM order:
   ```html
   <button type="submit">Send message</button>
   ```

4. **The heading levels skip from `<h1>` to `<h3>`, and the heading is doing a label's job.** This falls under 1.3.1 Info and Relationships. Screen reader users navigating by headings may think content is missing. Here the `<h3>` is really a form label, so finding 1 fixes this too. If you do need a sub-heading, use `<h2>`. For grouping several related fields, prefer `<fieldset>` with `<legend>`.

**Advisory (not a fail)**
- The button text "Go" is vague. It is a valid accessible name, but "Send message" better meets the intent of 2.4.6 Headings and Labels. Adding an explicit `type="submit"` also makes the intent clear.

**Needs manual testing** (cannot be confirmed from this markup)
- **1.4.3 Contrast (Minimum) and 1.4.11 Non-text Contrast:** check text contrast is at least 4.5:1. The input border and focus indicator need at least 3:1. No CSS was provided.
- **2.4.7 Focus Visible and 2.4.11 Focus Not Obscured (Minimum):** check the focus outline is not removed, and that no sticky header or banner hides focused elements.
- **2.5.8 Target Size (Minimum):** check the link and button are at least 24 by 24 CSS px, or spaced apart enough.
- **1.4.10 Reflow:** check the form at 320 CSS px wide.
- **3.3.1 Error Identification and 3.3.3 Error Suggestion:** no validation or error handling is visible. If the phone number is validated, errors must be shown in text, linked to the field with `aria-describedby`, and an error summary should receive focus.
- **Screen reader announcements:** confirm the label, link and button names are read as expected.

**Passes checked**
- The `<button>` is a native element with an accessible name, so it is keyboard operable by default (2.1.1 Keyboard).
- There are no images, so 1.1.1 Non-text Content does not apply to this snippet.
- No ARIA is used, so there is no ARIA misuse.

**Corrected snippet**
```html
<form>
  <h1>Contact</h1>
  <label for="phone">Phone number</label>
  <input id="phone" name="phone" type="tel" autocomplete="tel">
  <p><a href="/help">Help with contacting us</a></p>
  <button type="submit">Send message</button>
</form>
```

Before release, run `scan_html.py` on the full page and test with keyboard only and at least one screen reader (for example NVDA with Firefox on Windows, or VoiceOver with Safari).
