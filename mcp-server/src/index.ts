#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { configFromEnv, fetchDataset } from "./atlassian.js";
import { loadDataset } from "./data.js";
import { createServer, SERVER_NAME, SERVER_VERSION } from "./server.js";

// stdout carries the JSON-RPC protocol, so all logging goes to stderr.
async function main(): Promise<void> {
  const live = configFromEnv(process.env);
  const dataset = live ? await fetchDataset(live) : loadDataset();
  // One JSON line per tool call: name, outcome, duration and size. Never arguments.
  const server = createServer(dataset, (event) => console.error(JSON.stringify({ ts: new Date().toISOString(), ...event })));
  await server.connect(new StdioServerTransport());
  const source = live ? "Jira and Confluence REST, GET only" : "mock data";
  console.error(
    `${SERVER_NAME} ${SERVER_VERSION} running on stdio (${source}; ${dataset.tickets.length} tickets, ${dataset.pages.length} pages)`,
  );
}

main().catch((err: unknown) => {
  console.error("Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
