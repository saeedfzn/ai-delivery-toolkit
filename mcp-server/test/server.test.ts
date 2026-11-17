import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { loadDataset } from "../src/data.js";
import { createServer, type ToolCallEvent } from "../src/server.js";

// Exercises the real MCP protocol in-process: client <-> server over a linked transport.
const client = new Client({ name: "test-client", version: "0.0.0" });
const calls: ToolCallEvent[] = [];

beforeAll(async () => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createServer(loadDataset(), (e) => calls.push(e)).connect(serverSide);
  await client.connect(clientSide);
});

afterAll(async () => {
  await client.close();
});

function text(result: Awaited<ReturnType<Client["callTool"]>>): string {
  const content = result.content as Array<{ type: string; text?: string }>;
  return content[0]?.text ?? "";
}

describe("MCP server", () => {
  it("lists exactly the six expected tools, all read-only", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "draft_ticket",
      "get_page",
      "get_ticket",
      "search_pages",
      "search_tickets",
      "summarise_sprint_status",
    ]);
    for (const t of tools) expect(t.annotations?.readOnlyHint).toBe(true);
  });

  it("returns computed sprint status as JSON", async () => {
    const r = await client.callTool({ name: "summarise_sprint_status", arguments: { sprint: "Sprint 15" } });
    expect(r.isError).toBeFalsy();
    expect(JSON.parse(text(r)).storyPoints.total).toBe(31);
  });

  it("returns a tool error, not a crash, for an unknown ticket", async () => {
    const r = await client.callTool({ name: "get_ticket", arguments: { key: "LNT-999" } });
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/No ticket with key LNT-999/);
  });

  it("rejects invalid input via zod validation", async () => {
    const r = await client.callTool({ name: "get_ticket", arguments: { key: "not a key" } }).catch((e: Error) => e);
    const message = r instanceof Error ? r.message : text(r);
    expect(message).toMatch(/Ticket keys look like LNT-107/);
  });

  it("records one event per tool call, without arguments or results", async () => {
    calls.length = 0;
    await client.callTool({
      name: "draft_ticket",
      arguments: { type: "Bug", summary: "Applicant cannot log in", description: "Reported by jo.bloggs@example.com this morning" },
    });
    await client.callTool({ name: "get_ticket", arguments: { key: "LNT-999" } });
    expect(calls.map((c) => [c.tool, c.ok])).toEqual([
      ["draft_ticket", true],
      ["get_ticket", false],
    ]);
    for (const c of calls) {
      expect(Object.keys(c).sort()).toEqual(["bytes", "event", "ms", "ok", "tool"]);
      expect(c.ms).toBeGreaterThanOrEqual(0);
    }
    expect(JSON.stringify(calls)).not.toMatch(/example\.com|LNT-999/);
  });
});
