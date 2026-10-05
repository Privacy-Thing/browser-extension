# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and the project follows Semantic Versioning.

## [Unreleased]

### Added

- Added an experimental, one-way Control D regional DNS integration to local
  and beta builds. It previews managed rule changes, requires confirmation
  before the first sync, preserves unrelated Control D resources, and guides
  users through manual browser DoH setup. The dedicated four-step flow can
  explicitly recover setups created with the v2 Privacy Thing naming scheme
  after reinstalling, while release builds preserve but never load its private
  storage namespace.
- A “Site not working?” assistant offers one temporary Service Worker or
  SharedWorker policy test for the exact top-document host. Failed, cancelled
  and expired tests restore current settings; saving a host exception requires
  a separate confirmation. Redacted before/after reports stay local. Global
  WebRTC policy is unchanged.

- Regional preset editing, generation, and import now show advisory coordinate/time-zone
  checks and previews of browser languages, Accept-Language, and seasonal date/number
  formatting. Applying a suggestion changes only the time zone; intentional differences
  can still be saved or imported.
- Pause spoofing for an exact top-document host for 10 minutes or until browser
  exit. Matching tabs and their supported frames/workers share the exception;
  permanent configuration and global WebRTC policy remain unchanged. Deadline
  expiry restores decisions for new documents; open documents show a reload
  requirement. Requests without a tab context keep the configured global header policy.
- X-Ray can preview and download a versioned local diagnostic report as JSON or
  text. Site data is excluded by default; opt-in adds only the hostname and
  matching rule or Trusted Site pattern. Reports exclude secrets, preset IDs,
  coordinates, fingerprints and raw logs, and distinguish missing or stale
  observations from configured protection.

- Configuration imports now show a preview before confirmation, detect newer edits,
  recover interrupted writes, and offer one local undo copy for 7 days (until the
  next configuration edit). Undo restores configuration, not website sessions.
- Import can merge selected presets and rules with explicit ID/pattern conflict
  choices, remapped preset references, and manual Firefox container mapping.

- Added complete Spanish and Portuguese interface translations, selected
  automatically from the browser interface language with English as the fallback.
- Added complete Russian and Ukrainian interface translations, selected
  automatically from the browser interface language.
- X-Ray now counts BatteryManager property reads (`charging`, `chargingTime`,
  `dischargingTime`, `level`) in addition to `navigator.getBattery`.

### Changed

- Upgrade the location map to MapLibre GL JS 6 while keeping its worker bundled
  locally for Chromium and Firefox extension pages. Maps now require WebGL2.

- The interface language can be chosen in Settings. Automatic still follows the
  browser language. Popup, sidebar, and Settings update without a reload.
- Language choices show the English name and the name from the active translation.
  The English interface keeps English names only.
- Accent colors, protection labels, and X-Ray labels follow the active interface
  language. Long About link labels stay inside their buttons.
- Experimental: every subframe in a tab now uses the top-frame runtime snapshot
  (locale, timezone, fingerprint, geolocation) so iframe and worker realms do
  not diverge from the page. Per-tab header rules apply to all requests in that
  tab, including Trusted Site iframe hosts, and outrank Trusted Site allow
  rules. Domain fencing session rules still apply only to the top-frame host.

### Fixed

- Control D keeps saved route overrides when all rules for a region are disabled,
  and status colors follow integration state in every interface language.

- Control D previews now expire when local or remote inputs change, and background
  actions serialize with disconnect. Automatic sync never approves approximate
  routes; moving a hostname between exit folders preserves the rule. API keys
  migrate to private extension storage. The setup uses concise labels in all five
  languages, and release bundle checks still run when a display version is set.

- Preserve optional profile country codes through saving, export and import,
  including later edits, so Control D keeps selecting exits in the confirmed
  country. Lowercase codes still normalize to uppercase; older profiles without
  a country code remain valid.
- Keep Control D synchronization attached to resources by their saved IDs when
  the API normalizes display names, restore automatic sync after the obsolete
  name conflict, and keep preview and sync on one prepared regional-route
  snapshot without rewriting Control D hostname patterns. Hide automatic route
  matches until a fallback needs confirmation or the user opens overrides.
- Worker policy tests now run in a persistent window and restore protection if
  activation fails or the window closes. Saved host exceptions change only the
  selected worker policy, preserve Firefox container profiles, and can be removed
  in Settings. Test scope and privacy tradeoffs use shorter translated labels.

- Invalid time zones in legacy presets no longer interrupt preload and header
  refreshes for unrelated rules or containers. The affected preset stays inactive
  until repaired, and the time zone picker avoids duplicate UTC entries.

- Experimental Domain fencing now uses the bundled Public Suffix List, including
  private hosting suffixes, wildcards and exceptions. Independent S3 tenants and
  school domains no longer share a fingerprint partition. Corrected site boundaries
  produce new per-site fingerprints on the next activation after updating; sites
  whose boundary is unchanged keep their identity. Saved seeds and auth keys remain
  unchanged. Domain fencing remains disabled by default.
- Saving and importing location presets now reject time zones unsupported by the
  browser before any settings write, with the preset name, ID and `timeZone` field
  in the error. UTC and supported aliases remain valid. For an invalid preset saved
  by an older version, open Settings → Locations, edit the preset, choose a supported
  time zone, save and reload affected tabs. The draft remains editable; activation
  rejects the invalid preset instead of substituting the device time zone.

- Keep popup rule-editor Selects open through leftover opening-pointer dismisses
  and host window resize/blur that Radix treats as dismiss, without replacing
  the shared Select.
- Confirm installed Battery protection before a page first queries the API, and clear
  stale integrity evidence after the protection recovers.

## [0.9.3.11] - 2026-10-04

- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) from upstream sources to keep spoofed fingerprints current.

## [0.9.3.10] - 2026-10-01

- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) from upstream sources to keep spoofed fingerprints current.

## [0.9.3.9] - 2026-09-28

- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) from upstream sources to keep spoofed fingerprints current.

## [0.9.3.8] - 2026-09-22

- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) from upstream sources to keep spoofed fingerprints current.

## [0.9.3.7] - 2026-09-19

- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) from upstream sources to keep spoofed fingerprints current.

## [0.9.3.6] - 2026-09-16

- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) from upstream sources to keep spoofed fingerprints current.

## [0.9.3.5] - 2026-09-10

- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) from upstream sources to keep spoofed fingerprints current.

## [0.9.3.4] - 2026-09-07

- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) from upstream sources to keep spoofed fingerprints current.

## [0.9.3.3] - 2026-09-01

### Fixed

- Sort previous product updates by version and dismissed site warnings by
  resolution time, with the newest entries shown first.

## [0.9.3.2] - 2026-09-01

### Fixed

- Show current release announcements after a fresh store installation and keep
  earlier product updates available in popup history. Release-notification
  synchronization now repairs missing entries on startup without reopening
  announcements that were already read.
- Label product-news history as "Previous updates" and closed site warnings as
  "Dismissed" instead of grouping both under "Resolved".

## [0.9.3.1] - 2026-08-31

- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) from upstream sources to keep spoofed fingerprints current.

## [0.9.3] - 2026-08-31

### Added

- Added an experimental Domain fencing option. When the Default Rule or a
  Firefox container applies, each site gets its own stable fingerprint.
  Manually chosen regional presets stay the same. Per-site fingerprints are
  computed in the background on Chrome and Firefox. The shared Default Rule
  preload keeps the baseline fingerprint so first-inline never falls through
  to the real browser; host-bound rows then carry the per-site variation.
- Added a 0.9.3 popup announcement for experimental Domain fencing.

### Fixed

- Keep popup product-release notifications unread across metadata revisions
  (`X.Y.Z.REV`). Auto-read still applies when the `X.Y.Z` product version changes.
- Treat replacement of Canvas `getImageData` / `toDataURL` / `toBlob` as
  tampering when the prototype identity has not changed, including replacing
  all three anchors, and ignore iframe ownership methods shadowed on the
  element instance.

## [0.9.2.7] - 2026-08-28

- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) from upstream sources to keep spoofed fingerprints current.

## [0.9.2.6] - 2026-08-25

- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) from upstream sources to keep spoofed fingerprints current.

## [0.9.2.5] - 2026-08-23

- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) from upstream sources to keep spoofed fingerprints current.

## [0.9.2.4] - 2026-08-21

- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) from upstream sources to keep spoofed fingerprints current.

## [0.9.2.3] - 2026-08-19

- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) from upstream sources to keep spoofed fingerprints current.

## [0.9.2.2] - 2026-08-17

- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) from upstream sources to keep spoofed fingerprints current.

- Fixed Chromium popups staying at sidecar width after the sidecar closes.
- Removed the unintended bright focus outline from automatically opened popup sidecars.

## [0.9.2.1] - 2026-08-15

- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) from upstream sources to keep spoofed fingerprints current.

## [0.9.2] - 2026-08-15

### Added

- Add an opt-in Temporal API protection flag with Time & Locale spoofing across
  page, iframe, Firefox early-bootstrap, and worker runtimes.
- Add 0.9.2 popup announcements for experimental Temporal API protection and the
  public source release.

### Changed

- License the public source under AGPL-3.0-or-later with section 7 terms and a
  separate commercial licensing option.
- Replace the About page's Playground shortcut with direct links to the website,
  source repository, and bug-report form.

### Fixed

- Verify every Chromium early Temporal wrapper through a dedicated private handoff
  before the main runtime adopts it, and synchronize late locale and time-zone
  snapshots.
- Preserve cached Temporal feature-flag changes across overlapping settings writes.
- Seed dynamically navigated same-origin iframes before their document starts so
  browser surfaces do not briefly expose native values while background bootstrap
  is still resolving.
