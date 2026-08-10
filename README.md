<h1 align="center">Privacy Thing</h1>

<p align="center"><strong>See more. Share less.</strong></p>

<p align="center">
  <a href="https://privacything.com/en/">Website</a> ·
  <a href="https://privacything.com/en/docs/">Documentation</a> ·
  <a href="https://github.com/Privacy-Thing/browser-extension/releases">Releases</a> ·
  <a href="PRIVACY.md">Privacy</a>
</p>

Privacy Thing is a browser extension that shows which supported browser information a
website reads, then lets you choose selected values it receives — separately for every
website. Chromium and Firefox are both first-class targets.

> [!NOTE]
> Privacy Thing is at an early stage. Supported surfaces, browser behavior and
> documentation may change as the project matures.

## What it does

- **Shows what a site checks.** X-Ray reports access to supported browser surfaces, the
  active profile and detected problems.
- **Applies rules per website.** Assign profiles to exact domains or patterns, choose a
  fallback, add exceptions and temporarily disable protection without deleting your
  configuration.
- **Builds coherent regional profiles.** Keep geolocation, language, time zone, `Date`,
  `Intl` and `Accept-Language` aligned instead of exposing an implausible mixture.
- **Reduces selected fingerprinting surfaces.** Depending on the browser and profile,
  Privacy Thing can control or modify selected browser, screen, hardware, canvas,
  WebGL, audio, WebRTC, frame and worker information.
- **Keeps different contexts separate.** Firefox rules can additionally target
  containers, so the same domain can use different profiles in different contexts.
- **Stays local by default.** Profiles, rules and settings remain in the browser. Core
  features require no Privacy Thing account or backend, and the extension collects no
  telemetry of its own. Optional place search and map previews contact external
  services only after consent.

## Privacy works in layers

Privacy Thing controls selected information exposed through browser APIs. It does not
change your public IP address, route or encrypt traffic, or replace a VPN, proxy or Smart
DNS service. Those tools can complement one another because they operate at different
layers.

Privacy Thing does not guarantee anonymity or undetectability. Websites may still use
IP addresses, account data, sessions and signals outside the extension's control. X-Ray
reports activity only for supported surfaces; it is not a complete audit of everything a
website does. See the [supported scope](https://privacything.com/en/docs/supported-scope/)
for the current boundary.

## Install

Early-stage releases are available from your browser's extension store:

- [Chrome Web Store](https://chromewebstore.google.com/detail/privacy-thing-preview/aklkmohdkhakelpdigmbpkfepebgceji)
- [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/privacy-thing/)
- [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/privacy-thing-preview/blkikdphbeafeodaedlmomjilpjckbdd)

### From a GitHub release

1. Open [Releases](https://github.com/Privacy-Thing/browser-extension/releases).
2. Download and unpack `privacything-vX.Y.Z-chromium.zip` or
   `privacything-vX.Y.Z-firefox.zip`.
3. Chromium: open `chrome://extensions`, enable **Developer mode**, select **Load
   unpacked**, then choose the unpacked directory.
4. Firefox: open `about:debugging#/runtime/this-firefox`, select **Load Temporary
   Add-on**, then choose `manifest.json` from the unpacked directory. Temporary add-ons
   are removed when Firefox restarts.

### From source

Requires Node.js 24 and pnpm 11. Corepack activates the version pinned by the
`packageManager` field in `package.json`.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm task build
```

Load `build/chrome/` in Chromium or `build/firefox/` in Firefox. Local builds are
labelled `0.YYYY.MMDD.HHMM-local` in the extension UI, using your machine's local time.

## Development

The project uses [Task](https://taskfile.dev/) through the repository's local binary, so
no global Task installation is required.

```bash
pnpm task verify:quick   # fast local verification, including both builds
pnpm task test           # unit tests and the Chromium core E2E lane
pnpm task verify         # full local equivalent of CI
pnpm task --list-all     # every available task
```

Task names put the target before the variant: `build:chrome:watch` and
`test:e2e:runtime:firefox`, for example.

### Firefox with a persistent profile

```bash
pnpm task dev:firefox    # rebuild on change and reload the extension
pnpm task start:firefox  # launch the same profile without file watching
```

The binary is resolved in this order: `FIREFOX_EXECUTABLE_PATH`, then
`PT_FIREFOX_BINARY`, then Playwright's `firefox.executablePath()`. If none resolve, the
task explains how to install Playwright's Firefox binary.

### Generated files

Some files are generated and must not be hand-edited:

- `pnpm task generate:worker-source` rebuilds the worker runtime bundle. Run it after
  changing `packages/refract-core`, or workers keep running stale logic.
- `pnpm task generate:legal` regenerates `LICENSE.md`, `NOTICE.md`, the commercial
  licensing note and bundled license texts from `scripts/legal-templates/`.
- `pnpm generate:hardware` regenerates the hardware catalogs under `src/shared/`.

## Documentation

The public guide covers:

- [getting started](https://privacything.com/en/docs/getting-started/)
- [domain rules](https://privacything.com/en/docs/domain-rules/)
- [X-Ray diagnostics](https://privacything.com/en/docs/x-ray/)
- [maps and external services](https://privacything.com/en/docs/maps-and-external-services/)
- [supported scope and limitations](https://privacything.com/en/docs/supported-scope/)

Contributor-facing references live next to the code:

- [project structure](docs/project-structure.md)
- [code style](docs/code-style.md)
- [contributing](CONTRIBUTING.md)
- [runtime invariants and agent guidance](AGENTS.md)

## Contributing and security

**This project is not accepting contributions yet.** Issues, focused reproductions and
pull requests may still be opened, but external patches are not being merged until a
contributor agreement is in place. Read [CONTRIBUTING.md](CONTRIBUTING.md) before
spending time on a change.

Do not report spoofing bypasses, detection leaks or other security issues publicly. Use
[GitHub's private vulnerability reporting](https://github.com/Privacy-Thing/browser-extension/security/advisories/new)
and read [SECURITY.md](SECURITY.md).

## License

Privacy Thing is available under the [GNU Affero General Public License v3.0 or
later, with additional terms](LICENSE.md). A separate commercial license may be
available for uses that need different terms; see the
[commercial licensing note](licenses/privacything/COMMERCIAL_LICENSE.md). Bundled
third-party components retain their own licenses, listed in
[`licenses/privacything/THIRD_PARTY_NOTICES.md`](licenses/privacything/THIRD_PARTY_NOTICES.md).

The Privacy Thing name, logo and visual identity are covered separately by the
[branding and attribution policy](licenses/privacything/BRANDING.md).
