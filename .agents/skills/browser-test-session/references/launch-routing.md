# Browser Session Launch Routing

Choose one route. `<task>` is a short stable slug for the current investigation; reuse
the same path while iterating.

## Component-only UI

```sh
pnpm task storybook
```

Use for component states, interaction semantics, accessibility and geometry when the
extension runtime is not required.

## Chromium interactive session

Watched build plus a persistent development profile:

```sh
PT_CHROME_PROFILE=build/agent-profiles/<task>/chrome pnpm task dev:chrome
```

Launch an already-built `build/chrome` without watchers only after proving that artifact
is current:

```sh
PT_CHROME_PROFILE=build/agent-profiles/<task>/chrome pnpm task start:chrome
```

The watched build updates files but does not silently replace code loaded by Chrome.
Reload Privacy Thing in `chrome://extensions`, then reload or recreate the target tab as
required by the claim.

## Firefox interactive session

Watched build plus a persistent development profile:

```sh
PT_FIREFOX_PROFILE=build/agent-profiles/<task>/firefox pnpm task dev:firefox
```

Launch an already-built `build/firefox` without watchers only after proving that artifact
is current:

```sh
PT_FIREFOX_PROFILE=build/agent-profiles/<task>/firefox pnpm task start:firefox
```

The Firefox launcher resolves `FIREFOX_EXECUTABLE_PATH`, then
`PT_FIREFOX_BINARY`, then Playwright Firefox. Keep the same profile only for manual
iteration; the runtime E2E harness owns separate isolated state.

## Focused Chromium E2E

Build once, select the owning lane and invoke Playwright directly so file and grep
filters remain explicit:

```sh
pnpm task build:chrome
PT_E2E_LANE=<core-or-product> pnpm exec playwright test \
  --config config/playwright.config.ts tests/e2e/<spec>.spec.ts \
  --grep '<test name>'
```

Use `release` only for the explicit external diagnostic specs and `publish` only for its
release-gate ownership. Do not add retries or real-time sleeps.

## Focused Firefox runtime E2E

The task forwards arguments to the Firefox runtime runner:

```sh
pnpm task test:e2e:runtime:firefox -- --grep '<test name>' --workers=1
```

Use the sibling `runtime-triage` skill when the Firefox runtime failure is
not yet classified.

## Session rules

- One task slug identifies one owned manual profile.
- One healthy browser process is reused across edits.
- One representative target is enough unless the contract is browser-specific or parity
  must be demonstrated.
- Automated E2E keeps its fixture-created temporary profiles; do not point it at the
  reusable manual profile.
- Stop only the process attached to the owned execution session.
