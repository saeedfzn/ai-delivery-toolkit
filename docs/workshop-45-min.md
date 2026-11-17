# Workshop: AI skills for delivery teams (45 minutes)

Facilitator notes. Audience: one delivery team, up to 12 people, mixed roles. Format: in person or remote with screen share.

## Outcomes

By the end, each person has:

1. Run at least one skill on a realistic (synthetic) input.
2. Seen a guardrail work, and seen where one can be pushed.
3. Picked one skill to use in their work this week.

## Preparation (facilitator, 20 minutes the day before)

- Check everyone has Claude Code installed, and that the MCP server is registered on the demo machine (`claude mcp list`).
- Print or share the synthetic inputs below. Never use real meeting notes or real case data.
- Open the [adoption dashboard](../index.html#dashboard).

## Agenda

| Time | Activity | Facilitator notes |
|------|----------|-------------------|
| 0-5 | Why skills, not one-off prompts | Show "Top skills by uses". Skill outputs in the sample data are accepted as-is far more often than ad hoc prompts. Make the point that a skill is a prompt the team has agreed and improved. |
| 5-15 | Live demo: meeting notes to tickets | Paste synthetic input A. Run `meeting-notes-to-jira`. Point out: names replaced by roles; the empty "Decisions" heading flagged; LNT-112 found as an existing ticket instead of a duplicate; drafts not created. |
| 15-30 | Hands-on in pairs | Each pair takes one skill and one input (B, C or D). Write down one thing it did well and one thing it got wrong or missed. |
| 30-38 | Break the guardrails | Ask pairs to try to make the skill invent a ticket key, keep an email address, or claim a page is WCAG compliant. Collect results on the board. |
| 38-43 | Improve a skill | Pick the most useful finding. Edit the SKILL.md live, add the input that broke it to `evals/cases.json`, and outline the pull request using the template. Worked example: the eval that caught `pr-review-checklist` quoting a secret (see `evals/README.md`). |
| 43-45 | Close | Everyone names one skill they will use this week. Their usage will appear in next week's report. |

## Synthetic inputs

**A. Meeting notes (for meeting-notes-to-jira)**

> Stand-up plus, Tuesday. Attendees: product owner, two developers, caseworker lead, platform lead.
> Queue timing out again for the northern region. Platform lead says the index change is next week. Caseworker lead asked if filters could be remembered; no answer yet. Content designer to send Welsh start page copy by Friday.
> Decisions:
> Actions: platform lead - paging. Developer - look at upload size limit.

**B. Feature request (for user-story-writer)**

> Applicants keep phoning to ask if we got their documents. Can we tell them?

**C. HTML snippet (for wcag-quick-check)**

```html
<form><h1>Contact</h1><h3>Phone</h3><input id="phone"><a href="/help"></a><button tabindex="3">Go</button></form>
```

**D. Git log (for release-notes-drafter)**

```text
a1b2c3d feat(apply): send confirmation email LNT-107
d4e5f6a fix: reject impossible dates (LNT-108)
0f1e2d3 chore: bump pdf library
9a8b7c6 feat!: drop the legacy upload endpoint
```

## After the session

- Raise the agreed skill improvement as a pull request within a day.
- Compare weekly active users and acceptance rate for the team in the next report.
