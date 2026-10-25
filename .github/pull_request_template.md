## Summary

- Describe the user-facing change and why we need it.

## Validation

- [ ] `pnpm task lint`
- [ ] `pnpm task check`
- [ ] `pnpm task test:unit`
- [ ] Both targets still build (`pnpm task build:chrome`, `pnpm task build:firefox`)
- [ ] Worker bundle regenerated if `packages/refract-core` changed
      (`pnpm task generate:worker-source`)

## Screenshots

<!-- Visible UI changes only; otherwise write "Not applicable". Follow the screenshot
rules in AGENTS.md: popup and sidebar at 360 px, Options at a stated desktop width,
changed states only, dark theme, test data only, images attached to this description. -->

## Changelog

- [ ] I updated `CHANGELOG.md` in `## [Unreleased]` for user-facing changes.
- [ ] This change does not need a changelog entry (internal/test/CI/refactor only).
