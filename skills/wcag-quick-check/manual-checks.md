# Manual checks (WCAG 2.2 AA subset)

Checks a script cannot decide. Review each one by reading the markup and, where possible, using the page.

| Check | Success criterion |
|-------|-------------------|
| Alt text describes the purpose of the image; decorative images use `alt=""` | 1.1.1 Non-text Content |
| Headings and lists reflect the visual structure | 1.3.1 Info and Relationships |
| Text contrast at least 4.5:1 (3:1 for large text and UI component boundaries) | 1.4.3 Contrast (Minimum), 1.4.11 Non-text Contrast |
| Content reflows at 320 CSS px wide without horizontal scrolling | 1.4.10 Reflow |
| Everything works with a keyboard and there is no keyboard trap | 2.1.1 Keyboard, 2.1.2 No Keyboard Trap |
| Focus order follows the visual order | 2.4.3 Focus Order |
| Link text makes sense out of context, or with its sentence | 2.4.4 Link Purpose (In Context) |
| Focus is visible and not hidden behind sticky headers or banners | 2.4.7 Focus Visible, 2.4.11 Focus Not Obscured (Minimum) |
| Drag actions have a single-pointer alternative | 2.5.7 Dragging Movements |
| Click/tap targets are at least 24 by 24 CSS px, or spaced apart | 2.5.8 Target Size (Minimum) |
| Errors are identified in text, linked to the field, and the summary receives focus | 3.3.1 Error Identification, 3.3.3 Error Suggestion |
| Users are not asked to re-enter information already given in the same process | 3.3.7 Redundant Entry |
| Login does not rely on a cognitive test such as remembering or transcribing a code without paste | 3.3.8 Accessible Authentication (Minimum) |
| Status messages (e.g. "3 results") are announced without moving focus | 4.1.3 Status Messages |
