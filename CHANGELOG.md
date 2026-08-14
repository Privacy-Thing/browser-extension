# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and the project follows Semantic Versioning.

## [Unreleased]

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

- Seed dynamically navigated same-origin iframes before their document starts so
  browser surfaces do not briefly expose native values while background bootstrap
  is still resolving.
