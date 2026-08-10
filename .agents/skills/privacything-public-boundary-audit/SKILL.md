---
name: privacything-public-boundary-audit
description: Audit Privacy Thing changes crossing from private development into the public source repository. Use before publishing or syncing a source snapshot, changing fork-facing workflows, preparing a public source archive, or reviewing retired product identifiers, public links, licenses, generated files, credentials, and repository metadata.
---

# Privacy Thing Public Boundary Audit

Use this skill at the private/public boundary, not as a generic security review. General
vulnerability analysis belongs to the available security-review skills.

## Establish the boundary

1. Identify the exact diff, commit range, source snapshot or archive being reviewed.
2. Inspect `git status -sb` and preserve unrelated worktree changes.
3. Run the report-only mechanical audit:

   ```sh
   node .agents/skills/privacything-public-boundary-audit/scripts/audit-public-boundary.mjs
   ```

4. Read [references/compatibility-allowlist.md](references/compatibility-allowlist.md)
   before treating a legacy identifier as a branding leak.

## Review the public contract

- Public README, package repository, issue/security links and store metadata point to
  the intended public locations.
- Repository branches and forks run through the same GitHub-hosted `ci.yml` workflow
  with read-only permissions, no privileged environment, no self-hosted runner and no
  repository secret other than `GITHUB_TOKEN`.
- Scheduled metadata refresh is default-deny and only runs when the repository variable
  `METADATA_REFRESH_ENABLED` is exactly `true`.
- Actual credentials, private keys, local environment files, internal-only notes and
  generated build artifacts are absent.
- Required legal files and third-party notices are generated and present in the source
  archive.
- Generated worker, store metadata and upstream-fed catalogs are current; generated
  files were not hand-edited.
- Public documentation names files and commands that exist in the snapshot.
- Private infrastructure references are classified as intentional integration,
  removable implementation detail or blocker; do not assume every personal/repository
  name is secret.

Use `--strict` only when the current warnings have been reviewed and the audit is
intended as a gate:

```sh
node .agents/skills/privacything-public-boundary-audit/scripts/audit-public-boundary.mjs --strict
```

## Report

Classify findings as:

1. **blocker** — credential exposure, unsafe fork workflow, missing legal source terms;
2. **public drift** — outdated URL, tool version, command or documentation path;
3. **intentional compatibility** — legacy value required by installed users or stores;
4. **needs owner decision** — infrastructure or identity reference whose public status
   cannot be inferred safely.

Do not mass-rename compatibility values, publish artifacts, trigger workflows or update
external listings without explicit authorization.
