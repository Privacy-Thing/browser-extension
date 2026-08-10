---
name: privacything-browser-test-session
description: Run an isolated, reusable browser session for iterative Privacy Thing extension verification. Use when manually exercising extension UI or runtime behavior across edits, reproducing a site-specific issue, keeping a browser/profile alive between checks, or choosing the lightest valid Storybook, Chromium, Firefox, or focused Playwright path. Do not use for a single automated test command that needs no interactive session.
---

# Privacy Thing Browser Test Session

Use this skill for iterative browser work. Automated E2E fixtures must remain fresh and
deterministic; a reusable manual profile is a development aid, not test state.

Before launching anything, read
[references/launch-routing.md](references/launch-routing.md).

## Establish session identity

Record one stable tuple for the task:

- target: Storybook, Chromium extension or Firefox extension;
- build mode: watched development build or already-built artifact;
- profile path and the process or terminal session that owns it;
- extension page or site tab under test;
- source SHA and relevant uncommitted diff.

Use a task-specific profile under `build/agent-profiles/<task>/`. Never attach a
development launcher to the user's normal browser profile. Reuse a healthy owned session
instead of opening a new browser after every edit.

## Choose the lightest valid surface

1. Use Storybook for visual states, component interaction, accessibility and geometry
   that do not require extension APIs.
2. Use a focused unit or browser test when the behavior is already expressible as a
   deterministic assertion and no manual observation is needed.
3. Use Chromium as the representative interactive target for target-neutral product
   work.
4. Use Firefox first when the issue involves preload timing, containers, permissions,
   `userScripts`, Firefox shims or Firefox-only APIs.
5. Exercise both browsers only for browser parity, shared runtime semantics or a
   browser-sensitive release gate.

Do not turn a manual session into a broad smoke tour. Pin the smallest page, tab and
observable behavior that can prove or disprove the claim.

## Launch or reuse

Before starting a process, check whether the owned session still has:

- a live browser context;
- the intended profile and target build;
- the expected extension service worker or Firefox add-on;
- the relevant tab in a recoverable state.

If all four hold, reuse it. Otherwise restart only that owned session. Use the repository
launchers so the build target, extension loading and persistent profile behavior stay
consistent with contributor workflows.

For a watched Chromium build, reload the extension in `chrome://extensions` after a
rebuild, then reload the target page. Do not mistake a rebuilt directory for code already
loaded by the browser. For Firefox, confirm the add-on reload before evaluating the page.

## Interact from observable state

- Wait for a URL, role, label, `data-*` state hook, service worker, extension message or
  runtime marker. Never wait because an arbitrary amount of time seems sufficient.
- Prefer semantic locators and stable product-state hooks over coordinates or translated
  copy.
- Keep the same representative tab across edits when prior page state is part of the
  reproduction; open a fresh tab when first-navigation or first-inline behavior is the
  claim.
- Capture the smallest useful evidence: observed value, state hook, console error, trace,
  screenshot or exact test assertion.
- A healthy manual check does not replace a focused automated regression test when code
  semantics changed.

## Clean up ownership, not the machine

Stop the exact terminal or execution session created for the task. Do not use broad
`pkill`, kill unrelated browsers, remove shared profiles or clear user browser data. Keep
an owned session alive while useful for the active iteration; clean its task-specific
profile only when the task no longer needs its state and removal is safe.

## Report

State the target, profile, build identity, page or test exercised, observable readiness,
result and any browser not checked. Distinguish manual evidence, automated test evidence
and assumptions about released/store builds.
