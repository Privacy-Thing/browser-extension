---
name: verify-privacything
description: Drive Privacy Thing's Chromium extension UI and runtime the way a user does. Use when proving popup, options, X-Ray, or per-site protection behavior, or when a change needs live extension evidence rather than unit tests.
---

# Verify Privacy Thing

Privacy Thing is an unpacked MV3 extension. Users touch the toolbar popup, the options page, and the X-Ray sidebar. Chromium is the representative product target. Firefox is first-class for runtime and containers. Do not treat Storybook as extension proof. Do not attach to the operator's everyday browser profile.

Read `features/README.md` before driving. The map is the source of which entry points count. Then follow Launch, Doctor, Drive, Evidence, Cleanup below.

## Launch

Proof and agent runs use an isolated Chromium context that loads `build/chrome`. Interactive iteration uses the repo launchers with a task-specific profile.

Build first unless `build/chrome/manifest.json` already matches the work under test.

```sh
pnpm task build:chrome
```

Ready when `build/chrome/manifest.json` exists and `version_name` ends in `-local` for a source build.

**Proof launch (default).** Do not leave a browser running. The drive helper starts Chromium, exercises one feature, writes artifacts, and exits.

```sh
node .cursor/skills/verify-privacything/scripts/doctor.mjs
node .cursor/skills/verify-privacything/scripts/drive-popup.mjs
```

**Interactive launch.** Use a disposable profile under `build/agent-profiles/<task>/`. Never `PT_CHROME_PROFILE` pointing at the user's Chrome Default.

```sh
PT_CHROME_PROFILE=build/agent-profiles/verify-privacything/chrome pnpm task start:chrome
```

Ready when stdout contains `[chrome-dev] loaded Privacy Thing` and an options tab opens at `chrome-extension://<id>/src/ui/options/index.html`. Rebuilds update files only. Reload the extension on `chrome://extensions`, then reload the target tab. Cursor may set `PLAYWRIGHT_BROWSERS_PATH` to an empty sandbox cache. The helpers fall back to Google Chrome or `PT_CHROME_BINARY`.

Watched rebuilds use `pnpm task dev:chrome` with the same `PT_CHROME_PROFILE`. For Firefox interactive work, `PT_FIREFOX_PROFILE=build/agent-profiles/<task>/firefox pnpm task start:firefox`. Firefox runtime E2E is `pnpm task test:e2e:runtime:firefox`. Do not point Playwright at a reusable manual profile.

Two instances can run side by side if each has its own profile directory and Playwright uses a fresh `mkdtemp` user-data dir. Do not double-drive one shared profile.

## Doctor

Run this before driving whenever the instance looks stale, after a rebuild, or after a failed attempt.

```sh
node .cursor/skills/verify-privacything/scripts/doctor.mjs
```

Pass means all of:

- Node is 24+ and `pnpm` is available.
- `node_modules` exists.
- `build/chrome/manifest.json` exists with `manifest_version` 3.
- Popup, options, and sidebar HTML exist under `build/chrome/src/ui/`.
- The derived unpacked Chromium extension ID is printed.
- A Chromium executable is found (`PT_CHROME_BINARY`, Playwright's browser, or Google Chrome).

Fail means do not drive. Rebuild, install deps, or fix the printed path. An interactive session is only worth driving if its profile is under `build/agent-profiles/` or `build/chrome-profile`, the loaded unpacked path is this repo's `build/chrome`, and the service worker is the current build. Refuse to drive the operator's normal Chrome or Firefox profile.

## Drive

Prefer stable ids and `data-*` hooks. Do not use coordinates or translated copy except for user data such as hostnames and profile labels (`Warsaw`).

**Popup.** `chrome-extension://<id>/src/ui/popup/index.html?tabId=<n>` after the target tab exists. Ready when `#toggle-current-rule` is visible and `#current-rule` has `data-presentation`. Seed example profiles with `pt:load-sample-data` when the location list is empty. Assign a site profile with `#open-domain-rule-settings`, then `#current-rule-mode`, `#current-profile-select`, `#apply-current-profile`.

**Options.** `chrome-extension://<id>/src/ui/options/index.html`. Tabs are `[data-tab="<name>"]`. The selected panel is `[data-panel="<name>"]`. Names are `profiles`, `rules`, `trusted-sites`, `advanced`, `about`. URL hashes use `page-locations`, `page-rules`, `page-trusted-sites`, `page-advanced`, `page-about`. Bypass onboarding with `pt:save-simple-settings` and `onboardingCompleted: true` only in disposable profiles.

**X-Ray.** User path is popup `#open-xray` (Chromium side panel). Direct page is `chrome-extension://<id>/src/ui/sidebar/index.html`. Ready when `[data-xray-section="page-activity"]` exists. X-Ray state is per tab. Open the site tab first.

**Automated regression.** Product lane is popup, options, and state. It is not a substitute for the feature map when the map lists other entry points.

```sh
pnpm task build:chrome
PT_E2E_LANE=product pnpm exec playwright test \
  --config config/playwright.config.ts \
  tests/e2e/<spec>.spec.ts \
  --grep '<test name>'
```

Wait for observable state. Never `waitForTimeout`. Do not assert CSS or geometry here. Those checks belong in Storybook.

## Evidence

Proof artifacts go in `build/verify-privacything/<feature-id>/`. Cleanup must not delete that directory.

Standards:

- Drive the real popup, options, or sidebar page. Do not call internal setters as the only proof.
- Capture the action and the resulting state. A final screenshot without the before state is incomplete for mutations.
- For a rule or profile change, also read persisted settings (`pt:get-settings`) or reopen the UI from a second entry.
- Record the feature id, extension id, `version_name`, target URL, and entry point with every artifact.
- UI proof is an ARIA snapshot plus a screenshot that shows the Privacy Thing identity (popup logo role `img` name `Privacy Thing`, or the options brand).
- Product-lane Playwright JSON or stdout is extra evidence, not a replacement for the mapped user path.

The popup helper writes `before.png`, `after.png`, `after.aria.yml`, and `meta.json` under `build/verify-privacything/popup-protection/`.

## Cleanup

Stop only the Chromium or Firefox process this run started. Do not `pkill` by browser name. The drive helper closes its persistent context and deletes its temp user-data dir on the way out. For `pnpm task start:chrome`, interrupt that terminal (SIGINT). Remove `build/agent-profiles/<task>/` only when the task no longer needs that profile.

Keep `build/verify-privacything/`. A cleanup that removes proof has failed.

## Helpers

```sh
node .cursor/skills/verify-privacything/scripts/doctor.mjs
node .cursor/skills/verify-privacything/scripts/drive-popup.mjs
PT_VERIFY_HEADED=1 node .cursor/skills/verify-privacything/scripts/drive-popup.mjs
```

`doctor.mjs` is read-only. `drive-popup.mjs` launches an isolated Chromium, seeds sample profiles, assigns Warsaw to a local probe page through the popup, writes artifacts, then tears down its own browser and temp profile.
