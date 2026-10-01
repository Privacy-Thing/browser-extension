# Popup protection

The toolbar popup shows whether the current site is using the Default Rule or a domain rule, lets the user assign a location profile to that site, and shows the active profile name on the rule card.

## Sub-features

- `popup-open` opens the popup against a real site tab and shows the rule card.
- `popup-fallback` shows `data-presentation="fallback-inactive"` when the site has no domain rule.
- `popup-assign` creates an exact-host rule with profile Warsaw and applies it.
- `popup-active` shows Warsaw on `#current-profile` and `data-presentation="rule-active"` after apply.

## How to get to it (user POV)

- Click the Privacy Thing toolbar icon on a site tab.
- Open `chrome-extension://<id>/src/ui/popup/index.html?tabId=<n>` in an isolated Chromium that already has that tab.

## Driving it with verify-privacything

Preconditions:

- Doctor passed against this checkout's `build/chrome`.
- A disposable Chromium context has loaded the unpacked extension.
- Example profiles include Warsaw.
- A site tab is open on an http(s) host (the drive helper serves `http://127.0.0.1:<port>/`).
- Onboarding is completed in this profile.

- **Open popup.** Open the popup for the site tab. Run `node .cursor/skills/verify-privacything/scripts/drive-popup.mjs` for the scripted path, or go to `chrome-extension://<id>/src/ui/popup/index.html?tabId=<n>`. `#toggle-current-rule` is visible and `#current-rule` has a `data-presentation` attribute.
- **Read fallback.** With no domain rule for the host, `#current-rule` has `data-presentation="fallback-inactive"` and `#toggle-current-rule` is disabled. `#current-profile` is absent. Capture `build/verify-privacything/popup-protection/before.png`.
- **Open assign sheet.** Click `#open-domain-rule-settings`. A `dialog` appears. `#current-rule-mode` and `#current-profile-select` are visible.
- **Choose exact host and Warsaw.** Open `#current-rule-mode` and choose option `Exact host`. Open `#current-profile-select` and choose option `Warsaw`. Click `#apply-current-profile`.
- **Confirm active rule.** The dialog closes. `#current-profile` contains `Warsaw`. `#current-rule` has `data-presentation="rule-active"`. Capture `build/verify-privacything/popup-protection/after.png` and `after.aria.yml`.
- **Confirm persistence.** From the options page or `pt:get-settings`, a rule exists whose pattern is the probe hostname and whose location is Warsaw (`spf-warsaw`). The drive helper records this in `build/verify-privacything/popup-protection/meta.json`.
- **Proof.** `meta.json` names the feature `popup-protection`, the extension id, `version_name`, and the probe URL. Screenshots show the Privacy Thing logo (`img` named `Privacy Thing`).

## Gotchas

- Opening the popup without `tabId` binds it to the popup tab itself, not the site. Always pass the site tab id.
- `#toggle-current-rule` stays disabled on fallback. That is not a broken power button.
- Example profiles are empty in production defaults. Seed `pt:load-sample-data` in disposable profiles before looking for Warsaw.
- Rebuilds do not hot-swap a running Chrome. Reload the extension, then the tab, then reopen the popup.
- Product-lane test `loads the popup and shows domain controls` in `tests/e2e/extension-popup.spec.ts` covers the same path. Use it as a regression gate, still capture the mapped artifacts when this feature is the proof.
