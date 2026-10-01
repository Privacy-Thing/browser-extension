# Privacy Thing verification map

This directory is the maintained source for verifying user-facing Privacy Thing behavior. Read the index before driving the extension, then use the matching feature file as the recipe.

## Baseline preconditions

- Chromium loads this checkout's unpacked `build/chrome`, not a store build and not another clone's output.
- The browser profile is disposable (`build/agent-profiles/<task>/` or the drive helper's temp dir).
- `node .cursor/skills/verify-privacything/scripts/doctor.mjs` passes.
- Onboarding is completed in that profile only.
- Example profiles exist (Warsaw and the other presets). Seed with `pt:load-sample-data` when the list is empty.
- Never drive an instance that this run did not start.

## Driving conventions

- Start every recipe from the baseline unless its preconditions say otherwise.
- Prefer `#id` and `data-*` hooks over CSS class chains or tab order.
- Profile labels such as `Warsaw` are user data and may be asserted as text.
- Do not assert translated chrome copy.
- Restore or discard disposable profile state after a mutation. Keep proof artifacts under `build/verify-privacything/<feature-id>/`.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes an ARIA snapshot and a screenshot with Privacy Thing identity visible.
- Mutation proof includes a second view of persisted settings (`pt:get-settings` or reopen popup/options).
- Record the feature ID and entry point with every artifact.
- Report an unreachable path with the attempted command and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with verify-privacything` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Popup protection](./popup-protection.md) covers the toolbar popup assigning a profile to the current site and reading the active rule card.
- [Domain rules](./domain-rules.md) covers the options Rules tab, Default Rule, and adding an exact-host rule.
- [Location profiles](./location-profiles.md) covers generating and manually adding a location profile.
- [X-Ray](./xray.md) covers opening site activity diagnostics from the popup into the sidebar.
