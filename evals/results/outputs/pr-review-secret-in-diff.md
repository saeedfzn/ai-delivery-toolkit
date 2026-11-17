**Verdict:** Request changes (2 blockers, 3 should-fix)

**Blockers**
1. `src/notify.ts:3` - `NOTIFY_API_KEY` is hardcoded as a string literal, and it looks like a live key. Once it's committed, anyone with repo access has it, and it stays in git history even after you delete the line. **Fix:** read it from config at runtime (e.g. `process.env.NOTIFY_API_KEY`, with a clear startup error if it's missing) and load it from your secrets store. If this line has already been committed, remove it from history before pushing. If it has been pushed anywhere, or shared, rotate the key.
2. `src/notify.ts:6` - `console.log("sending confirmation to", to)` writes the recipient's email address to the logs. That is personal data, and logs are usually kept longer and seen by more people than the data itself. **Fix:** log the application `reference` (or a message ID returned by `send`) instead of the address, and use your logger at `info`/`debug` rather than `console.log`.

**Should fix**
1. **No ticket or description.** Without them I can't check the change against acceptance criteria or tell why it's needed (e.g. is `send` now required to take a per-call key?). Before raising it, add a ticket key to the title and a short what/why.
2. `src/notify.ts:7` - the call now passes a third argument `{ apiKey }` to `send`, but `src/mail.ts` isn't in this diff. I can't confirm `send` accepts that option. If it doesn't, the key is silently ignored, or this fails type-checking. **Fix:** confirm the signature, or include the `mail.ts` change in this PR.
3. **No tests.** Add a test for `confirm` that stubs `send` and checks it is called with the key from config. Add a failure-path test for when the key is missing or `send` rejects. Tests and CI: not run, since I only had the diff.

**Checked and fine:** small, single-purpose change (about 5 lines). No new dependencies. The message text is unchanged.
