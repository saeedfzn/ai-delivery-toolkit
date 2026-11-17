import { describe, expect, it } from "vitest";
import { adfToText, configFromEnv, fetchDataset, mapIssue, pseudonym, storageToText, type FetchLike } from "../src/atlassian.js";
import { searchTickets, summariseSprint } from "../src/logic.js";

// Fixtures are shaped like Jira Cloud REST v3 and Confluence Cloud REST v2 responses.
// The host is a placeholder and every value is fictional.
const BASE = "https://example.atlassian.net";
const env = {
  ATLASSIAN_BASE_URL: BASE + "/",
  ATLASSIAN_EMAIL: "svc-readonly@example.com",
  ATLASSIAN_API_TOKEN: "test-token",
  JIRA_JQL: "project = LNT",
  CONFLUENCE_SPACE_KEY: "delivery",
  JIRA_STORY_POINTS_FIELD: "customfield_10016",
  JIRA_SPRINT_FIELD: "customfield_10020",
};

function issue(key: string, over: Record<string, unknown> = {}) {
  return {
    id: "1",
    key,
    fields: {
      summary: "Case queue times out",
      description: {
        type: "doc",
        version: 1,
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Queue of 400 cases " }, { type: "text", text: "times out." }] },
          { type: "paragraph", content: [{ type: "text", text: "Add paging." }] },
        ],
      },
      issuetype: { name: "Bug" },
      status: { name: "Waiting for platform", statusCategory: { key: "indeterminate" } },
      priority: { name: "High" },
      assignee: { accountId: "5b10ac8d82e05b22cc7d4ef5", displayName: "A Real Name", emailAddress: "person@example.com" },
      labels: ["Performance"],
      project: { name: "Lantern" },
      updated: "2026-11-10T09:15:00.000+0000",
      customfield_10016: 3,
      customfield_10020: [
        { name: "Sprint 14", state: "closed" },
        { name: "Sprint 15", state: "active" },
      ],
      ...over,
    },
  };
}

interface Call {
  url: string;
  method: string;
  auth: string;
}

/** Routes are matched in order by URL prefix; anything else is a 401. */
function fakeFetch(routes: Array<[string, unknown]>): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, method: init.method, auth: init.headers.Authorization ?? "" });
    const hit = routes.find(([marker]) => url.startsWith(BASE) && url.includes(marker));
    return hit ? { ok: true, status: 200, json: async () => hit[1] } : { ok: false, status: 401, json: async () => ({}) };
  };
  return { fetch, calls };
}

describe("configFromEnv", () => {
  it("keeps mock data as the default", () => {
    expect(configFromEnv({})).toBeNull();
  });

  it("requires https and a bounded JQL query", () => {
    expect(() => configFromEnv({ ...env, ATLASSIAN_BASE_URL: "http://example.atlassian.net" })).toThrow(/https/);
    expect(() => configFromEnv({ ...env, JIRA_JQL: "" })).toThrow(/JIRA_JQL/);
    expect(configFromEnv(env)?.baseUrl).toBe(BASE);
  });
});

describe("mapping", () => {
  const cfg = configFromEnv(env)!;

  it("maps a Jira issue onto the ticket shape the tools use", () => {
    const t = mapIssue(issue("LNT-112"), cfg);
    expect(t).toMatchObject({
      key: "LNT-112",
      type: "Bug",
      status: "In Progress", // a site-specific workflow status falls back to its category
      priority: "High",
      storyPoints: 3,
      sprint: "Sprint 15",
      team: "Lantern",
      labels: ["performance"],
      updated: "2026-11-10",
    });
    expect(t.description).toBe("Queue of 400 cases times out.\nAdd paging.");
  });

  it("never passes a name or email through", () => {
    const t = mapIssue(issue("LNT-112"), cfg);
    expect(t.assignee).toBe(pseudonym("5b10ac8d82e05b22cc7d4ef5"));
    expect(t.assignee).toMatch(/^user-[0-9a-f]{8}$/);
    expect(JSON.stringify(t)).not.toMatch(/Real Name|person@/);
  });

  it("keeps known statuses and uses safe defaults for empty fields", () => {
    const t = mapIssue(
      issue("LNT-9", {
        status: { name: "blocked" },
        priority: null,
        assignee: null,
        issuetype: { name: "Epic" },
        customfield_10016: null,
        customfield_10020: null,
      }),
      cfg,
    );
    expect(t).toMatchObject({ status: "Blocked", priority: "Medium", assignee: null, type: "Task", storyPoints: 0, sprint: "Backlog" });
  });

  it("rejects a response that is not an issue", () => {
    expect(() => mapIssue({ key: "LNT-1" }, cfg)).toThrow();
  });

  it("flattens ADF and Confluence storage format to text", () => {
    expect(adfToText(null)).toBe("");
    expect(storageToText("<h1>Runbook</h1><p>Rotate keys &amp; restart.<br/>Then check logs.</p>")).toBe(
      "Runbook\nRotate keys & restart.\nThen check logs.",
    );
  });
});

describe("fetchDataset", () => {
  it("pages through Jira and Confluence with GET requests only", async () => {
    const { fetch, calls } = fakeFetch([
      ["nextPageToken=abc", { issues: [issue("LNT-113", { status: { name: "Done", statusCategory: { key: "done" } } })] }],
      ["/rest/api/3/search/jql?", { issues: [issue("LNT-112")], nextPageToken: "abc" }],
      ["/wiki/api/v2/spaces?keys=delivery", { results: [{ id: "65537", key: "DELIVERY", name: "Delivery" }] }],
      [
        "cursor=xyz",
        {
          results: [
            { id: "2002", title: "Runbook", version: { createdAt: "2026-10-01T08:00:00.000Z" }, body: { storage: { value: "<p>Restart the worker.</p>" } } },
          ],
          _links: {},
        },
      ],
      [
        "/wiki/api/v2/spaces/65537/pages?body-format=storage",
        {
          results: [
            {
              id: "2001",
              title: "Definition of Done",
              version: { createdAt: "2026-09-15T08:00:00.000Z" },
              body: { storage: { value: "<p>Reviewed and tested.</p>" } },
            },
          ],
          _links: { next: "/wiki/api/v2/spaces/65537/pages?body-format=storage&limit=100&cursor=xyz" },
        },
      ],
    ]);
    const ds = await fetchDataset(configFromEnv(env)!, fetch);

    expect(ds.tickets.map((t) => t.key)).toEqual(["LNT-112", "LNT-113"]);
    expect(ds.pages).toEqual([
      { id: "PG-2001", space: "DELIVERY", title: "Definition of Done", updated: "2026-09-15", labels: [], body: "Reviewed and tested." },
      { id: "PG-2002", space: "DELIVERY", title: "Runbook", updated: "2026-10-01", labels: [], body: "Restart the worker." },
    ]);
    expect(calls).toHaveLength(5);
    expect(calls.every((c) => c.method === "GET" && c.auth.startsWith("Basic "))).toBe(true);
    expect(calls[0]?.url).toContain("jql=project+%3D+LNT");
    expect(calls[0]?.url).toContain("customfield_10016");

    // The same tool logic runs over the fetched data.
    expect(searchTickets(ds, { query: "queue" }).total).toBe(2);
    expect(summariseSprint(ds, "Sprint 15").storyPoints).toEqual({ total: 6, done: 3, percentDone: 50 });
  });

  it("reports the status and path on failure, never the credentials", async () => {
    const { fetch } = fakeFetch([]);
    const err = await fetchDataset(configFromEnv(env)!, fetch).catch((e: Error) => e);
    expect((err as Error).message).toBe("Atlassian API returned HTTP 401 for /rest/api/3/search/jql");
  });
});
