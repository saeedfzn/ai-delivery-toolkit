# Explain code for handover

**When to use:** a module or service is being handed to another team, or a new joiner needs to maintain code they did not write.

**Inputs:**
- `{{path}}`: the folder or files to explain (in Claude Code, the model can read them directly).
- `{{reader}}`: who will maintain it, e.g. "a developer new to the programme".

## Prompt

```text
Read the code in {{path}} and write a handover note for {{reader}}.

Include:
1. What this code does, in three sentences.
2. How to run it locally and how to run its tests (exact commands, taken from the repo, not guessed).
3. The main flow: entry point, key modules, and where data comes from and goes to.
4. Configuration and secrets it needs (names only, never values).
5. Things that are surprising or fragile, with file and line references.
6. What is not covered by tests.
Only state what you can see in the code. If something is unclear, list it under "Questions for the previous owner".
```

## Example

Run against `mcp-server/` in this repo, it should name `src/index.ts` as the entry point, `npm test` as the test command, note that stdout is reserved for the protocol, and list the mock data files.
