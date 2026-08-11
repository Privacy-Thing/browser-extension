# CI failure routing

Use the first decisive failure, not downstream cancellations.

## Workflow selection or changed-file gate

Inspect the unified, fork-safe `.github/workflows/ci.yml`. Reproduce shell filters with
a minimal changed-file input. Under `bash -e`, an expected empty `grep` result may still
fail the step.

The workflow must remain GitHub-hosted and read-only. It must not use
`pull_request_target`, repository secrets other than `GITHUB_TOKEN`, environments or
self-hosted runners.

## Playwright executable or container mismatch

Compare all resolved Playwright packages with every workflow container tag:

```sh
pnpm list @playwright/test playwright playwright-core -r --depth 0
```

The image and package versions must agree. Do not debug downstream browser timeouts
until the executable contract is correct.

## Generated worker drift

If `check:worker-source` fails, inspect source changes under `packages/refract-core` and
`packages/refract-worker`. Regenerate through `pnpm task generate:worker-source`; never
edit the generated file.

## Test ownership and determinism checks

- `check:test-targets`: wrong neutral/Chromium/Firefox suffix or dependency closure.
- `check:test-lanes`: missing or duplicate E2E lane ownership.
- `check:test-layers`: translated copy, CSS or geometry asserted at the E2E layer.
- `check:test-determinism`: real delays or uncontrolled timing.

Repair the test at its correct layer. Do not raise a ratchet merely to admit the new
occurrence.

## Build contract or bundle budget

Inspect the exact artifact and budget assertion under `tests/build-contracts`. If code
entered a content, early or injected hot path, use `pnpm task analyze:bundle-sources`
before changing a threshold. Leave real size margin because build identifiers can move
the output slightly.

## API conformance

Inspect `packages/platform-api-conformance` and the generated report. Distinguish:

- source scanner or Browser Compatibility Data mapping defects;
- vanilla/spoofed snapshot capture readiness;
- missing runtime marker or preload state;
- a real descriptor/value mismatch.

Use the tool's focused tests, then the report command when a browser capture is needed:

```sh
pnpm task test:unit:tooling
pnpm exec task test:api-conformance -- --json --html --github-summary
```

## Firefox runtime E2E

Use the sibling [runtime triage skill](../../runtime-triage/SKILL.md) and
read its `references/firefox-e2e.md`. Build with `build:firefox:runtime-test`; an
ordinary Firefox artifact is not equivalent.

## Publish or scheduled metadata refresh

Inspect whether the run came from `publish.yml` directly or from
`refresh-metadata.yml`. Separate:

- an intentionally skipped refresh while the repository variable
  `METADATA_REFRESH_ENABLED` is not exactly `true`;
- a repository validation failure;
- a provider/store upload failure;
- missing environment configuration;
- a job blocked before runner start by billing, permissions or infrastructure.

If no job ran, rely on the check-run annotation. Confirm whether a release commit or tag
was already created before recommending a rerun. Do not trigger the workflow without
explicit approval.
