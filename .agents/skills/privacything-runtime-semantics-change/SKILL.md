---
name: privacything-runtime-semantics-change
description: Implement or review a validated change to Privacy Thing spoofing semantics across Chromium main, Chromium early-inline, Firefox early and workers. Use when editing shared runtime behavior, an injected browser surface, bootstrap-dependent semantics, native masking, permissions, locale/time, geolocation, or worker parity.
---

# Privacy Thing Runtime Semantics Change

Use this skill when the desired semantic change or root cause is known. For unresolved
leaks and failing runtime tests, use the sibling
[`privacything-runtime-triage`](../privacything-runtime-triage/SKILL.md) skill first.

Before editing, read [references/parity-matrix.md](references/parity-matrix.md) and the
runtime invariants in the repository `AGENTS.md`.

## Make the change at its semantic owner

1. Identify the authoritative state and shared helper before touching an entry point.
2. Put reusable spoofing semantics in `packages/refract-core`; keep browser transport and
   wrappers in `packages/refract-browser`.
3. Keep entry points as consumers or thin installers. Do not create a new hand-mirrored
   implementation when the shared core can own the behavior.
4. Preserve observable browser behavior: descriptors, prototypes, constructor wiring,
   exceptions and native `toString` output.
5. Keep runtime, network, permissions and X-Ray state coherent when the surface crosses
   those boundaries.

## Verify every runtime path

Complete the parity matrix even when only one file changed. Each path must be marked
`changed`, `reused shared helper`, `mirrored inline` or `not applicable`, with file and
test evidence.

After any change under `packages/refract-core`, regenerate the committed worker bundle:

```sh
pnpm task generate:worker-source
pnpm task check:worker-source
```

Never edit `packages/refract-worker/src/generated-worker-source.ts` directly.

## Test proportionally

1. Add or update the focused test closest to the semantic owner.
2. Use `*.target.test.ts(x)` when both compile-time targets consume the dependency
   closure; use browser-specific suffixes only for genuinely target-specific behavior.
3. Add first-inline, iframe or worker coverage only for a concrete timing/realm failure.
4. Use fake timers or an injected clock for time-dependent behavior.
5. Run focused tests, `check:test-targets`, `check:worker-source`, TypeScript and both
   target builds. Use the relevant E2E/runtime lane when the change crosses bootstrap or
   browser boundaries.
6. Inspect bundle impact when code enters an early/content/injected hot path.

Update `CHANGELOG.md` when users can observe the change. If the change alters a durable
architecture or contributor contract, update or flag the canonical documentation rather
than creating an ad-hoc local architecture document.

## Report

Include the completed parity matrix, generated worker status, focused tests, both target
build results and any path that could not be exercised locally.
