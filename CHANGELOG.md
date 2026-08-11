# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and the project follows Semantic Versioning.

## [Unreleased]

### Changed

- License the public source under AGPL-3.0-or-later with section 7 terms and a
  separate commercial licensing option.

### Fixed

- Seed dynamically navigated same-origin iframes before their document starts so
  browser surfaces do not briefly expose native values while background bootstrap
  is still resolving.
