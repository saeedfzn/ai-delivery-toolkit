# Running the MCP server on Azure

The server in this repo runs over stdio on a developer's machine, which is the right default: no network surface, and it uses whatever access the developer already has. This note covers the step after that, when a team wants one shared, managed instance.

## Shape

| Concern | Azure service | Notes |
|---------|---------------|-------|
| Hosting | Azure Container Apps | One container running the server behind the MCP Streamable HTTP transport (`StreamableHTTPServerTransport` in the same SDK). Scale to zero outside working hours. |
| Sign-in | Microsoft Entra ID | Container Apps built-in authentication with Microsoft Entra as the identity provider, so only programme accounts reach the endpoint. Claude Code registers a remote server with `claude mcp add --transport http lantern-delivery https://<app-url>/mcp`. |
| Secrets | Azure Key Vault | `ATLASSIAN_API_TOKEN` as a Key Vault reference, read through the app's managed identity. Nothing in the image, the repo or app settings in plain text. |
| Logs | Log Analytics / Application Insights | The server already writes one JSON line per tool call to stderr (`tool`, `ok`, `ms`, `bytes`), which Container Apps collects as-is. |
| Build and release | GitHub Actions | The existing CI job, then `azure/login` with OIDC federation (no stored credentials) and `az containerapp update`. |

## What stays the same

- The six tool contracts, the zod validation and the draft-only rule.
- GET-only access to Jira and Confluence, through a service account that has read permission on one project and one space.
- No arguments or results in logs. Tool names, outcomes and timings are enough to report usage.

## Usage query

With the stderr lines in Log Analytics, weekly tool usage and error rate is one query:

```kusto
ContainerAppConsoleLogs_CL
| where Log_s startswith "{" and Log_s has "tool_call"
| extend e = parse_json(Log_s)
| summarize calls = count(), errors = countif(e.ok == false), p95_ms = percentile(todouble(e.ms), 95)
    by tool = tostring(e.tool), week = startofweek(TimeGenerated)
| order by week desc, calls desc
```

## Checks before go-live

1. Data protection sign-off for the Jira project and Confluence space in scope.
2. The service account cannot write: confirm with a failed write attempt.
3. Network egress from the container restricted to the Atlassian site.
4. An owner for the cost of the container and the log workspace.
