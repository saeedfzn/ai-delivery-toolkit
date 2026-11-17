# Test cases from acceptance criteria

**When to use:** a story is ready for development and the tester or developer wants test cases before writing code.

**Inputs:**
- `{{story}}`: the story text and its acceptance criteria.
- `{{test_framework}}`: e.g. "vitest", "pytest", "Playwright", or "manual only".

## Prompt

```text
Here is a user story with acceptance criteria:

{{story}}

For each acceptance criterion, write:
- at least one test case for the happy path,
- at least one for an unhappy or edge path (empty input, maximum length, invalid value, permission denied, timeout),
- an accessibility check if the criterion involves UI.

Format as a table: ID | Criterion | Scenario | Steps | Expected result | Automate? (yes/no and why).
Then give skeleton test code in {{test_framework}} for the cases marked "yes". Use descriptive test names; leave the bodies with TODO comments.
If a criterion cannot be tested as written, say why and suggest a testable rewording.
```

## Example

Input: "Given a file larger than 10 MB, when I upload it, then I see 'The selected file must be smaller than 10 MB'."

Output includes cases for exactly 10 MB, 10 MB + 1 byte, a 0-byte file, and a check that the error message is linked from the error summary.
