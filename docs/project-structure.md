# Project Structure

> Canonical product and architecture documentation lives in Notion. This file is a
> code-adjacent reference for navigating the repository; it is not the source of truth.

```text
privacy-thing/
├── .agents/
│   └── skills/            # Canonical skills; agents/openai.yaml holds UI metadata
├── .claude/
│   └── skills             # Symlink → ../.agents/skills
├── .github/
├── .storybook/
├── AGENTS.md              # AI agent instructions (symlinked as CLAUDE.md)
├── CHANGELOG.md
├── CLAUDE.md              # symlink → AGENTS.md
├── config/
│   ├── manifest.ts        # MV3 manifest builder (shared Chromium/Firefox base)
│   ├── playwright.config.ts
│   ├── postcss.config.mjs
│   ├── tailwind.config.ts
│   ├── vite.config.ts     # Multi-target build config; sets __PT_BROWSER_TARGET__
│   ├── vitest.config.base.ts
│   ├── vitest.config.chromium.ts
│   └── vitest.config.firefox.ts
├── PRIVACY.md
├── README.md
├── build/
├── docs/
├── package.json
├── packages/
│   ├── platform-api-conformance/ # API conformance workspace package
│   ├── refract-browser/   # Browser-facing bootstrap and shim helpers
│   ├── refract-core/      # Shared spoofing logic consumed by every runtime entry point
│   ├── refract-test-harness/ # Target-parity test harness
│   ├── refract-worker/    # Worker runtime + generated bundle
│   ├── tooling-shared/    # Shared tooling contracts/helpers package
│   ├── ui/                # Shared UI core workspace package
│   └── xray-protocol/     # Surface-usage channel protocol
├── pnpm-lock.yaml
├── public/
├── Taskfile.yml           # Primary contributor task runner
├── tsconfig.json
├── scripts/               # CI/release automation scripts
├── src/
└── tests/
```

## Build outputs

`build/` is the single working directory for everything this repository generates, and
the only generated path in `.gitignore`. A task that produces files points at `build/`;
it does not create a new top-level directory and does not get a new ignore entry.

```text
build/
├── artifacts/         # Packaged releases: zip, xpi, source archive
├── chrome/            # Chrome extension output (pnpm task build:chrome)
├── coverage/          # Per-target unit coverage (neutral, chromium, firefox)
├── firefox/           # Firefox extension output (pnpm task build:firefox)
├── playwright/        # BrowserLeaks screenshots from manual E2E runs
├── pnpm-store/        # pnpm store for CI jobs that cannot share the runner cache
├── storybook-static/  # Static Storybook export
├── test-benchmarks/   # Test-suite benchmark runs
├── test-results/      # Playwright output directory and traces
└── web-ext-profile/   # Local Firefox dev profile
```

Three paths are ignored outside `build/`: `.vercel/`, `.playwright-cli/` and
`playwright-report/`. None of them is produced by a task in this repository — they are
defaults of external tooling that cannot be redirected from configuration.

## Source tree

```text
packages/
├── platform-api-conformance/
│   └── src/                              # Runtime snapshot capture, diffing, scanning, and reporters
├── refract-browser/
│   └── src/common/                       # Worker bootstrap, Firefox shim state, shared emitters
├── refract-core/
│   └── src/                              # Time/Intl, geolocation, locale, permissions, client hints
├── refract-test-harness/
│   └── src/                              # Target-parity tests for the shared core
├── refract-worker/
│   └── src/                              # Worker runtime; generated-worker-source.ts is build-generated
├── tooling-shared/
│   └── src/                              # Shared tooling-facing brand/contracts/firefox helpers
├── ui/
│   └── src/                              # Generic UI core package
└── xray-protocol/
    └── src/                              # Surface-usage channel protocol

src/
├── background/                          # Service worker: orchestration, storage, rule resolution
│   ├── index.ts                         # Entry point: event listeners, bootstrap seeding, message dispatch
│   ├── firefox-static-payload.ts        # Firefox static state-carrier source builder for optional userScripts
│   ├── behavioral-profiles.ts           # Behavioral profile management
│   ├── config-watch.ts                  # Storage change watcher → reload/re-seed active tabs
│   ├── dnr.ts                           # Declarative Net Request: Accept-Language + client-hints header rules
│   ├── location-drafts.ts               # Ephemeral location draft state
│   ├── logger.ts                        # Background-side structured logger
│   ├── migrations.ts                    # Storage schema migrations
│   ├── privacy.ts                       # WebRTC policy enforcement
│   ├── settings.ts                      # Global preferences helpers
│   ├── state-hygiene.ts                 # browsingData cleanup; Firefox-safe API shape (see AGENT.md debt #3)
│   ├── rules/
│   │   └── resolver.ts                  # Profile → RuntimeSnapshot resolution (offsetMs, locale, geo)
│   └── storage/
│       ├── behavioral-profiles.ts       # chrome.storage CRUD for behavioral profiles
│       ├── container-assignments.ts     # Firefox container → rule mapping
│       ├── control-state.ts             # Extension on/off, per-domain override flags
│       ├── locations.ts                 # Saved locations storage
│       ├── preferences.ts               # Global preferences storage
│       ├── rules.ts                     # Domain rules storage
│       └── site-suggestions.ts          # Site suggestion cache
│
├── content/                             # Isolated-world content scripts (document_start)
│   ├── bootstrap.ts                     # Reads preloaded snapshot → injects inline script into MAIN world
│   ├── firefox-heartbeat-forwarder.ts   # Firefox-only bridge for unconditional geo-shim bootstrap heartbeats
│   ├── preloaded-runtime.ts             # Reads/writes chrome.storage.session preload cache
│   └── sync-config.ts                  # Post-bootstrap rule sync on storage changes
│
├── injection/                           # MAIN-world page scripts (anti-fingerprinting)
│   ├── main/
│   │   ├── index.ts                     # Full runtime: geo + date + locale + worker interception
│   │   ├── early-runtime.ts             # Early-inline runtime: runs before full runtime attaches
│   │   ├── early.ts                     # Entry point that triggers early-runtime install
│   │   ├── date-intl-patch.ts           # Date constructor + Intl.DateTimeFormat patches
│   │   ├── locale-patch.ts              # navigator.language/languages patch
│   │   ├── client-hints-patch.ts        # navigator.userAgentData client-hints patch
│   │   └── service-worker-patch.test.ts
│   ├── firefox/
│   │   └── geo-shim.ts                  # Firefox MAIN-world pre-bootstrap shim: geo + date + locale
│   │                                    # Prefers embedded static host payload on matched rules, then converges
│   │                                    # through DOM/event transport and older Firefox fallback carriers
│   ├── shared/
│   │   ├── geo-behavior.ts              # Geo behavior engine: simple cadence + behavioral profile simulation
│   │   ├── geo-patch.ts                 # navigator.geolocation API patch (shared by main paths)
│   │   ├── native-date.ts               # getNativeDate() — captures real Date before patching
│   │   ├── native-mask.ts               # maskAsNative() — preserves .name/.toString() descriptors
│   │   ├── runtime-config.ts            # RuntimeSnapshot reader from globalThis symbol
│   │   ├── webrtc-sanitize.ts           # RTCPeerConnection config sanitization
│   │   ├── worker-bootstrap.ts          # Worker wrapper: embeds stringified runtime snapshot + patches
│   │   │                                # ⚠ Cannot import shared modules; mirrors injection logic as strings
│   │   ├── firefox-shim-state.ts        # DOM port for isolated→MAIN world state transfer (Firefox)
│   │   └── firefox-time-locale.ts       # Date/locale helpers used by geo-shim.ts
│   └── worker/
│       └── index.ts                     # Worker entry point (loaded inside worker blob wrapper)
│
├── scripts/                             # Build-time and release scripts (not bundled)
│   ├── build-channel-config.test.ts
│   ├── extract-beta-release-notes.test.ts
│   ├── generate-firefox-update-manifest.test.ts
│   ├── promote-unreleased-changelog.test.ts
│   ├── publish-cws.test.ts
│   └── resolve-build-metadata.test.ts
│
├── shared/                              # Shared utilities (used by background + injection + ui)
│   ├── browser-fingerprint.ts           # Browser fingerprint surface helpers
│   ├── domain-match.ts                  # Domain pattern matching
│   ├── profile-schema.ts                # Zod schema for user profiles
│   ├── time-zone-offset.ts              # DST-aware UTC offset helpers
│   └── types.ts                         # Core types: RuntimeSnapshot, Profile, etc.
│
├── targets/
│   └── firefox/
│       └── containers-api.ts            # Firefox contextualIdentities API wrapper
│
├── types/                               # Global ambient type declarations
│   ├── build-target.d.ts                # __PT_BROWSER_TARGET__ global type
│   ├── mjs-modules.d.ts
│   ├── raw-imports.d.ts
│   └── tz-lookup.d.ts
│
└── ui/                                  # React UI: options page, popup, logs, demo (React/Shadcn/Tailwind)
    ├── behavioral-capture/              # Behavioral profile capture page
    ├── branding/                        # Logo, icon, theme tokens
    ├── components/
    │   ├── ui/                          # shadcn/ui components (@/ui/components/ui/)
    │   └── stories/                     # Storybook stories for all UI components
    ├── i18n/                            # UI string constants (English only)
    ├── logs/                            # Extension event log viewer
    ├── options/                         # Main options page (tabs: Rules, Locations, Containers, etc.)
    │   ├── components/
    │   │   ├── map/                     # Leaflet map component for location editing
    │   │   ├── modals/                  # Location editor, rule dialog, OSM consent
    │   │   └── tabs/                    # One component per tab
    │   └── state/
    │       └── SettingsContext.tsx      # Global options page state
    ├── popup/                           # Extension popup
    ├── privacy-policy/                  # Privacy policy page
    ├── shared/                          # Shared UI layout + theme utilities
    ├── spoofing-demo/                   # Live spoofing demo page
    └── styles/
        └── globals.css                  # Tailwind base + skin CSS variables
```

## Tests

```text
tests/
└── e2e/                 # Playwright E2E tests (loads real Chromium/Firefox extension)
```

Unit tests (`.test.ts` / `.test.tsx`) live next to the files they test.

## Build system notes

- `config/vite.config.ts` produces separate entry bundles per extension target (background, content, injection/main, injection/early, popup, options, etc.)
- `__PT_BROWSER_TARGET__` is a compile-time constant (`"chromium"` | `"firefox"`) injected by Vite; use it for browser-specific code paths
- `pnpm task build:chrome` / `pnpm task build:firefox` build one target; `pnpm task build` builds both
- package.json scripts still exist as compatibility forwarders, but Task is the canonical interface
- The `document_start` injection bundles (`early.ts`, content scripts) are kept minimal by design — avoid importing heavy dependencies there
