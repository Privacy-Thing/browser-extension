# Runtime parity matrix

## Entry points

| Runtime path          | Primary consumer                                | Decision | File evidence | Test evidence |
| --------------------- | ----------------------------------------------- | -------- | ------------- | ------------- |
| Chromium main         | `src/injection/main/index.ts`                   |          |               |               |
| Chromium early-inline | `src/injection/main/early-runtime.ts`           |          |               |               |
| Firefox pre-bootstrap | `src/injection/firefox/early.ts`                |          |               |               |
| Worker runtime        | `packages/refract-worker/src/worker-runtime.ts` |          |               |               |

Allowed decisions are `changed`, `reused shared helper`, `mirrored inline` and
`not applicable`. Explain every intentional divergence.

## Semantic ownership map

| Surface                            | Shared owner                                                       | Additional consumers or transport               |
| ---------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------- |
| Date / Intl                        | `packages/refract-core/src/time`                                   | main installers, Firefox early, worker          |
| Geolocation / cache / `maximumAge` | `packages/refract-core/src/geolocation`                            | main, Firefox bridge, worker                    |
| Locale defaults                    | `packages/refract-core/src/time`                                   | DNR/header alignment, main, Firefox, worker     |
| Geolocation permission             | `packages/refract-core/src/geolocation/geolocation-permissions.ts` | main and Firefox early                          |
| Client hints                       | `packages/refract-core/src/fingerprint/client-hints-getters.ts`    | main, Firefox policy, worker                    |
| Canvas, WebGL, audio, screen       | `packages/refract-core/src/fingerprint`                            | main installers, iframe/worker where applicable |
| Worker construction                | `packages/refract-browser/src/common`                              | main and early wrappers                         |
| Surface integrity                  | `packages/refract-core/src/integrity`                              | runtime installers and X-Ray reporting          |
| X-Ray Inspector trap binding       | `packages/refract-browser/src/common/surface-usage-emitter.ts`     | snapshot `analystTraps`, live endpoint, worker  |

Confirm actual imports before relying on this map; it describes ownership, not proof that
every surface applies to every target.

## Inspector trap delivery

Each bundle swaps its own emitter through `setAnalystTraps(config | null, revision)`; while
disarmed the binding is `recordSurfaceUse` itself. A new document receives the selection in
its snapshot. A loaded document receives it live only through its private endpoint
(`src/injection/main/analyst-channel.ts` to `src/content/analyst-endpoints.ts`).

| Runtime path          | New document                                                      | Loaded document                                            |
| --------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------- |
| Chromium main         | snapshot, revision 0; commit-time delivery, revision 1            | live: top and cross-origin frames                          |
| Chromium early-inline | snapshot, revision 0                                              | live with the main bundle of the same document             |
| Firefox pre-bootstrap | revision-gated shim state                                         | live; Date/Intl early adapters have no method IDs          |
| Worker runtime        | dedicated: bootstrap snapshot with the document's current binding | running workers keep theirs; SharedWorkers are never armed |

Script-opened windows, same-origin child frames with their own runtime and documents whose
runtime arrived after page scripts apply on the next load. Parent-owned realms follow their
parent's binding and open no endpoint. Release builds, which ship no Inspector UI, contain
neither endpoint half. The isolated half listens only until both bundles have handed over
or the document_start task ends, and hides only handshakes accepted before any page script
exists.

## Change checklist

- Authoritative `RuntimeSnapshot` field and normalization identified.
- Shared semantic helper updated once where possible.
- Chromium main decision recorded.
- Chromium early-inline decision recorded.
- Firefox pre-bootstrap decision recorded, including first-call timing.
- Worker decision recorded and generated bundle refreshed.
- Iframe/service/shared-worker behavior considered where applicable.
- Descriptor, prototype, constructor and native masking behavior tested.
- Network/runtime locale and permission coherence considered.
- Surface-usage/X-Ray behavior considered separately from spoofing.
- No repeated JSON parsing, `Intl` construction or background messaging added to a hot
  path.
- Focused tests use controlled time and observable readiness.
- Both Chromium and Firefox build.

## Suggested verification ladder

Choose only applicable steps, moving from narrow to broad:

```sh
pnpm exec vitest run --config <target-config> <focused-test>
pnpm task check:test-targets
pnpm task generate:worker-source
pnpm task check:worker-source
pnpm task check
pnpm task build:chrome
pnpm task build:firefox
pnpm task verify:quick
```

The full ladder does not replace a browser/runtime proof when the failure is timing- or
realm-specific.
