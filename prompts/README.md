# Prompt library

Short, reusable prompts for tasks that do not need a full skill. Copy one, fill in the `{{placeholders}}`, and paste it into Claude Code or the chat assistant.

| Prompt | Use it to |
|--------|-----------|
| [sprint-status-update.md](sprint-status-update.md) | Write a stakeholder update from computed sprint numbers |
| [test-cases-from-acceptance-criteria.md](test-cases-from-acceptance-criteria.md) | Turn acceptance criteria into manual and automated test cases |
| [explain-code-for-handover.md](explain-code-for-handover.md) | Produce a handover note for a module someone else will maintain |
| [plain-english-rewrite.md](plain-english-rewrite.md) | Rewrite technical or policy text for a non-technical reader |
| [raid-log-entry.md](raid-log-entry.md) | Turn a worry raised in a meeting into a risk, issue or dependency entry |

## House rules for every prompt

- Never paste personal data, secrets or live case data. Use roles and synthetic examples.
- Ask the model to list missing information rather than guess it.
- Numbers come from tools or data you provide, not from the model's estimate.
- A person reviews the output before it is shared or acted on.
- If a prompt is used more than a few times a week, propose turning it into a skill (see `CONTRIBUTING.md`).
