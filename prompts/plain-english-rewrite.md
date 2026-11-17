# Plain English rewrite

**When to use:** release notes, decision records or policy text need to be read by people outside the delivery team.

**Inputs:**
- `{{text}}`: the original text.
- `{{reader}}`: who will read it and what they need to do.

## Prompt

```text
Rewrite the text below for {{reader}}.

Rules:
- Keep every fact. Do not add new ones.
- Short sentences (aim for under 20 words). Active voice. Common words.
- Explain or remove acronyms.
- Start with what the reader needs to know or do.
- If the original is ambiguous, keep the ambiguity visible and add a note "Unclear in the original: ...".

Text:
{{text}}
```

## Example

Input: "Queues > 200 items will be paged server-side via keyset pagination subject to index provisioning on the case store."

Output: "Large case queues will load in pages instead of all at once. This needs a change to the case database first, which the platform team owns."
