# X-Ray

X-Ray shows which supported surfaces the current site has accessed and how Privacy Thing is treating them. Users open it from the popup. The sidebar lists page activity and spoofing snapshot sections.

## Sub-features

- `xray-open` opens X-Ray from the popup footer into the Chromium side panel.
- `xray-activity` shows `[data-xray-section="page-activity"]` for the active tab.
- `xray-snapshot` shows `[data-xray-section="spoofing-snapshot"]` when that section is present.
- `xray-empty-tab` does not treat a missing tab id as a successful site report.

## How to get to it (user POV)

- On a site tab, open the popup and choose X-Ray (`#open-xray`).
- Open the Privacy Thing side panel from the browser chrome after the extension is loaded.

## Driving it with verify-privacything

Preconditions:

- Doctor passed.
- Disposable Chromium has `build/chrome` loaded.
- A site tab is focused (the same probe host used for popup protection is enough).
- The popup can see that tab (`tabId` query param).

- **Open popup on the site.** Same popup-open steps as popup protection. `#open-xray` is visible in the footer.
- **Open X-Ray.** Click `#open-xray`. Chromium opens the side panel. `[data-xray-section="page-activity"]` exists.
- **Direct sidebar page (agent fallback).** If the side panel cannot be attached, go to `chrome-extension://<id>/src/ui/sidebar/index.html` with the site tab still open. Wait until `useActiveTabId` resolves. `[data-xray-section="page-activity"]` exists. If the page stays without a tab id, report the path unreachable rather than passing.
- **Proof.** Screenshot the activity section. Note the site URL. Capture ARIA snapshot of the sidebar root. Store under `build/verify-privacything/xray/`.

## Gotchas

- X-Ray is per tab. A sidebar opened against the options page is not proof for a site.
- Firefox opens X-Ray through `sidebarAction`, not Chromium `sidePanel`. Prove Firefox separately when the change is Firefox-only.
- Empty activity on a blank probe page can still be a valid armed/off snapshot. Assert the section is present and bound to the intended tab, not that a particular surface was accessed, unless the recipe visited a page that reads that surface.
- Storybook X-Ray stories are fixtures. They are not this feature's proof.
