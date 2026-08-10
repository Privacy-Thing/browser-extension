# Contributing

## Read this first

**This project is not accepting contributions yet.**

You can open an issue or a pull request, but there is a real chance it gets closed,
deferred indefinitely, or never looked at. That is annoying, and it is deliberate: the
project is early, scope and direction are being kept narrow, and the contributor
agreement that would let external patches be merged does not exist yet.

Opening a pull request does not create an obligation on this side. It may be closed,
left alone, shrunk, or reimplemented differently later.

If that is acceptable to you, read on.

## Security issues do not go here

A spoofing bypass, a detection leak, or anything that lets a page identify the extension
is not a normal bug. Report it privately — see [SECURITY.md](SECURITY.md). Do not open a
public issue and do not send a pull request that demonstrates the leak.

## What has the best chance of being accepted

- Small, focused bug fixes.
- Reproductions: a page or a snippet that shows a surface leaking, with the browser and
  version. These are genuinely useful even without a fix attached.
- Narrow reliability or performance fixes, especially in injected hot paths.
- Corrections to documentation that is factually wrong.

## What has the worst chance

- Large pull requests.
- New features nobody asked for.
- Rewrites and opinionated restructuring.
- Anything widening what the product does.
- New dependencies. Every one of them runs in a process that touches store credentials
  at release time.

A thousand-line pull request full of new surfaces will be closed quickly.

## Open an issue first

For anything beyond a small fix, open an issue before writing code. That is not a promise
the change will be wanted, but it saves you from building something that gets rejected on
direction rather than quality.

Spoofing correctness has non-obvious constraints. Read [AGENTS.md](AGENTS.md) before
touching runtime code — it lists the invariants that are easy to break by accident, each
one there because it broke in production at least once.

## If you still open a pull request

Keep it small. Say exactly what changed and exactly why it should exist. Do not mix
unrelated fixes.

- **UI change?** Include before/after screenshots.
- **Anything involving motion, timing, transitions, or interaction?** Include a short
  video. Stills do not show what actually changed.
- **Spoofing behaviour?** Say which browser and version you verified on, and what a page
  observes before and after.

If the reviewer has to guess what changed, the change is much less likely to be reviewed.

## Setup

Node.js 24 and pnpm 11, activated through Corepack using the `packageManager` field in
`package.json`.

```bash
pnpm install
pnpm task verify:quick
```

## What CI expects

```bash
pnpm task lint     # runs with --max-warnings 0; every warning blocks
pnpm task check    # typecheck
pnpm task test:unit
pnpm task build:chrome
pnpm task build:firefox
```

`pnpm task verify` runs the full local equivalent of CI, including the Playwright suite.
Prettier owns formatting — do not hand-format around it.

## Things that will fail review regardless of how good the idea is

- **Time-based tests.** No `setTimeout`, sleeps, `waitForTimeout()` or wall-clock
  intervals to sequence a test. Drive off observable state — DOM, events, `expect.poll`,
  `waitFor` — and inject a clock or use fake timers when the logic itself depends on
  time. Real elapsed time is the main source of flaky CI here, and retries are not an
  accepted fix.
- **Editing generated files.** `packages/refract-worker/src/generated-worker-source.ts`
  and `src/shared/hardware-profiles.*.generated.ts` are build output. Change the source
  and regenerate.
- **Forgetting to regenerate the worker bundle** after touching `packages/refract-core`.
  Run `pnpm task generate:worker-source` and commit the result, or workers silently keep
  running the old logic. `pnpm task check:worker-source` will catch it.
- **Asserting translated copy in e2e.** Assert the model through `data-*` state hooks
  instead. Text assertions are fine for user data — location names, hostnames, rule
  patterns.
- **Asserting CSS or geometry in e2e.** That belongs in Storybook stories.
- **Relaxing TypeScript.** `strict`, `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes` stay on.

## Shared spoofing logic

Core logic lives once in `packages/refract-core` and is consumed by four runtime entry
points: the Chromium main runtime, the Chromium early-inline runtime, the Firefox
pre-bootstrap runtime, and the build-generated worker bundle. A fix lands once, but each
entry point has to be re-verified.

Say explicitly in the pull request, per entry point, whether it changed, reused the shared
helper, mirrored the change inline, or is not applicable — and back each claim with a file
and a test. A path that diverges on purpose needs that reason written down.

## Commits

Conventional Commits for subjects. Add or update focused tests near the behaviour you
changed rather than broad smoke tests. Update `CHANGELOG.md` under `## [Unreleased]` when
users can observe the change. Both Chromium and Firefox must keep building.

## Licensing

This repository is distributed under the terms in [LICENSE.md](LICENSE.md).

External pull requests are not being merged yet. A contributor agreement has to be in
place before they can be, and it is not ready. That is the whole reason there is nothing
for you to sign right now — not an oversight.

Nothing sent in the meantime is treated as granting anything beyond the repository's
current terms.
