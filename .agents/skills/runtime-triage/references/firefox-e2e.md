# Firefox runtime E2E triage

Use this only after the failing family is known to be Firefox runtime Playwright or its
remote-debugging harness.

## Procedure

1. Capture the exact failing spec, test title and shortest decisive error string.
2. Build the special runtime artifact before reproducing:

   ```sh
   pnpm task build:firefox:runtime-test
   ```

   An ordinary Firefox build can produce misleading transport failures.

3. Inspect `tests/e2e/firefox-runtime.shared.ts` and the specific spec before product
   runtime code. Reuse an existing helper and established readiness signal.
4. Distinguish:
   - popup or remote actor readiness;
   - settings/setup messaging;
   - hash/static/`window.name` bootstrap state;
   - late convergence and state-revision gating;
   - cleanup or message-listener lifetime;
   - a genuine injected-runtime semantic mismatch.
5. When a stable remote `tab.actor` is already known, thread it through probes rather
   than repeatedly matching a tab by URL fragment.
6. Resolve seeded IDs and settings from runtime state. Do not assume historical preset
   IDs.
7. Surface embedded runtime errors before generic `ok` assertions so the real error is
   retained in CI output.

## Readiness rules

- Wait for the observable state owned by the operation: popup initialization, an exact
  bootstrap decision, state revision, runtime marker or expected message response.
- Never use `waitForTimeout()` or a larger delay as the fix.
- A bounded repeat after a fix may validate determinism; repeated execution is not a
  substitute for identifying the readiness contract.

## Focused verification

Run the exact test first:

```sh
pnpm exec task test:e2e:runtime:firefox -- --grep "<exact test title>" --reporter=line
```

Then run the containing spec or smallest related transport group. Add targeted lint and
TypeScript checks when helpers changed. Report if localhost binding or the Firefox
binary prevents a definitive local reproduction.
