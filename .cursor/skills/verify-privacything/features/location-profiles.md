# Location profiles

The options Profiles tab holds location profiles. Users generate one from a place search or add one manually. The saved profile label appears in the list and in `pt:get-settings`.

## Sub-features

- `profiles-open` opens the Profiles tab.
- `profiles-manual` adds a profile from the actions menu with a typed label.
- `profiles-generate` runs the generator, confirms a candidate, and saves it.
- `profiles-persist` shows the new label after save.

## How to get to it (user POV)

- Open extension options and choose the Profiles tab.
- Open `chrome-extension://<id>/src/ui/options/index.html#page-locations`.

## Driving it with verify-privacything

Preconditions:

- Doctor passed.
- Disposable Chromium has `build/chrome` loaded and onboarding completed.
- For generator search against Nominatim, the profile has OSM consent granted, or the run stubs Nominatim. Do not hit the live geocoder from an unattended agent unless the task explicitly needs the live boundary.

- **Open Profiles.** Click `[data-tab="profiles"]`. `[data-panel="profiles"]` is visible. `#open-profile-generator` is visible.
- **Add manually.** Click `#open-profile-actions-menu`, then `#add-profile-manually`. `#profile-dialog` is visible. Fill the first input with `Manual verify location`. Click the last button in `#profile-dialog`. `pt:get-settings` locations include label `Manual verify location`.
- **Generate (optional live or stubbed).** Click `#open-profile-generator`. Fill `#profile-draft-query` with `Paris, France`. Click `#run-profile-generator`. Advance `#profile-generator-result-step` / `#profile-generator-language-step` until `#profile-generator-confirm-step` is visible. Click `#save-profile-generator`. Locations include `Paris, France`.
- **Proof.** Capture `[data-panel="profiles"]` screenshot and ARIA snapshot under `build/verify-privacything/location-profiles/`. Re-read settings after a reload.

## Gotchas

- Production defaults ship with an empty profile list. Empty `#profiles-list .bg-card` on a fresh profile is expected until sample data or a user add.
- Generator search talks to Nominatim only after OSM consent. A denied or unknown consent blocks the live path.
- The generator is multi-step. Wait for `#profile-generator-confirm-step`, not a fixed delay after clicking run.
- Manual add uses the last button in `#profile-dialog` as Save. Do not click the page background to dismiss.
