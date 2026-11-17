import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { TICKET_STATUSES, loadDataset, type Dataset } from "./data.js";
import {
  NotFoundError,
  draftTicket,
  getPage,
  getTicket,
  searchPages,
  searchTickets,
  summariseSprint,
} from "./logic.js";

export const SERVER_NAME = "lantern-delivery";
export const SERVER_VERSION = "0.1.0";

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

/**
 * One record per tool call, for usage and latency reporting. It carries the tool
 * name, outcome, duration and response size only. Arguments and results are
 * never included, because draft_ticket input may contain personal data.
 */
export interface ToolCallEvent {
  event: "tool_call";
  tool: string;
  ok: boolean;
  ms: number;
  bytes: number;
}
export type ToolCallSink = (event: ToolCallEvent) => void;

const ticketKey = z
  .string()
  .trim()
  .regex(/^[A-Za-z][A-Za-z0-9]+-\d+$/, "Ticket keys look like LNT-107");

export function createServer(dataset: Dataset = loadDataset(), onToolCall: ToolCallSink = () => {}): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  /** Run a handler, returning JSON text on success and a clear tool error on failure. */
  function respond(tool: string, fn: () => unknown): CallToolResult {
    const started = performance.now();
    let ok = true;
    let text: string;
    try {
      text = JSON.stringify(fn(), null, 2);
    } catch (err) {
      ok = false;
      text = err instanceof NotFoundError ? err.message : `Unexpected error: ${err instanceof Error ? err.message : String(err)}`;
    }
    onToolCall({ event: "tool_call", tool, ok, ms: Math.round((performance.now() - started) * 10) / 10, bytes: Buffer.byteLength(text) });
    return ok ? { content: [{ type: "text", text }] } : { isError: true, content: [{ type: "text", text }] };
  }

  server.registerTool(
    "search_tickets",
    {
      title: "Search tickets",
      description:
        "Search Jira tickets for Project Lantern. All filters are optional and combined with AND. Returns ticket summaries; use get_ticket for full detail.",
      inputSchema: {
        query: z.string().trim().min(2).max(200).optional().describe("Words that must all appear in the key, summary, description or labels"),
        status: z.enum(TICKET_STATUSES).optional(),
        team: z.string().max(60).optional().describe('e.g. "Team Kestrel"'),
        sprint: z.string().max(60).optional().describe('e.g. "Sprint 15" or "Backlog"'),
        label: z.string().max(60).optional(),
        limit: z.number().int().min(1).max(50).default(10),
      },
      annotations: READ_ONLY,
    },
    async (args) => respond("search_tickets", () => searchTickets(dataset, args)),
  );

  server.registerTool(
    "get_ticket",
    {
      title: "Get ticket",
      description: "Get one ticket by key, including description, assignee pseudonym and any blocked reason.",
      inputSchema: { key: ticketKey },
      annotations: READ_ONLY,
    },
    async ({ key }) => respond("get_ticket", () => getTicket(dataset, key)),
  );

  server.registerTool(
    "search_pages",
    {
      title: "Search pages",
      description: "Search Confluence pages (ways of working, runbooks, decision records). Returns titles and snippets.",
      inputSchema: {
        query: z.string().trim().min(2).max(200),
        space: z.string().max(40).optional().describe("DELIVERY, PLATFORM or DESIGN"),
        limit: z.number().int().min(1).max(20).default(5),
      },
      annotations: READ_ONLY,
    },
    async (args) => respond("search_pages", () => searchPages(dataset, args)),
  );

  server.registerTool(
    "get_page",
    {
      title: "Get page",
      description: "Get the full body of one Confluence page by id.",
      inputSchema: { id: z.string().trim().regex(/^PG-\d+$/i, "Page ids look like PG-1004") },
      annotations: READ_ONLY,
    },
    async ({ id }) => respond("get_page", () => getPage(dataset, id)),
  );

  server.registerTool(
    "summarise_sprint_status",
    {
      title: "Summarise sprint status",
      description:
        "Compute sprint status in code: tickets by status, story points done vs total, per-team totals, blocked tickets with reasons, unassigned tickets. Report these numbers as given.",
      inputSchema: { sprint: z.string().trim().min(1).max(60).describe('e.g. "Sprint 15"') },
      annotations: READ_ONLY,
    },
    async ({ sprint }) => respond("summarise_sprint_status", () => summariseSprint(dataset, sprint)),
  );

  server.registerTool(
    "draft_ticket",
    {
      title: "Draft a ticket (not created)",
      description:
        "Prepare a ticket draft for a human to review. Nothing is written to Jira. Personal data is redacted and missing information is flagged.",
      inputSchema: {
        type: z.enum(["Story", "Bug", "Task", "Spike"]),
        summary: z.string().trim().min(5).max(120),
        description: z.string().trim().min(10).max(4000),
        acceptanceCriteria: z.array(z.string().trim().min(3).max(500)).max(15).optional(),
        team: z.string().max(60).optional(),
        labels: z.array(z.string().max(40)).max(10).optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => respond("draft_ticket", () => draftTicket(args)),
  );

  return server;
}
