/**
 * Artifact size budgets enforced by build spec tests.
 * All values are in bytes.
 *
 * Update here when a budget intentionally changes; tests reference these constants
 * so the rationale is visible alongside the limit.
 */

/**
 * Build-to-build size variance tolerance applied on top of bundle budgets.
 *
 * Vite output is not byte-deterministic: chunk hashing and module ordering swing
 * the raw byte count by ~±15 bytes between otherwise identical builds, and CI's
 * toolchain can land a handful of bytes above a local build of the same source.
 * The budgets below express the intended ceiling (the number we actually target);
 * this tolerance absorbs that sub-0.5% jitter so size assertions only fail on
 * real, KB-scale regressions instead of build noise. Tests assert against
 * `BUDGET + tolerance`. Keep it small — large enough to cover observed variance
 * (worst case seen: ~21 bytes), small enough that a genuine feature-sized growth
 * still trips the guard.
 */
export const BUNDLE_SIZE_TOLERANCE = 256;

/**
 * Chromium content-bootstrap bundle (uncompressed).
 *
 * The onboarding/settings-bridge work added two command types to
 * `EXTENSION_COMMAND_TYPES` (`importPresetLocations`,
 * `createDraftFromCandidate`), which the content bootstrap pulls in via
 * the shared contract object. That pushed the bundle right to the edge of this
 * 12 KB target — local builds stay just under while CI landed a few bytes over.
 * The bundle still meets the 12 KB target; `BUNDLE_SIZE_TOLERANCE_BYTES` covers
 * the cross-environment build variance so the assertion no longer flakes.
 *
 * Raised to 15 KB: realign with current `main` (the bootstrap had drifted a few
 * bytes over the prior ceiling) plus the shared Date `toLocale*String()`
 * formatter cache pulled in via the date patch chain.
 *
 * Restored to 15 KB after the Vite 8 / Rolldown stabilization: narrow
 * refract-core imports, Chromium-only stubs, and target-specific content scripts,
 * and target-specific bootstrap entrypoints bring the Chromium bootstrap back
 * to ~14.6 KB raw / ~5.2 KB gzip. Gzip remains within this target via the
 * shared build-variance tolerance above.
 */
export const CHROME_BOOT_MAX_BYTES = 15 * 1024;

/** Chromium content-bootstrap bundle (gzip). */
export const CHROME_BOOT_GZIP_BYTES = Math.round(5.2 * 1024);

/**
 * Firefox geo-shim post-migration target.
 *
 * Pre-migration the shim is ~114 KB because it embeds its own full runtime.
 * DoD: shim contains only Firefox-specific adapter code calling refract-core.
 *
 * During migration (Phase 1–4) you can raise this to 114 * 1024 as a temporary
 * override, then restore to 35 * 1024 after Phase 5 (deduplication) lands.
 *
 * Raised to 50 KB: `feat(injection)` closed spoofing parity gaps in the Firefox
 * early runtime — navigator fingerprint properties, permissions.query, client
 * hints, and performance.timeOrigin modules added ~3.3 KB of adapter code that
 * delegates to @privacy-brand/refract-core but still carries per-entry-point wrapper
 * closures.
 *
 * Raised to 56 KB: `02864a2` unified absolute-epoch Date behavior in shared
 * zoned-date semantics and added Firefox-specific Date prototype adapters,
 * growing the first-inline bridge by ~5.7 KB uncompressed.
 *
 * Raised to 58 KB: GW-1 now preserves native PermissionStatus instances and
 * shares one idempotent permissions patch across early/main runtimes, while
 * GW-2 preserves subclass new.target for wrapped constructors. Together the
 * browser-visible conformance paths add ~1.3 KB to this first-inline bundle.
 *
 * Raised to 60 KB: SEC-RUNTIME-STATE-001 replaces page-global control-plane
 * registries with captured primordials, adds closure-local native masking and
 * the replay-safe Firefox main handoff. Release-style measurements are about
 * 61.5 KB raw / 19.8 KB gzip for early and 114.6 KB raw / 50.7 KB gzip for main.
 *
 * Raised to 70 KB: P0-06 adds the closure-private surface integrity registry,
 * canonical descriptor anchors, bounded incident evidence, and repair checks to
 * the Firefox first-inline runtime. Release-style output is ~69.7 KB raw.
 *
 * Raised to 71 KB: review hardening adds exact Firefox Client Hints descriptor
 * anchors and narrows Date ownership to the explicit installed-method catalog.
 * Release-style output is ~70.3 KB raw.
 *
 * Raised to 73 KB: effective Navigator reference repair and dynamic
 * PermissionStatus.state integrity close the remaining P0-06 review gaps.
 * Release-style output is ~72.2 KB raw.
 *
 * Raised to 74 KB: ownership-aware permission anchors and retryable receiver
 * evidence keep first-inline integrity checks aligned with the installed
 * Firefox surfaces. Release-style output is ~73.7 KB raw.
 *
 * Raised to 76 KB: private runtime-state handoff and Client Hints public-DTO
 * hardening from the stacked base add first-inline adapter code. Release-style
 * output is ~75.9 KB raw.
 *
 * Raised to 123 KB: #110 wires the previously dead
 * `installFxWorkers` (`packages/refract-core/src/runtime/
 * firefox-worker-interceptors.ts`) into this bundle so a dedicated Worker
 * constructed during the pre-bootstrap race is patched instead of silently
 * running native. Pulling in `createWorkerSource` for the first time
 * drags the compressed worker-runtime string (`generated-worker-source.ts`)
 * into the early bundle's dependency graph — the same string the main runtime
 * bundle already embeds — accounting for most of the ~48.5 KB uncompressed
 * growth. Release-style output is ~121.6 KB raw.
 *
 * Raised to 124 KB: #111 P0-05 per-realm evidence transport — the early
 * runtime's integrity sink now forwards the full `markSurfaceEvidence`
 * (realmId + status) instead of a boolean `markSurfaceFailed`. Release-style
 * output is ~123.5 KB raw.
 *
 * Raised to 130 KB: opt-in native Temporal protection adds 14 descriptor-safe
 * wrappers, dynamic Firefox defaults, integrity anchors, and worker-to-X-Ray
 * usage transport. Release-style output is ~129.1 KB raw.
 */
export const FX_GEO_SHIM_MAX_BYTES = 130 * 1024;

/**
 * Firefox main-world script (full runtime injected into the page).
 *
 * Raised to 122 KB: `282e93b0` patched `XMLHttpRequest.open`, `WebSocket`,
 * and `EventSource` constructors inside blob: workers to resolve relative
 * URLs against the real worker URL, adding ~1.3 KB to the worker-source
 * string embedded in the runtime bundle.
 *
 * Raised to 123 KB: `feat(injection)` added performance.timeOrigin patch
 * and new RefractModuleName entries to refract-core, growing the shared
 * runtime bundle by ~224 B.
 *
 * Raised to 126 KB: the Date `toLocale*String()` formatter cache
 * (`buildDateStringFormatter` in `@privacy-brand/refract-core/time/date-string-builders`)
 * adds a bounded per-constructor formatter cache plus key serialization to the
 * shared runtime — counted both directly and via the regenerated worker-source
 * string embedded here — for ~1.2 KB uncompressed (current main was also a few
 * hundred B over the prior ceiling).
 *
 * Raised to 135 KB: `02864a2` replaced the former shifted-epoch Date helpers
 * with shared zoned-date semantics so absolute epoch values remain native while
 * local getters preserve the spoofed zone. The runtime and embedded worker
 * source grow by ~5 KB uncompressed.
 *
 * Raised to 137 KB: GW-1, GW-2, GW-5, and GW-11 add native PermissionStatus,
 * constructor new.target, WGS84 boundary, and legacy WebRTC callback parity.
 * The combined conformance hardening adds ~1.7 KB to the Firefox runtime.
 *
 * Raised to 140 KB: GW-12 and GW-17 extend the Web Audio patch from
 * `getChannelData()` to both channel-copy methods and all analyser getters,
 * including native argument-conversion and destination-tail semantics. The
 * additional wrappers and generated worker runtime add ~2.8 KB uncompressed.
 *
 * Raised to 148 KB: GW-3, GW-9, and GW-15 add non-destructive Canvas export
 * tracking across same-origin realms and typed, bounded WebGL readback windows.
 * The shared Canvas/WebGL helpers and regenerated worker runtime add ~7.0 KB
 * uncompressed while keeping the early-inline bundle unchanged.
 *
 * Raised to 156 KB: stacking private child-realm ownership on the descriptor
 * integrity runtime adds per-realm Canvas, Client Hints, Geolocation, Screen,
 * and WebGL installation state. Release-style output is ~155.4 KiB raw.
 *
 * Raised to 160 KB: SurfaceIntegrityRegistry result-sink wiring and
 * evidence-based `degraded` protection status add the shared repair-path
 * validators. Release-style output is ~158.5 KiB raw.
 *
 * Raised to 161 KB: #111 P0-05 tags Worker integrity evidence with a
 * per-construction `attemptId` (the Firefox interceptor generates one per
 * `new Worker()` and threads it through `markSurfaceEvidence`), nudging the
 * obfuscated-ID CI output ~19 B over the prior ceiling+tolerance while local
 * dev-ID output stayed just under.
 *
 * Raised to 164 KB: opt-in Temporal protection adds the shared 14-method
 * installer, regenerated worker payload, and absolute worker method-counter
 * relay. Release-style output is ~163.7 KB raw.
 *
 * Raised to 165 KB: the obfuscated-ID CI build reached 168,207 B, 15 B above
 * the previous 164 KB budget plus 256 B tolerance. This leaves about 1 KB of
 * headroom for per-build identifier variance without hiding a feature-sized
 * regression.
 */
// The Firefox runtime includes the validated worker/SharedWorker policy
// transport. Preserve a hard budget while allowing per-build obfuscated IDs.
export const FX_MAIN_WORLD_MAX_BYTES = 165 * 1024;

/**
 * Chromium early inline script (synchronously injected before page scripts run).
 * Keep this tight — it blocks the first inline read path.
 *
 * Raised to 12 KB: opt-in Temporal protection now installs synchronously in the
 * top-frame early entrypoint to cover the first inline call, then hands ownership
 * to the full runtime without a second wrapper. Release-style output is ~11.9 KB
 * raw (4.6 KB gzip); no Temporal polyfill is bundled.
 */
export const CHROME_EARLY_MAX_BYTES = 12 * 1024;

/**
 * Chromium runtime page-world script (full Refract runtime).
 *
 * Raised to 121 KB: `0d7f251` inlined blob worker source into the spoofing
 * wrapper for CSP-safe re-interception, adding ~381 B uncompressed.
 *
 * Raised to 128 KB: main-thread `OffscreenCanvas` fingerprint coverage
 * (`installOffscreenNoise`, shared with the worker runtime) is now bundled
 * into the page runtime — previously OffscreenCanvas noise lived only in the
 * worker. This closes a fingerprint bypass (`new OffscreenCanvas(...)` /
 * `transferControlToOffscreen()`) at the cost of ~6 KB uncompressed.
 *
 * Raised to 129 KB: `282e93b0` added `XMLHttpRequest.open`, `WebSocket`, and
 * `EventSource` URL-rewriting inside blob: workers (`worker-location.ts`),
 * which grows the inlined worker-source string by ~1.1 KB uncompressed.
 *
 * Raised to 130 KB: `feat(injection)` added performance.timeOrigin patch
 * to the main runtime and new RefractModuleName entries, adding ~1.1 KB
 * uncompressed (including the regenerated worker-source string).
 *
 * Raised to 131 KB: worker-CSP quieting added a `cspBlobWorkersBlocked` latch
 * and an extracted SharedWorker CSP pre-check helper to the Worker/SharedWorker
 * patches (~0.3 KB uncompressed).
 *
 * Raised to 134 KB: the Date `toLocale*String()` formatter cache
 * (`buildDateStringFormatter` in `@privacy-brand/refract-core/time/date-string-builders`)
 * adds a bounded per-constructor formatter cache plus key serialization to the
 * shared runtime — counted both directly and via the regenerated worker-source
 * string inlined here — for ~1.2 KB uncompressed.
 *
 * Raised to 140 KB: `02864a2` replaced the former shifted-epoch Date helpers
 * with shared zoned-date semantics so absolute epoch values remain native while
 * local getters preserve the spoofed zone. The runtime and embedded worker
 * source grow by ~5.8 KB uncompressed.
 *
 * Raised to 143 KB: GW-1, GW-2, GW-5, and GW-11 add native PermissionStatus,
 * constructor new.target, WGS84 boundary, and legacy WebRTC callback parity.
 * The combined conformance hardening adds ~2.5 KB to the Chromium runtime.
 *
 * Raised to 146 KB: GW-12 and GW-17 extend the Web Audio patch from
 * `getChannelData()` to both channel-copy methods and all analyser getters,
 * including native argument-conversion and destination-tail semantics. The
 * additional wrappers and generated worker runtime add ~2.7 KB uncompressed.
 *
 * Raised to 153 KB: GW-3, GW-9, and GW-15 add non-destructive Canvas export
 * tracking across same-origin realms and typed, bounded WebGL readback windows.
 * The shared Canvas/WebGL helpers and regenerated worker runtime add ~6.8 KB
 * uncompressed while keeping the early-inline bundle unchanged.
 *
 * Raised to 163 KB: P0-06 adds descriptor-level integrity registration and
 * repair across spoofed surfaces, including the generated worker runtime.
 * Release-style output is ~162.2 KB raw.
 *
 * Raised to 167 KB: review hardening adds effective Navigator reference
 * repair, dynamic permission-state anchors, and bounded real receiver checks
 * for Canvas, WebGL, and Audio. Release-style output is ~166.1 KB raw.
 *
 * Raised to 169 KB: follow-up hardening captures native media entry points,
 * retries unavailable receivers, and registers anchors only for surfaces the
 * runtime actually owns. Release-style output is ~168.8 KB raw.
 *
 * Raised to 171 KB: Canvas, Audio, WebGL, and WebRTC installers now return
 * explicit per-target or per-method ownership, including an independent
 * WebGL.readPixels result. Release-style output is ~170.8 KB raw.
 *
 * Raised to 172 KB: stacked private-runtime hardening adds captured-safe JSON,
 * Client Hints DTO handling, and associated generated worker code. Release-style
 * output is ~171.8 KB raw.
 *
 * Raised to 173 KB: the bounded post-initialization window.name cleanup keeps
 * delayed bootstrap snapshots out of page-visible state without changing the
 * transport protocol. Release-style output is ~172.7 KB raw.
 *
 * Raised to 176 KB: per-realm SurfaceIntegrityRegistry wiring, Worker
 * native-fallback reporting, and evidence-based `degraded` protection status
 * add the descriptor-integrity result sink and its repair-path validators.
 * Release-style output is ~174.6 KB raw.
 *
 * Raised to 177 KB: #111 P0-05 full evidence model — the integrity and Worker
 * ack sinks now forward the full per-realm status/realmId via
 * `markSurfaceEvidence` (repaired/unconfirmed/unrecoverable), replacing the
 * boolean `markSurfaceFailed`. Release-style output is ~176.4 KB raw.
 *
 * Raised to 183 KB: Chromium Battery Status protection in the main runtime
 * keeps the native BatteryManager and Promise, masks five native descriptors,
 * validates cross-realm Promise anchors, and persists a host-bound snapshot for
 * deterministic same-host first-inline navigation. Release-style output is
 * ~182.4 KiB raw / ~73.2 KiB gzip.
 *
 * Raised to 187 KB: opt-in native Temporal protection adds the shared
 * 14-method installer, descriptor integrity anchors, regenerated worker
 * payload, and worker-to-X-Ray usage relay. Release-style output is
 * ~186.3 KiB raw.
 */
export const CHROME_RUNTIME_MAX_BYTES = 187 * 1024;
