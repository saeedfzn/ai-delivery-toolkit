// Starts the built server (node dist/index.js) and talks raw newline-delimited
// JSON-RPC to it over stdio: initialize, initialized, tools/list, then tool calls
// including one not-found and one invalid input, then checks the tool-call log on
// stderr. Run after `npm run build`.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const child = spawn(process.execPath, [entry], { stdio: ["pipe", "pipe", "pipe"] });

// stderr carries the server's logs: a start-up line, then one JSON line per tool call.
let stderr = "";
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
  stderr += chunk;
  process.stderr.write(chunk);
});

const pending = new Map();
let buffer = "";
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    pending.get(msg.id)?.(msg);
    pending.delete(msg.id);
  }
});

let nextId = 1;
function request(method, params) {
  const id = nextId++;
  const message = { jsonrpc: "2.0", id, method, params };
  console.log(`\n>>> ${JSON.stringify(message)}`);
  child.stdin.write(JSON.stringify(message) + "\n");
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), 5000);
    pending.set(id, (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
  });
}

function notify(method) {
  const message = { jsonrpc: "2.0", method };
  console.log(`\n>>> ${JSON.stringify(message)}`);
  child.stdin.write(JSON.stringify(message) + "\n");
}

function show(msg, max = 900) {
  const text = JSON.stringify(msg);
  console.log(`<<< ${text.length > max ? text.slice(0, max) + " ...[trimmed]" : text}`);
}

try {
  const init = await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "jsonrpc-proof", version: "0.0.0" },
  });
  show(init);
  notify("notifications/initialized");

  const list = await request("tools/list", {});
  console.log(`<<< tools: ${list.result.tools.map((t) => t.name).join(", ")}`);
  if (list.result.tools.length !== 6) throw new Error("Expected 6 tools");

  const sprint = await request("tools/call", { name: "summarise_sprint_status", arguments: { sprint: "Sprint 15" } });
  console.log(`<<< isError=${sprint.result.isError ?? false}`);
  console.log(sprint.result.content[0].text);
  if (sprint.result.isError) throw new Error("summarise_sprint_status failed");

  const missing = await request("tools/call", { name: "get_ticket", arguments: { key: "LNT-999" } });
  show(missing);
  const invalid = await request("tools/call", { name: "get_ticket", arguments: { key: "DROP TABLE" } });
  show(invalid);
  if (!missing.result?.isError || !(invalid.result?.isError || invalid.error)) {
    throw new Error("Expected clear errors for a missing ticket and invalid input");
  }

  await new Promise((resolve) => setTimeout(resolve, 150)); // let the last stderr line arrive
  const logged = stderr
    .split("\n")
    .filter((l) => l.startsWith("{"))
    .map((l) => JSON.parse(l));
  console.log(`\n<<< stderr tool-call log: ${logged.map((e) => `${e.tool} ok=${e.ok} ${e.ms}ms`).join("; ")}`);
  // Two calls reached a handler; the invalid key was rejected by schema validation first.
  if (logged.length !== 2 || logged.some((e) => e.event !== "tool_call" || "arguments" in e)) {
    throw new Error("Expected two tool-call log lines on stderr, with no arguments in them");
  }
  console.log("\nPROOF OK");
} finally {
  child.stdin.end();
  child.kill();
}
