import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/**
 * Mock data stands in for Jira and Confluence by default (src/atlassian.ts is
 * the optional live source). It is loaded from ../data
 * relative to this module, which resolves correctly from both src/ (tests)
 * and dist/ (the built server).
 */
const DATA_DIR = fileURLToPath(new URL("../data/", import.meta.url));

export const TICKET_STATUSES = ["To Do", "In Progress", "In Review", "Blocked", "Done"] as const;

export const TicketSchema = z.object({
  key: z.string().regex(/^[A-Z][A-Z0-9]+-\d+$/),
  type: z.enum(["Story", "Bug", "Task", "Spike"]),
  summary: z.string(),
  description: z.string(),
  status: z.enum(TICKET_STATUSES),
  priority: z.enum(["Lowest", "Low", "Medium", "High", "Highest"]),
  storyPoints: z.number().nonnegative(),
  sprint: z.string(),
  team: z.string(),
  assignee: z.string().nullable(),
  labels: z.array(z.string()),
  blockedReason: z.string().optional(),
  updated: z.string(),
});

export const PageSchema = z.object({
  id: z.string(),
  space: z.string(),
  title: z.string(),
  updated: z.string(),
  labels: z.array(z.string()),
  body: z.string(),
});

export type Ticket = z.infer<typeof TicketSchema>;
export type Page = z.infer<typeof PageSchema>;

export interface Dataset {
  tickets: Ticket[];
  pages: Page[];
}

function loadJson<T>(file: string, schema: z.ZodType<T>): T {
  const raw: unknown = JSON.parse(readFileSync(DATA_DIR + file, "utf8"));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Mock data file ${file} is invalid: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function loadDataset(): Dataset {
  return {
    tickets: loadJson("tickets.json", z.array(TicketSchema)),
    pages: loadJson("pages.json", z.array(PageSchema)),
  };
}
