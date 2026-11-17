import { createHash } from "node:crypto";
import { z } from "zod";
import { PageSchema, TICKET_STATUSES, TicketSchema, type Dataset, type Page, type Ticket } from "./data.js";

/**
 * Optional live source: Jira Cloud REST v3 and Confluence Cloud REST v2.
 *
 * Read-only by construction: every request is a GET. Responses are validated
 * with zod before they are mapped onto the same Ticket and Page shapes the
 * mock data uses, so the six tools behave the same over either source.
 * Assignees are reduced to a one-way pseudonym; display names and email
 * addresses are never passed through.
 */
export interface AtlassianConfig {
  baseUrl: string; // e.g. https://your-site.atlassian.net
  email: string;
  apiToken: string;
  jql: string;
  spaceKey?: string | undefined;
  storyPointsField?: string | undefined; // custom field id, differs per site
  sprintField?: string | undefined;
  teamField?: string | undefined;
  maxRecords: number;
}

export type FetchLike = (
  url: string,
  init: { method: "GET"; headers: Record<string, string>; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Returns null unless the three required variables are set, so mock data stays the default. */
export function configFromEnv(env: Record<string, string | undefined>): AtlassianConfig | null {
  const baseUrl = env.ATLASSIAN_BASE_URL?.trim().replace(/\/+$/, "");
  const email = env.ATLASSIAN_EMAIL?.trim();
  const apiToken = env.ATLASSIAN_API_TOKEN?.trim();
  if (!baseUrl || !email || !apiToken) return null;
  if (!/^https:\/\//i.test(baseUrl)) throw new Error("ATLASSIAN_BASE_URL must start with https://");
  const jql = env.JIRA_JQL?.trim();
  if (!jql) throw new Error("Set JIRA_JQL to a bounded query, for example: project = LNT AND updated >= -90d");
  return {
    baseUrl,
    email,
    apiToken,
    jql,
    spaceKey: env.CONFLUENCE_SPACE_KEY?.trim() || undefined,
    storyPointsField: env.JIRA_STORY_POINTS_FIELD?.trim() || undefined,
    sprintField: env.JIRA_SPRINT_FIELD?.trim() || undefined,
    teamField: env.JIRA_TEAM_FIELD?.trim() || undefined,
    maxRecords: Math.min(2000, Math.max(1, Number(env.ATLASSIAN_MAX_RECORDS) || 500)),
  };
}

const named = z.looseObject({ name: z.string() });

const IssueSchema = z.object({
  key: z.string(),
  fields: z.looseObject({
    summary: z.string(),
    description: z.unknown().optional(),
    issuetype: named,
    status: z.looseObject({ name: z.string(), statusCategory: z.looseObject({ key: z.string() }).optional() }),
    priority: named.nullish(),
    assignee: z.looseObject({ accountId: z.string() }).nullish(),
    labels: z.array(z.string()).default([]),
    project: named,
    updated: z.string(),
  }),
});

const SearchResponse = z.object({ issues: z.array(z.unknown()), nextPageToken: z.string().nullish() });
const SpacesResponse = z.object({ results: z.array(z.looseObject({ id: z.string(), key: z.string() })) });
const ConfluencePage = z.looseObject({
  id: z.string(),
  title: z.string(),
  version: z.looseObject({ createdAt: z.string() }).optional(),
  body: z.looseObject({ storage: z.looseObject({ value: z.string() }).optional() }).optional(),
});
const PagesResponse = z.object({
  results: z.array(ConfluencePage),
  _links: z.looseObject({ next: z.string().optional() }).optional(),
});
type PagesBatch = z.infer<typeof PagesResponse>;

/** Flatten Atlassian Document Format (the v3 rich-text JSON) to plain text. */
export function adfToText(node: unknown): string {
  if (typeof node === "string") return node;
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: unknown; text?: unknown; content?: unknown };
  if (typeof n.text === "string") return n.text;
  if (n.type === "hardBreak") return "\n";
  if (!Array.isArray(n.content)) return "";
  const block = n.type === "paragraph" || n.type === "heading" || n.type === "listItem";
  return n.content.map(adfToText).join("") + (block ? "\n" : "");
}

/** Confluence storage format is XHTML; keep the words, drop the markup. */
export function storageToText(xhtml: string): string {
  return xhtml
    .replace(/<\/(p|h[1-6]|li|tr|div)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

export function pseudonym(accountId: string): string {
  return "user-" + createHash("sha256").update(accountId).digest("hex").slice(0, 8);
}

function pick<T extends string>(allowed: readonly T[], value: string | undefined, fallback: T): T {
  return allowed.find((a) => a.toLowerCase() === value?.toLowerCase()) ?? fallback;
}

const CATEGORY_TO_STATUS: Record<string, Ticket["status"]> = { new: "To Do", indeterminate: "In Progress", done: "Done" };

function nameOf(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return nameOf(value[value.length - 1]); // sprint field: the latest sprint is last
  if (value && typeof value === "object") {
    const v = value as { name?: unknown; value?: unknown };
    if (typeof v.name === "string") return v.name;
    if (typeof v.value === "string") return v.value;
  }
  return undefined;
}

export function mapIssue(raw: unknown, cfg: Pick<AtlassianConfig, "storyPointsField" | "sprintField" | "teamField">): Ticket {
  const { key, fields: f } = IssueSchema.parse(raw);
  const custom = f as Record<string, unknown>;
  const points = cfg.storyPointsField ? custom[cfg.storyPointsField] : undefined;
  return TicketSchema.parse({
    key,
    type: pick(["Story", "Bug", "Task", "Spike"] as const, f.issuetype.name, "Task"),
    summary: f.summary,
    description: adfToText(f.description).trim(),
    // A workflow status the tools know by name is kept; anything else falls back to its status category.
    status: pick(TICKET_STATUSES, f.status.name, CATEGORY_TO_STATUS[f.status.statusCategory?.key ?? ""] ?? "To Do"),
    priority: pick(["Lowest", "Low", "Medium", "High", "Highest"] as const, f.priority?.name, "Medium"),
    storyPoints: typeof points === "number" && points >= 0 ? points : 0,
    sprint: (cfg.sprintField && nameOf(custom[cfg.sprintField])) || "Backlog",
    team: (cfg.teamField && nameOf(custom[cfg.teamField])) || f.project.name,
    assignee: f.assignee ? pseudonym(f.assignee.accountId) : null,
    labels: f.labels.map((l) => l.toLowerCase()),
    updated: f.updated.slice(0, 10),
  });
}

export function mapPage(raw: z.infer<typeof ConfluencePage>, spaceKey: string): Page {
  return PageSchema.parse({
    id: `PG-${raw.id}`,
    space: spaceKey.toUpperCase(),
    title: raw.title,
    updated: (raw.version?.createdAt ?? "").slice(0, 10),
    labels: [],
    body: storageToText(raw.body?.storage?.value ?? ""),
  });
}

export async function fetchDataset(cfg: AtlassianConfig, fetchImpl: FetchLike = fetch): Promise<Dataset> {
  const headers = {
    Accept: "application/json",
    Authorization: "Basic " + Buffer.from(`${cfg.email}:${cfg.apiToken}`).toString("base64"),
  };
  async function get<T>(pathAndQuery: string, schema: z.ZodType<T>): Promise<T> {
    const res = await fetchImpl(cfg.baseUrl + pathAndQuery, { method: "GET", headers, signal: AbortSignal.timeout(15_000) });
    // The path is safe to report; the credentials and the response body are not.
    if (!res.ok) throw new Error(`Atlassian API returned HTTP ${res.status} for ${pathAndQuery.split("?")[0]}`);
    return schema.parse(await res.json());
  }

  const fields = ["summary", "description", "issuetype", "status", "priority", "assignee", "labels", "project", "updated"];
  for (const extra of [cfg.storyPointsField, cfg.sprintField, cfg.teamField]) if (extra) fields.push(extra);

  const tickets: Ticket[] = [];
  let token: string | null | undefined;
  do {
    const query = new URLSearchParams({ jql: cfg.jql, maxResults: "100", fields: fields.join(",") });
    if (token) query.set("nextPageToken", token);
    const page = await get(`/rest/api/3/search/jql?${query.toString()}`, SearchResponse);
    for (const issue of page.issues) tickets.push(mapIssue(issue, cfg));
    token = page.nextPageToken;
  } while (token && tickets.length < cfg.maxRecords);

  const pages: Page[] = [];
  if (cfg.spaceKey) {
    const spaces = await get(`/wiki/api/v2/spaces?keys=${encodeURIComponent(cfg.spaceKey)}`, SpacesResponse);
    const space = spaces.results[0];
    if (!space) throw new Error(`Confluence space ${cfg.spaceKey} was not found or is not visible to this account`);
    let next: string | undefined = `/wiki/api/v2/spaces/${encodeURIComponent(space.id)}/pages?body-format=storage&limit=100`;
    while (next && pages.length < cfg.maxRecords) {
      const batch: PagesBatch = await get(next, PagesResponse);
      for (const p of batch.results) pages.push(mapPage(p, space.key));
      next = batch._links?.next; // relative URL carrying the cursor
    }
  }
  return { tickets: tickets.slice(0, cfg.maxRecords), pages: pages.slice(0, cfg.maxRecords) };
}
