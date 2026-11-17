import { describe, expect, it } from "vitest";
import { loadDataset } from "../src/data.js";
import {
  NotFoundError,
  draftTicket,
  getPage,
  getTicket,
  searchPages,
  searchTickets,
  summariseSprint,
} from "../src/logic.js";

const ds = loadDataset();

describe("mock data", () => {
  it("loads and validates every ticket and page", () => {
    expect(ds.tickets).toHaveLength(16);
    expect(ds.pages).toHaveLength(7);
  });

  it("uses pseudonymous assignees only", () => {
    for (const t of ds.tickets) {
      if (t.assignee !== null) expect(t.assignee).toMatch(/^user-\d{3}$/);
    }
  });
});

describe("searchTickets", () => {
  it("requires every query word to match", () => {
    const r = searchTickets(ds, { query: "caseworker queue" });
    expect(r.tickets.map((t) => t.key).sort()).toEqual(["LNT-106", "LNT-112", "LNT-115"]);
  });

  it("combines filters with AND", () => {
    const r = searchTickets(ds, { sprint: "sprint 15", status: "Blocked" });
    expect(r.tickets.map((t) => t.key)).toEqual(["LNT-109", "LNT-112"]);
  });

  it("applies the limit but reports the full total", () => {
    const r = searchTickets(ds, { team: "Team Kestrel", limit: 2 });
    expect(r.returned).toBe(2);
    expect(r.total).toBe(8);
  });
});

describe("getTicket", () => {
  it("is case-insensitive on the key", () => {
    expect(getTicket(ds, "lnt-109").blockedReason).toContain("impact assessment");
  });

  it("throws a NotFoundError that tells the model not to guess", () => {
    expect(() => getTicket(ds, "LNT-999")).toThrow(NotFoundError);
    expect(() => getTicket(ds, "LNT-999")).toThrow(/do not guess/);
  });
});

describe("pages", () => {
  it("finds pages and returns a snippet around the match", () => {
    const r = searchPages(ds, { query: "personal data" });
    expect(r.pages[0]?.id).toBe("PG-1004");
    expect(r.pages[0]?.snippet.toLowerCase()).toContain("personal");
  });

  it("filters by space", () => {
    expect(searchPages(ds, { query: "rotated", space: "delivery" }).total).toBe(0);
    expect(searchPages(ds, { query: "rotated", space: "PLATFORM" }).total).toBe(1);
  });

  it("throws for an unknown page", () => {
    expect(() => getPage(ds, "PG-0000")).toThrow(NotFoundError);
  });
});

describe("summariseSprint", () => {
  it("computes Sprint 15 totals in code", () => {
    const s = summariseSprint(ds, "Sprint 15");
    expect(s.ticketCount).toBe(9);
    expect(s.byStatus).toEqual({ "To Do": 2, "In Progress": 2, "In Review": 2, Blocked: 2, Done: 1 });
    expect(s.storyPoints).toEqual({ total: 31, done: 1, percentDone: 3.2 });
    expect(s.blocked.map((b) => b.key)).toEqual(["LNT-109", "LNT-112"]);
    expect(s.unassigned).toEqual(["LNT-110", "LNT-113"]);
  });

  it("reports a completed sprint", () => {
    const s = summariseSprint(ds, "sprint 14");
    expect(s.storyPoints).toEqual({ total: 14, done: 14, percentDone: 100 });
    expect(s.byTeam["Team Heron"]).toEqual({ tickets: 2, points: 4, pointsDone: 4 });
  });

  it("lists the known sprints when the sprint does not exist", () => {
    expect(() => summariseSprint(ds, "Sprint 99")).toThrow(/Known sprints: Backlog, Sprint 14, Sprint 15/);
  });
});

describe("draftTicket", () => {
  it("never creates anything and never invents a key", () => {
    const d = draftTicket({ type: "Task", summary: "Tidy logs", description: "Remove noisy debug logs", team: "Team Heron" });
    expect(d.status).toBe("DRAFT - NOT CREATED");
    expect(d.requiresHumanApproval).toBe(true);
    expect(d.draft.key).toBeNull();
    expect(d.warnings).toEqual([]);
  });

  it("redacts personal data and says so", () => {
    const d = draftTicket({
      type: "Bug",
      summary: "Applicant cannot log in",
      description: "Reported by jo.bloggs@example.com on 07700 900123, NI number QQ 12 34 56 C",
      team: "Team Kestrel",
    });
    expect(d.draft.description).not.toMatch(/example\.com|07700|QQ 12/);
    expect(d.draft.description.match(/\[REDACTED\]/g)).toHaveLength(3);
    expect(d.warnings).toHaveLength(3);
  });

  it("flags a story with no acceptance criteria and no team", () => {
    const d = draftTicket({ type: "Story", summary: "Print my answers", description: "As an applicant I want to print..." });
    expect(d.warnings).toEqual([
      "Story has no acceptance criteria. Add at least one before creating it.",
      "No team given. Ask which team owns this work.",
    ]);
  });
});
