# PT-26 visual and runtime verification

The popup and sidebar share the same worker troubleshooter. It proposes one explicit
Service Worker registration or native SharedWorker test, reloads exact-host tabs, and
asks the user whether it helped. A second decision saves an exact-host policy exception.
Failed tests, cancellation, UI closure and expiry remove the temporary override.

The UI explains host/container/frame scope, the ten-minute limit, unchanged global
WebRTC policy, and website effects that restoring preferences cannot undo. Evidence
can be observed, missing or stale; it is never presented as a proven cause. Reports
are locally previewed and downloaded with the PT-23 redaction whitelist.

## Visual record

Captured from `Sidebar/WorkerTroubleshooter` in Storybook at 360 × 880 using the
repository's active skin. The dialog scrolls vertically; the report screenshot shows
the lower part after scrolling. These are component documentation, not E2E geometry
assertions. Fixtures contain synthetic hostnames and diagnostic data.

| State                       | Screenshot                              | Review focus                                          |
| --------------------------- | --------------------------------------- | ----------------------------------------------------- |
| Candidate selection         | [Ready](01-ready.png)                   | Current rule, scope, evidence and one change per step |
| Active test                 | [Testing](02-testing.png)               | Helped / not helped, deadline, restore                |
| Helped                      | [Separate save decision](03-helped.png) | Success does not automatically persist settings       |
| Trusted Site                | [Blocked](04-trusted.png)               | No test can override a Trusted Site                   |
| Restored / report           | [Local report](05-restored-report.png)  | Before/after selector and redacted JSON preview       |
| Missing evidence, dark skin | [Dark](06-dark-missing-evidence.png)    | Uncertainty and active theme tokens                   |

## Runtime coverage

| Surface                           | Handling                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| Chromium MAIN                     | Existing installers receive a narrowed resolved snapshot                            |
| Chromium early inline             | Preload/window seed carries the same fields and rejects expired activation          |
| Firefox pre-bootstrap             | Hash/static/window seed narrows worker fields while preserving other surfaces       |
| Dedicated workers                 | Existing worker payload is unchanged; unrelated spoofed values remain active        |
| Service Workers                   | Native registration only; no claim that Service Worker globals are spoofed          |
| SharedWorkers                     | Native policy for the tested top host; other top hosts keep their configured policy |
| Background/content/injection      | Existing temporary-override storage, alarm, cache, headers and seed lifecycle       |
| Popup/sidebar                     | Shared dialog, explicit decisions, cancellation on closure                          |
| Options                           | Existing exact-host rule editor owns the saved exception; no new options workflow   |
| Add/update/disable/remove/restore | Existing rule lifecycle; save checks configuration fingerprint and test ID          |

Firefox worker requests with no tab ID are bound only through browser-owned frame
records. If any possible owner keeps a protected worker policy, the request stays
protected. Service Worker script requests are excluded from the SharedWorker filter.

Concrete regression tests cover policy isolation, exact expiry, stale seed replay,
restart/orphan recovery, competing tests, stale saves, Trusted Sites and full-pause
conflicts. Browser tests cover real registration, shared-worker values, both iframe
inheritance directions, restoration, popup closure, permanent save and local downloads.

## Validation

- `pnpm task lint`, `pnpm task check`, `pnpm task test:unit`
- `pnpm task build:chrome`, `pnpm task build:firefox`, `pnpm task test:build-contracts:ci`
- Chromium: `pnpm exec playwright test --config config/playwright.config.ts tests/e2e/extension-worker-test.spec.ts` (3 passed)
- Firefox: runtime-test build, then `pnpm task test:e2e:runtime:firefox:ci -- --grep 'Firefox worker assistant'` (1 passed)
- Storybook: worker assistant and shared Dialog interaction stories, including dark skin
- Formatting, test lanes/targets/layers/determinism and generated worker-source consistency

The shared core and generated worker source were unchanged. The visual review found
a portal foreground inheritance bug in dark dialogs; the shared dialog surface now
owns the foreground token alongside its background token.
