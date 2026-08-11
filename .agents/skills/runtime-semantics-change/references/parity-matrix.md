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

Confirm actual imports before relying on this map; it describes ownership, not proof that
every surface applies to every target.

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
