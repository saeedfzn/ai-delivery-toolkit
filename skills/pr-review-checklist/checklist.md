# Review checklist

## Scope and size
- [ ] PR title includes the ticket key and the description says what and why.
- [ ] One logical change. Refactors and behaviour changes are not mixed.
- [ ] Under about 400 changed lines, excluding lock files and generated code.

## Correctness
- [ ] The change meets the ticket's acceptance criteria.
- [ ] Edge cases handled: empty input, nulls, very large input, timeouts, retries.
- [ ] Errors are caught where they can be handled and reported clearly where they cannot.

## Tests
- [ ] New behaviour has tests, including at least one failure path.
- [ ] Tests assert behaviour, not implementation details.
- [ ] CI is green (check, do not assume).

## Security and data
- [ ] No secrets, tokens, connection strings or credentials in code, config or tests.
- [ ] No personal data in fixtures, logs or error messages.
- [ ] User input is validated at the boundary; queries are parameterised.
- [ ] New dependencies are justified, pinned and from a trusted source.

## Accessibility (UI changes)
- [ ] Every input has a visible label; errors are linked to fields and summarised.
- [ ] Works with keyboard only; focus is visible and moves sensibly.
- [ ] Colour is not the only way information is shown; contrast meets WCAG 2.2 AA.

## Operability
- [ ] Logging is useful and at the right level.
- [ ] Config changes are documented; feature flags have an owner and a removal plan.

## Docs
- [ ] README, runbook or release notes updated where behaviour changed.
