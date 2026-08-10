# Security Policy

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Report privately through GitHub's
[Private Vulnerability Reporting](https://github.com/Privacy-Thing/browser-extension/security/advisories/new)
on this repository.

Please include what you can: affected version and browser, a description of the issue,
reproduction steps or a proof of concept, and the impact you believe it has.

You will get an acknowledgement of the report. Once a fix ships, the advisory is
published and, unless you prefer otherwise, you are credited.

## What counts as a vulnerability here

Privacy Thing is an anti-fingerprinting and location-spoofing extension, so its threat
model is unusual. The following are in scope:

- **Spoofing bypasses** — a page reading a real value that the active profile should have
  replaced, on any surface: geolocation, `Date`, `Intl`, locale, client hints, screen,
  hardware, WebGL, or their worker and iframe derivatives.
- **Detection leaks** — a page distinguishing a patched surface from a native one through
  descriptors, `toString` output, function name or length, prototype identity, or
  error shapes.
- **Cross-realm escapes** — recovering native behavior through an iframe, a worker, a
  `srcdoc` document, or a `blob:` URL.
- **Bootstrap races** — reading a real value before spoofing installs, especially on the
  first inline script of a page.
- **Leakage of extension state** to page scripts, or of one profile's data into another
  context.
- Anything that lets a page identify the extension as installed.

Out of scope: fingerprinting vectors the extension does not claim to cover, issues
requiring a compromised browser or a malicious extension already installed alongside it,
and reports produced solely by automated scanners without a working demonstration.

## Known limitation

Time and locale spoofing on Firefox has a race window for the earliest inline reads.
This is a known limitation, not a new finding. Reports that narrow it, or that show it
is worse than described, are welcome.

## Supported versions

Fixes land on the latest released version. There are no long-term support branches.
