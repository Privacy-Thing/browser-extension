# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and the project follows Semantic Versioning.

## [Unreleased]

### Changed

- Control D setup now opens when enabled and automatically creates or reconnects a
  single ready setup and applies safe plans. One explicit action remembers consent
  for approximate routes; changed routes, removals and conflicts require review.
  A failed ownership check preserves the adopted setup and requires plan review.
- Control D shows labeled setup steps, clearer planned changes and a dismissible
  sync summary. Disconnect is available throughout setup, resource codes are
  explained, and API-key errors reserve space below the field.

### Added

- Simplified Chinese and Traditional Chinese (Taiwan) interface languages. Automatic
  chooses Traditional for Chinese browser languages from Taiwan, Hong Kong and Macao or
  with a Traditional script tag, and Simplified for other Chinese. The translations are
  machine-made and not yet reviewed by a native speaker; the language setting says so
  and links to the translation error report.
- X-Ray Inspector can stop script execution when a page script uses a spoofed API
  you choose, on its first call or on every call, while browser developer tools are
  open for the tab. Turn on Inspector in Page activity and pick whole categories or
  single methods, with search and a "used on this page" filter; a category shows
  whether all, some or none of its methods are selected. Methods Inspector cannot
  stop on, because the rule does not spoof them or the browser has no hook for them,
  are shown but cannot be selected. A status dot on the Inspector toggle shows
  whether a selection is armed, not armed or changed since it was armed, and X-Ray
  explains when Inspector is unavailable for a Trusted Site, paused protection or an
  unsupported page. In Chrome DevTools a stop opens a one-line script-stop note, the
  next call stack frame is the calling page code, and the extension's own frames are
  ignore-listed. Arming and disarming take effect immediately on the open page and
  its cross-origin frames, without a reload, or can wait for the next load.
  Script-opened windows and same-origin frames with their own runtime pick the change
  up on their next load, dedicated workers started afterwards use it while running
  ones keep the earlier selection until the page reloads, and a tab that cannot be
  updated live is reloaded instead. A selection belongs to one tab and its current
  domain. Firefox cannot stop on Date or Intl calls, and shared workers are never
  stopped. Available in beta and development builds.

- The optional Control D integration is now included in production builds for Chromium
  and Firefox, with API access requested only when connecting.

- Domain rules can include several explicit patterns sharing one configuration and
  identity. The editor manages all patterns, the rule list shows one configuration,
  and the popup lists its complete scope. Pattern edits reject empty, duplicate or
  conflicting membership. Groups work independently of plugins and survive service
  unlinking, restart and settings backups.

- Privacy Thing automatically suggests matching Control D services
  when creating or editing a domain rule. The editor and popup let users choose, change
  or unlink a service, with a compact plugin badge and visible request progress; Save
  commits the choice with the rule. A service already linked to another rule offers
  adding the pattern to that rule, previews and locks its shared settings, and requires
  consent before creation. Service links survive pattern changes and settings backups.
  Control D prepares recognition automatically, synchronizes eligible redirects and
  preserves unrelated remote rules. Help and preset guidance explain synchronization
  and the service's potentially wider scope; Privacy Thing protects only the rule's
  explicit patterns.

- Experimental Control D integration offers a reviewed disconnect-and-delete
  option for recorded, unchanged resources, with a browser DNS confirmation and
  retryable cleanup results. Plain Disconnect continues to preserve remote resources.

- Added a compact Control D introduction explaining account resources, data sharing,
  retained resources and manual DNS setup, with both privacy policy links. Local and
  beta builds label the integration with a Beta badge.

- Added an optional, one-way Control D regional DNS integration. It previews
  managed rule changes internally, asks for review when a decision is needed,
  preserves unrelated Control D resources, and guides users through manual browser
  DoH setup. The dedicated four-step flow can recover setups created with the v2
  Privacy Thing naming scheme after reinstalling.
- A “Site not working?” assistant offers one temporary Service Worker or
  SharedWorker policy test for the exact top-document host. From the popup it opens
  as its own compact window sized to its content, so the site stays usable during
  the test. Failed, cancelled and expired tests restore current settings; saving a
  host exception requires a separate confirmation and ends the test with its
  result. Redacted before/after reports stay local. Global WebRTC policy is
  unchanged.

- Regional preset editing, generation, and import now show advisory coordinate/time-zone
  checks and previews of browser languages, Accept-Language, and seasonal date/number
  formatting. Applying a suggestion changes only the time zone; intentional differences
  can still be saved or imported. Coordinates outside land show a coordinates warning
  instead of a fixed-offset `Etc/GMT` zone suggestion.
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
  Import errors are shown as readable messages, with technical details collapsed.
  A file that uses a reserved name such as `constructor` or `__proto__` as a preset
  ID, container ID or key, or `__proto__` as a rule pattern, is rejected with an
  error naming it and where it occurs. New presets never receive such an ID, and an
  existing preset with one (for example, named “Constructor”) gets a new ID once, so
  exports stay importable. When a file's preset uses a time zone this browser does
  not support, the import dialog offers the usual time zone list for each such
  preset and previews the file again, including the regional review, once every
  preset has a supported zone; the file itself is not changed. Several time zone
  corrections made at once in the preview are all kept.

- Added complete Spanish and Portuguese interface translations, selected
  automatically from the browser interface language with English as the fallback.
- Added complete Russian and Ukrainian interface translations, selected
  automatically from the browser interface language.
- X-Ray now counts BatteryManager property reads (`charging`, `chargingTime`,
  `dischargingTime`, `level`) in addition to `navigator.getBattery`.

### Changed

- The privacy policy now has a separate section for the optional Control D
  integration. It lists what is sent to Control D (rule hostnames, chosen
  exits, resource names, optional service lookups and the API key), what stays
  local, what remains in the Control D account after disconnecting, and links to
  Control D's own privacy policy.

- About and Regional Presets copy no longer claims that Privacy Thing never
  affects routing or the IP address. It now says that browser-level spoofing alone
  does not route traffic, that the optional Control D integration can sync domain
  rules to a matching exit once its resolver is configured, and that enabling it
  sends rule hostnames, chosen exits and managed resource names to Control D.
  Translated for English, Spanish, Portuguese, Russian and Ukrainian.
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

- Russian and Ukrainian copy names the product again where English does, Spanish
  translates the WebRTC ICE policy row, Portuguese uses a proper ellipsis while
  saving, and X-Ray translates the GPU renderer info label in Russian, Ukrainian and
  Chinese.

- Privacy and Options text no longer calls location search and map previews the
  only optional network requests or says the extension stays offline. It now
  describes map access only and points to integrations such as Control D, which
  have their own settings.

- Editing a regional preset that rules use no longer shows a large "still assigned"
  warning above the map and fields. Delete stays reachable by mouse, keyboard and
  touch; for a used preset it opens an alert that names how many rules use the
  preset, with a short scrollable list of them, instead of deleting it. Closing this
  alert or a confirmation in Options returns focus to the button that opened it.

- Connecting Control D in Firefox no longer fails after access to all websites was
  turned off for the extension.

- Dialogs use a thinner animated accent frame instead of the thick accent-coloured
  border. In the X-Ray panel they fill the whole panel; elsewhere they use nearly the
  full width of narrow windows such as the popup. Long titles wrap beside the close
  button instead of running under it, and stacked action buttons keep a gap. The
  troubleshooter, report and import dialogs no longer scroll sideways, the frame stays
  in place while a long dialog scrolls, and the report keeps its actions in view on
  short panels. Scrollbars are a thin, rounded, draggable handle in the accent colour,
  without arrows, that stays faint until you point at or focus the scroll area; in
  Chrome it also widens when the pointer reaches it, without moving the content. High
  contrast keeps it fully visible. Scroll areas keep their scrollbar space, so content
  no longer shifts sideways when it starts or stops scrolling.

- Pickers no longer draw option rows outside their popup on short windows.

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

- Saved worker exceptions no longer defer Firefox early protection in cross-origin
  frames of unrelated sites. Frames with an unknown top host start with the
  protected baseline until tab-aware state arrives.

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

## [0.9.3.20] - 2026-10-31

- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) from upstream sources to keep spoofed fingerprints current.

## [0.9.3.19] - 2026-10-28

- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) from upstream sources to keep spoofed fingerprints current.

## [0.9.3.18] - 2026-10-25

- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) from upstream sources to keep spoofed fingerprints current.

## [0.9.3.17] - 2026-10-22

- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) from upstream sources to keep spoofed fingerprints current.

## [0.9.3.16] - 2026-10-19

- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) from upstream sources to keep spoofed fingerprints current.

## [0.9.3.15] - 2026-10-16

- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) from upstream sources to keep spoofed fingerprints current.

## [0.9.3.14] - 2026-10-13

- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) from upstream sources to keep spoofed fingerprints current.

## [0.9.3.13] - 2026-10-10

- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) from upstream sources to keep spoofed fingerprints current.

## [0.9.3.12] - 2026-10-07

- Refreshed extension metadata (hardware profiles, Chrome versions, locale data) from upstream sources to keep spoofed fingerprints current.

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
