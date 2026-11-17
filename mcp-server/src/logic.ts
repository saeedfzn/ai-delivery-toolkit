import { TICKET_STATUSES, type Dataset, type Page, type Ticket } from "./data.js";

/** Thrown when a requested record does not exist. The message is shown to the model. */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((t) => t.length > 0);
}

/** Every query token must appear somewhere in the haystack (AND semantics). */
function matchesAll(haystack: string, query: string | undefined): boolean {
  if (!query) return true;
  const hay = haystack.toLowerCase();
  return tokens(query).every((t) => hay.includes(t));
}

export interface TicketSummary {
  key: string;
  type: Ticket["type"];
  summary: string;
  status: Ticket["status"];
  priority: Ticket["priority"];
  storyPoints: number;
  sprint: string;
  team: string;
}

function toSummary(t: Ticket): TicketSummary {
  return {
    key: t.key,
    type: t.type,
    summary: t.summary,
    status: t.status,
    priority: t.priority,
    storyPoints: t.storyPoints,
    sprint: t.sprint,
    team: t.team,
  };
}

export interface TicketSearch {
  query?: string | undefined;
  status?: Ticket["status"] | undefined;
  team?: string | undefined;
  sprint?: string | undefined;
  label?: string | undefined;
  limit?: number | undefined;
}

export function searchTickets(ds: Dataset, s: TicketSearch) {
  const limit = s.limit ?? 10;
  const matches = ds.tickets.filter(
    (t) =>
      matchesAll(`${t.key} ${t.summary} ${t.description} ${t.labels.join(" ")}`, s.query) &&
      (!s.status || t.status === s.status) &&
      (!s.team || t.team.toLowerCase() === s.team.toLowerCase()) &&
      (!s.sprint || t.sprint.toLowerCase() === s.sprint.toLowerCase()) &&
      (!s.label || t.labels.includes(s.label.toLowerCase())),
  );
  return {
    total: matches.length,
    returned: Math.min(limit, matches.length),
    tickets: matches.slice(0, limit).map(toSummary),
  };
}

export function getTicket(ds: Dataset, key: string): Ticket {
  const wanted = key.toUpperCase();
  const found = ds.tickets.find((t) => t.key === wanted);
  if (!found) {
    throw new NotFoundError(
      `No ticket with key ${wanted}. Use search_tickets to find the right key; do not guess ticket numbers.`,
    );
  }
  return found;
}

function snippet(body: string, query: string | undefined, width = 160): string {
  if (!query) return body.slice(0, width);
  const first = tokens(query)[0] ?? "";
  const at = Math.max(0, body.toLowerCase().indexOf(first) - 40);
  const text = body.slice(at, at + width);
  return (at > 0 ? "..." : "") + text + (at + width < body.length ? "..." : "");
}

export interface PageSearch {
  query: string;
  space?: string | undefined;
  limit?: number | undefined;
}

export function searchPages(ds: Dataset, s: PageSearch) {
  const limit = s.limit ?? 5;
  const matches = ds.pages.filter(
    (p) =>
      matchesAll(`${p.title} ${p.body} ${p.labels.join(" ")}`, s.query) &&
      (!s.space || p.space.toLowerCase() === s.space.toLowerCase()),
  );
  return {
    total: matches.length,
    returned: Math.min(limit, matches.length),
    pages: matches.slice(0, limit).map((p) => ({
      id: p.id,
      space: p.space,
      title: p.title,
      updated: p.updated,
      snippet: snippet(p.body, s.query),
    })),
  };
}

export function getPage(ds: Dataset, id: string): Page {
  const wanted = id.toUpperCase();
  const found = ds.pages.find((p) => p.id === wanted);
  if (!found) {
    throw new NotFoundError(`No page with id ${wanted}. Use search_pages to find the right page.`);
  }
  return found;
}

export function listSprints(ds: Dataset): string[] {
  return [...new Set(ds.tickets.map((t) => t.sprint))].sort();
}

/** Sprint status computed in code, so the model reports numbers rather than estimating them. */
export function summariseSprint(ds: Dataset, sprint: string) {
  const inSprint = ds.tickets.filter((t) => t.sprint.toLowerCase() === sprint.toLowerCase());
  if (inSprint.length === 0) {
    throw new NotFoundError(`No tickets in "${sprint}". Known sprints: ${listSprints(ds).join(", ")}.`);
  }
  const byStatus = Object.fromEntries(TICKET_STATUSES.map((s) => [s, 0])) as Record<Ticket["status"], number>;
  const byTeam: Record<string, { tickets: number; points: number; pointsDone: number }> = {};
  let points = 0;
  let pointsDone = 0;
  for (const t of inSprint) {
    byStatus[t.status] += 1;
    points += t.storyPoints;
    const team = (byTeam[t.team] ??= { tickets: 0, points: 0, pointsDone: 0 });
    team.tickets += 1;
    team.points += t.storyPoints;
    if (t.status === "Done") {
      pointsDone += t.storyPoints;
      team.pointsDone += t.storyPoints;
    }
  }
  const percent = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10);
  return {
    sprint: inSprint[0]!.sprint,
    ticketCount: inSprint.length,
    byStatus,
    storyPoints: { total: points, done: pointsDone, percentDone: percent(pointsDone, points) },
    byTeam,
    blocked: inSprint
      .filter((t) => t.status === "Blocked")
      .map((t) => ({ key: t.key, summary: t.summary, reason: t.blockedReason ?? "No reason recorded" })),
    unassigned: inSprint.filter((t) => t.assignee === null).map((t) => t.key),
  };
}

// Patterns that suggest personal data has been pasted into a draft. Deliberately broad:
// over-redacting a draft is cheap, leaking personal data into a ticket is not.
const PERSONAL_DATA_PATTERNS: Array<[string, RegExp]> = [
  ["email address", /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi],
  ["UK phone number", /(?:\+44\s?|\b0)(?:\d\s?){9,10}\b/g],
  ["National Insurance number", /\b[A-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/gi],
];

export interface DraftInput {
  type: Ticket["type"];
  summary: string;
  description: string;
  acceptanceCriteria?: string[] | undefined;
  team?: string | undefined;
  labels?: string[] | undefined;
}

/**
 * The only "write" capability, and it writes nothing: it returns a draft for a
 * human to review and create in Jira themselves. Personal data is redacted and
 * missing information is flagged rather than invented.
 */
export function draftTicket(input: DraftInput) {
  const warnings: string[] = [];
  const redact = (text: string): string => {
    let out = text;
    for (const [label, pattern] of PERSONAL_DATA_PATTERNS) {
      if (out.match(pattern)) {
        warnings.push(`Possible ${label} removed. Do not put personal data in tickets.`);
        out = out.replace(pattern, "[REDACTED]");
      }
    }
    return out;
  };
  const summary = redact(input.summary);
  const description = redact(input.description);
  const acceptanceCriteria = (input.acceptanceCriteria ?? []).map(redact);
  if (input.type === "Story" && acceptanceCriteria.length === 0) {
    warnings.push("Story has no acceptance criteria. Add at least one before creating it.");
  }
  if (!input.team) warnings.push("No team given. Ask which team owns this work.");
  return {
    status: "DRAFT - NOT CREATED",
    requiresHumanApproval: true,
    draft: {
      key: null,
      type: input.type,
      summary,
      description,
      acceptanceCriteria,
      team: input.team ?? null,
      labels: (input.labels ?? []).map((l) => l.toLowerCase()),
    },
    warnings: [...new Set(warnings)],
    nextStep: "A person reviews this draft and creates the ticket in Jira. The key is assigned by Jira, never invented.",
  };
}
