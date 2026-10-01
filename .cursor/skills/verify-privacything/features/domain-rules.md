# Domain rules

The options Rules tab lists the Default Rule and per-site rules. Users add an exact-host pattern, pick a profile, save, and see the row in the table.

## Sub-features

- `rules-open` opens the Rules tab from options.
- `rules-default` opens Edit Default Rule and shows the fallback dialog.
- `rules-add` adds `shop.example.com` with a chosen profile through the add-rule dialog.
- `rules-persist` shows the new row after save and in `pt:get-settings`.

## How to get to it (user POV)

- Open extension options and choose the Rules tab.
- Open `chrome-extension://<id>/src/ui/options/index.html#page-rules`.
- From the popup, use the control that opens full rule settings (`#open-full-rule-settings` after the assign sheet's Advanced section).

## Driving it with verify-privacything

Preconditions:

- Doctor passed.
- Disposable Chromium has `build/chrome` loaded and onboarding completed.
- Example profiles exist so the profile picker is not empty.

- **Open Rules.** Go to `chrome-extension://<id>/src/ui/options/index.html`. Click `[data-tab="rules"]`. `[data-panel="rules"]` is visible. `#rules-preview-hostname` is visible.
- **Edit Default Rule.** Click the button named `Edit Default Rule`. `#global-fallback-rule-dialog` is visible. Close it without saving if this run is only adding a site rule.
- **Add rule.** Click `#open-rule-dialog`. `#dialog-rule-pattern` is visible. Fill `shop.example.com`. Open `#dialog-rule-profile` and choose `Warsaw`. Click the button named `Save rule`.
- **Confirm row.** A toast `Default Rule updated.` is for the fallback dialog only. For a new site rule, wait until `#rules-list tbody tr` contains a button whose `aria-label` starts with `Edit rule ` and the row text includes `shop.example.com`.
- **Confirm persistence.** `pt:get-settings` includes a rule with `pattern` `shop.example.com` and location Warsaw. Capture `build/verify-privacything/domain-rules/after.png` and an ARIA snapshot of `[data-panel="rules"]`.
- **Proof.** Reopen `#page-rules` after a reload. The `shop.example.com` row is still present.

## Gotchas

- The Default Rule is not a normal domain row. It uses `data-fallback-state` on its table row. Do not count it as a site rule.
- Saving the Default Rule toast is `Default Rule updated.` Adding a site rule is a different toast. Assert the row, not the toast string alone.
- Options autosave indicators live in `#autosave-state` and may be hidden when idle.
- Do not import settings JSON as the only user path. Import is a test helper. The mapped user path is the add-rule dialog.
