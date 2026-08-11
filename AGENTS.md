# Privacy Thing — agent notes

Privacy Thing is an MV3 extension for per-domain anti-fingerprinting and location
spoofing. Optimize for spoofing correctness, invisibility to page scripts,
cross-browser behavior and low overhead. `CLAUDE.md` links to this file.

## Stack and boundaries

- Use `pnpm`. Keep TypeScript `strict`, `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes` enabled.
- Vite, React 19, shadcn/ui, Tailwind and MapLibre belong in `src/ui`; elsewhere use
  native browser-extension and web primitives.
- Keep ownership clear: `src/background` stores and resolves state, `src/content`
  bootstraps and synchronizes it, `src/injection` runs in page/worker worlds, `src/ui`
  owns product UI, and `src/shared` owns cross-layer schemas and utilities.

## Repository skills

Read the matching skill before acting when a task fits its trigger:

- [runtime triage](.agents/skills/runtime-triage/SKILL.md) for unresolved
  leaks, first-call misses, realm differences and Firefox runtime failures;
- [runtime semantics change](.agents/skills/runtime-semantics-change/SKILL.md)
  for implementing or reviewing a validated injected-runtime change;
- [browser test session](.agents/skills/browser-test-session/SKILL.md) for
  iterative manual browser verification with an isolated, reusable extension profile;
- [CI failure triage](.agents/skills/ci-failure-triage/SKILL.md) for a
  concrete GitHub Actions run or failing check;
- [file PR](.agents/skills/file-pr/SKILL.md) for committing the completed
  task scope, pushing its branch and opening a ready-for-review pull request;
- [public boundary audit](.agents/skills/public-boundary-audit/SKILL.md) for
  public snapshots, fork workflows, source archives and legacy identifier review.

Skills contain procedures; the invariants below always apply even when no skill is
selected.

## Runtime invariants

1. Install invisible overrides in the page `MAIN` world. Preserve descriptors,
   prototypes, native behavior and native `toString` output.
2. `offsetMs` is DST-aware `(targetOffset - localOffset)`, never the raw target UTC
   offset.
3. Date `toString`-family methods un-shift the epoch before `Intl.DateTimeFormat`; stale
   formatters and explicit `Date` arguments must not double-apply the offset.
4. `authKey` is a random per-rule nonce minted once at the storage boundary and then
   preserved verbatim. Never derive it from `ruleSeedKey` or mint it during resolution.
5. Never clear the `window.name` runtime snapshot after reading it. Background seeding
   removes an older Privacy Thing payload before writing the next one.
6. `noiseRadius` is a hard privacy bound. Spoofed coordinates must stay inside it.
7. `maximumAge` is caller input from `PositionOptions`, not persisted profile state.
   Compare it with the actual cached-fix age at call time.
8. Worker Blob wrappers change the base URL. Preserve relative `importScripts()` and
   `fetch()` repair in `packages/refract-browser/src/common/worker-bootstrap.ts`.
9. Keep `Accept-Language`, client hints, `navigator.language`, `Intl` and geolocation
   permission coherent with the same resolved runtime state.
10. Firefox is first-class, including `cookieStoreId` resolution. Time/locale still have
    an earliest-inline race window, so do not assume Chromium parity or casually change
    Firefox preload/bootstrap code.
11. Firefox `browsingData.remove()` rejects the Chromium-only `origins` shape; preserve
    the target-safe implementation in `src/background/state-hygiene.ts`.

## Shared runtime and bootstrap

`packages/refract-core` owns shared spoofing semantics. Chromium main, Chromium
early-inline, Firefox pre-bootstrap and the worker runtime consume it. Every semantic
change must explicitly account for all four paths through the runtime-semantics skill.

The worker payload is generated. After changing `packages/refract-core`, run
`pnpm task generate:worker-source`; never edit
`packages/refract-worker/src/generated-worker-source.ts` directly.

Bootstrap order is load-bearing. Chromium uses session preload → `window.name` seed →
committed-frame injection → bounded on-demand fallback. Firefox uses hash → embedded
static host payload → `window.name` → late convergence. Seed/cache before bootstrap
reads. There is no live hot-swap; settings changes refresh state and may reload the tab.

## Check every affected surface

Before calling a cross-cutting change done, account for every applicable surface:

- browser targets: Chromium and Firefox;
- runtime paths: Chromium main, Chromium early-inline, Firefox pre-bootstrap and workers;
- extension surfaces: background, content, injection, popup, options and sidebar;
- state transitions: add, update, disable, remove and reload or restore.

An explicit “not applicable” is valid; silently checking only one path is not.

## Settings and performance

- Every scalar preference default comes from `DEFAULT_PREFERENCES` /
  `normalizePreferences`. Do not add per-field inline defaults such as `?? true`,
  `Boolean(x)`, `= false` or `useState(false)`.
- Preferences persist in the background-owned `preferences` object; UI writes partial
  `saveSimpleSettings` commands.
- Trusted Sites override rules and fallback and fully disable the product for that host.
  The global fallback rule is its own entity, not a regular domain rule.
- Do not add repeated JSON parsing, `Intl` construction, localization, rule matching or
  background messaging to injected hot paths. Precompute and cache per activation.

## Testing

- Start with the smallest proof that exercises the changed behavior: focused tests,
  targeted lint or type checks and the relevant build. Expand to broader gates when a
  change crosses runtime paths, browser targets, generated artifacts or release
  boundaries.
- Never gate tests on real delays, sleeps, wall-clock intervals or `waitForTimeout()`.
  Wait for observable state; use fake timers or an injected clock for time semantics.
- Remove nondeterminism instead of adding retries. Assert controlled invariants rather
  than exact GPU-dependent output.
- E2E asserts the model, not translated sentences. Prefer `data-*` state hooks; text
  assertions remain valid for user data such as names, hosts and patterns.
- E2E does not assert CSS or geometry; those checks belong in Storybook.
- `*.test.ts(x)` is neutral, `*.target.test.ts(x)` runs for both compile targets, and
  `*.chromium.test.ts(x)` / `*.firefox.test.ts(x)` are target-only.
- Every Playwright spec belongs to exactly one positive lane: `core`, `product`,
  `release`, `publish` or `firefox-runtime`.
- Add focused tests for concrete regressions. Do not add broad smoke coverage or weaken
  existing assertions to admit a change.

## UI conventions

- `AppPageFrame` owns the shared shell and `BrandLogo` owns link semantics.
- Use active skin tokens; do not hard-code light/dark colors where tokens exist.
- Give each popup visual property one owner: a semantic `gw-popup-*` class or a utility,
  never both. Do not use `!important` in popup styles.
- Keep Radix interaction primitives and check existing stories before creating a new
  component or variant.
- Product names in language packs come from the shared branding helper.
- Prefer a shared layout, lifecycle, token or provider fix over per-screen exceptions.

## Generated files and commands

Hardware catalogs are generated by `pnpm generate:hardware`; selection stays within the
host OS and `navigator.deviceMemory` remains Chrome-capped at 8 GB. Do not hand-edit
generated catalogs, worker source or store metadata.

Use the Taskfile through `pnpm task`. Common gates are `lint`, `format`, `check`,
`test:unit`, `test`, `verify:quick`, `verify`, `build:chrome` and `build:firefox`.
Prettier owns formatting. `pnpm task lint` uses `--max-warnings 0`; code-style details
live in `docs/code-style.md`.

## Working, documentation and releases

- Prefer small, scoped changes and the simplest correct model. Preserve unrelated
  worktree changes; do not infer commit or push authorization.
- Do not perform destructive actions or broaden the requested scope without explicit
  approval.
- If a repository rule conflicts with the requested task, name the conflict and obtain
  explicit approval before breaking either contract.
- Use TypeScript deliberately and explain only non-obvious intent in comments.
- Keep both Chromium and Firefox working. Update `CHANGELOG.md` for user-visible changes.
- Canonical product and architecture documentation lives in Notion. Local `docs/` are
  code-adjacent references, automation and contributor navigation, not the source of
  truth.
- Release automation runs through `publish`; scheduled metadata refresh may create a
  four-part revision from the last stable tag, but only when the repository variable
  `METADATA_REFRESH_ENABLED` is exactly `true`. Credential jobs download and verify
  artifacts rather than building them.
- Never cut a version, create or push a release tag, or trigger a release workflow
  without explicit approval.
