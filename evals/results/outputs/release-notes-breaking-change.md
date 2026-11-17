# Release 2.4.0 - TBC

This release adds a confirmation email for applicants, rejects impossible dates, and removes the legacy upload endpoint. Anyone still calling the legacy upload endpoint must switch before upgrading.

## Breaking changes
- The legacy upload endpoint has been removed. Any client or integration still using it will stop working after this release and must move to a supported upload route before upgrading. (`9a8b7c6`)

## New features
- Applicants now get a confirmation email when they apply (LNT-107, `a1b2c3d`)

## Bug fixes
- Impossible dates such as 31 February are now rejected (LNT-108, `d4e5f6a`)

## Internal changes
- Upgraded the PDF library (`0f1e2d3`)

---

**Notes for you:**
- **Grouping script not run:** No tools were available in this run, so I couldn't run `group_commits.py`. I grouped the four commits by hand using their conventional-commit prefixes, treating `feat!` as breaking. If the script's output differs, it should take precedence.
- **Breaking change needs detail:** The commit doesn't say which endpoint replaces the legacy one, so the migration instruction is deliberately general. Please add the replacement route, or a link to migration guidance, before publishing.
- **Tickets:** Only LNT-107 and LNT-108 appear in the commits. The breaking change and the PDF upgrade have no ticket key, and I haven't added one.
- **Release date:** It is set to TBC. The commits contained no secrets, hostnames or internal URLs, so nothing was redacted.
