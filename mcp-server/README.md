# lantern-delivery MCP server

A small [Model Context Protocol](https://modelcontextprotocol.io) server, written in TypeScript with the official `@modelcontextprotocol/sdk`. It gives Claude read access to Jira-style tickets and Confluence-style pages for the fictional Project Lantern programme. By default the data is mock JSON in `data/`; set four environment variables and the same tools read from Jira Cloud and Confluence Cloud instead.

## Design

- **Least privilege.** Every tool is read-only (`readOnlyHint: true`). The only tool that looks like a write, `draft_ticket`, returns a draft for a person to approve and creates nothing.
- **Validated input.** Every argument has a zod schema with types, lengths and formats (ticket keys must look like `LNT-107`). Invalid input is rejected before any handler runs.
- **Clear errors.** A missing record returns a tool error the model can act on, such as "No ticket with key LNT-999. Use search_tickets to find the right key; do not guess ticket numbers."
- **Numbers computed in code.** `summarise_sprint_status` totals story points and status counts so the model reports them rather than estimating them.
- **Personal data redaction.** `draft_ticket` removes email addresses, UK phone numbers and National Insurance-style numbers and tells the user it did so.
- **stdout is the protocol.** Logging goes to stderr only.
- **Observable without leaking.** Each tool call writes one JSON line to stderr: `{"ts", "event": "tool_call", "tool", "ok", "ms", "bytes"}`. Arguments and results are never logged, because a draft may contain personal data.

## Tools

| Tool | Input | Returns |
|------|-------|---------|
| `search_tickets` | `query?`, `status?`, `team?`, `sprint?`, `label?`, `limit` (1-50) | `total`, `returned`, ticket summaries |
| `get_ticket` | `key` | the full ticket |
| `search_pages` | `query`, `space?`, `limit` (1-20) | page titles and snippets |
| `get_page` | `id` | the full page |
| `summarise_sprint_status` | `sprint` | status counts, points done/total, per-team totals, blocked tickets with reasons, unassigned keys |
| `draft_ticket` | `type`, `summary`, `description`, `acceptanceCriteria?`, `team?`, `labels?` | a draft marked `DRAFT - NOT CREATED`, plus warnings |

## Build and test

```bash
npm ci
npm run typecheck   # tsc --noEmit over src and tests
npm test            # vitest: logic, in-process MCP client/server, Jira/Confluence mapping (30 tests)
npm run build       # compiles to dist/
npm run proof       # starts dist/index.js, speaks raw JSON-RPC to it over stdio, checks the stderr log
```

## Register it in Claude Code

After `npm run build`, from this folder:

```bash
claude mcp add lantern-delivery -- node "$(pwd)/dist/index.js"
claude mcp list
```

On Windows PowerShell use `node "$PWD\dist\index.js"`. To share the registration with your team, add `--scope project`; Claude Code writes it to `.mcp.json` in the repo root. The equivalent `.mcp.json` entry is:

```json
{
  "mcpServers": {
    "lantern-delivery": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"]
    }
  }
}
```

Then ask Claude Code something like "What is blocked in Sprint 15?" and it calls `summarise_sprint_status`.

## Reading from Jira and Confluence

`src/atlassian.ts` is the live source. When the variables below are set, the server loads tickets and pages over REST at start-up and the six tools work unchanged.

| Variable | Purpose |
|----------|---------|
| `ATLASSIAN_BASE_URL` | `https://<your-site>.atlassian.net` (https only) |
| `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN` | A service account with read permission; sent as HTTP Basic auth |
| `JIRA_JQL` | Which issues to load, for example `project = LNT AND updated >= -90d` |
| `CONFLUENCE_SPACE_KEY` | Optional. Which space to load pages from |
| `JIRA_STORY_POINTS_FIELD`, `JIRA_SPRINT_FIELD`, `JIRA_TEAM_FIELD` | Optional custom field ids (they differ per site, for example `customfield_10016`) |
| `ATLASSIAN_MAX_RECORDS` | Optional cap, default 500 |

```bash
claude mcp add lantern-delivery \
  -e ATLASSIAN_BASE_URL=https://your-site.atlassian.net \
  -e ATLASSIAN_EMAIL=svc-readonly@your-org.example \
  -e ATLASSIAN_API_TOKEN=... \
  -e JIRA_JQL="project = LNT AND updated >= -90d" \
  -- node "$(pwd)/dist/index.js"
```

How it behaves:

- **GET only.** Issues come from `GET /rest/api/3/search/jql` (paged with `nextPageToken`), pages from `GET /wiki/api/v2/spaces/{id}/pages?body-format=storage` (paged with the `next` link). There is no code path that writes.
- **Validated at the boundary.** Every response is parsed with zod, then mapped onto the same `Ticket` and `Page` schemas as the mock data. A site-specific workflow status falls back to its status category (to do, in progress, done).
- **No names.** Assignees become a one-way pseudonym of the account id. Display names and email addresses are dropped.
- **Rich text flattened.** Jira's Atlassian Document Format and Confluence's storage format are reduced to plain text for search and snippets.
- **Safe errors.** A failed call reports the HTTP status and path, never the credentials or the response body.

The mapping, paging and error handling are covered by `test/atlassian.test.ts`, which drives the adapter with an injected `fetch` and responses in the shape the Atlassian OpenAPI specifications define.

For a shared, hosted instance see [../docs/deploy-azure.md](../docs/deploy-azure.md).
