# Runtime leak classification

Classify the first incorrect layer. Do not start at the UI symptom and guess backward.

## 1. Resolution and storage

The snapshot is already wrong before page-world installation.

Inspect:

- `src/background/rules/resolver.ts` and focused resolver tests;
- persisted rule, fallback and Trusted Sites precedence;
- target offset, locale, geolocation, fingerprint flags and `authKey` preservation;
- active tab and Firefox `cookieStoreId` context.

A resolver defect is not fixed in an injected patch.

## 2. Preload and bootstrap

The resolved snapshot is correct, but the affected realm sees no marker, stale state or
the host value on its earliest read.

Chromium source order:

1. `chrome.storage.session` preload;
2. `window.name` seed from `webNavigation.onBeforeNavigate`;
3. frame snapshot injection on `webNavigation.onCommitted`;
4. bounded on-demand resolution fallback.

Firefox early source order:

1. hash seed;
2. embedded static host payload;
3. `window.name` backup;
4. late ephemeral convergence/update channel.

Inspect `src/background/index.ts`, `src/content/bootstrap.ts`,
`src/content/preloaded-runtime.ts`, `src/injection/firefox/early.ts` and the focused
bootstrap/transport tests. Never clear the `window.name` seed after reading it.

## 3. Patch semantics and integrity

The marker and expected snapshot are present, but a value, descriptor, prototype,
constructor, exception or `Function.prototype.toString` result is wrong.

Inspect the semantic owner in `packages/refract-core` first, then the relevant installer
under `src/injection/main` or `src/injection/firefox`. Check both the returned value and
native-observable behavior. Date/Intl and geolocation must be tested with controlled
time, not wall-clock sleeps.

## 4. Realm parity

The page path is correct while an iframe or worker path diverges.

Inspect:

- iframe installation and realm ownership under `src/injection/main`;
- worker wrapper and URL repair in `packages/refract-browser/src/common`;
- `packages/refract-worker/src/worker-runtime.ts` and the generated worker source;
- dedicated, shared and service-worker probes where the surface applies.

If shared core changed, confirm the generated worker source is current before diagnosing
the worker as an independent implementation.

## 5. Network/runtime coherence

Runtime locale or permissions are correct while request headers, client hints or
permission state disagree. Compare DNR output and runtime state from the same resolved
snapshot. Keep `Accept-Language`, client hints, `navigator.language`, `Intl` and
geolocation permission coherent.

## 6. X-Ray reporting

Spoofing is correct, but surface activity is absent, duplicated or shown with the wrong
capability/state. Inspect the shared surface catalog, usage emitter, authenticated
channel and UI mapping. Do not change spoofing semantics to repair presentation.

## Minimum comparison

For the affected surface, capture when applicable:

| Path                  | Value | Descriptor/integrity | Runtime marker | Usage event |
| --------------------- | ----- | -------------------- | -------------- | ----------- |
| Vanilla browser       |       |                      | n/a            | n/a         |
| Chromium main         |       |                      |                |             |
| Chromium early-inline |       |                      |                |             |
| Firefox early         |       |                      |                |             |
| Worker                |       |                      |                |             |

Mark non-applicable paths explicitly rather than leaving them unexamined.
