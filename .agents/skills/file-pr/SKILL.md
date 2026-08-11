---
name: file-pr
description: Create or update a ready-for-review pull request for Privacy Thing, including a task-scoped branch and commit when needed, validation, push, and gh pr create. Use when the user asks to create, open, or file a PR, or to commit changes and create a pull request. Do not use when the user only wants proposed PR copy or wants existing review comments addressed.
---

# Privacy Thing File PR

Turn the completed task into one reviewable pull request. An explicit request to create
a PR authorizes creating a branch, committing only the task's changes, pushing that
branch, and opening the PR. It does not authorize including unrelated worktree changes,
repairing additional findings, or rewriting shared Git history.

## Establish the repository context

1. Read the repository `AGENTS.md` and `.github/pull_request_template.md` before
   preparing the change.
2. Confirm the worktree root with Git and use `gh repo view` to resolve
   `nameWithOwner` and `defaultBranchRef`. Require `Privacy-Thing/browser-extension`;
   do not rely on a historical directory name.
3. Run `gh auth status`. Stop with the exact limitation if authentication or repository
   access is unavailable.
4. Resolve the push remote from the branch upstream or a remote whose GitHub repository
   matches `nameWithOwner`. If no remote or more than one plausible remote remains, stop
   rather than guessing.
5. Fetch the resolved default-branch ref. Use that remote-tracking ref as the comparison
   base; never assume `origin/main` without checking.
6. Stop for a detached HEAD, unresolved conflicts, an in-progress merge or rebase, or
   another Git state in which a normal commit would be unsafe.

Record the repository, base branch and ref, push remote, current branch, HEAD SHA, and
worktree status. Do not print credentials, tokens, or environment values.

## Protect scope and prepare the branch

Inspect all four views before staging anything:

- `git status --short --branch`;
- the staged diff;
- the unstaged diff plus untracked files;
- the complete branch diff against the fetched base.

Classify every changed path as task-owned or unrelated. Preserve unrelated files
verbatim and leave them uncommitted. If the index already mixes task-owned and unrelated
changes, or ownership cannot be determined confidently from the active task, stop and
ask the user to choose the scope. Do not silently rewrite the index.

If the current branch is the default branch:

1. Confirm its HEAD matches the fetched default-branch ref. If it is ahead, behind, or
   diverged, report that state instead of hiding it in the new PR.
2. Derive a short lowercase slug from the task and create `agent/<slug>`.
3. If that ref already exists locally or remotely, append the shortest unambiguous
   numeric suffix. Never reset or overwrite an existing branch.

Keep an existing non-default working branch. If neither the branch nor the worktree has
task-owned differences from the base, stop without creating an empty commit or PR.

## Check for an existing pull request

Query pull requests for the exact head branch before creating one. Check open and closed
states.

- For an open PR, update the same branch and reuse the PR. Do not create a duplicate.
- Refresh its title or body only when the full current diff makes the existing text
  inaccurate.
- If the matching PR is closed or merged, do not reopen it or reuse the branch
  automatically. Report its URL and ask for an explicit next step.

## Validate before publishing

Run `git diff --check` and select the smallest additional proof required by `AGENTS.md`
and the affected surfaces. Reuse commands already completed successfully in the active
task, but do not claim checks from an older task or commit. Do not run the full `verify`
suite mechanically when focused evidence is sufficient.

Before filing, also confirm that required generated artifacts and the `## [Unreleased]`
changelog entry are present when the change requires them. Stop and report a missing
requirement rather than disguising it in PR copy.

If a required check fails, do not commit, push, or create the PR. Report the command,
the decisive error, and whether the failure appears related or pre-existing. Never mark
a template checkbox for a command that did not pass.

For changes limited to repository skills and `AGENTS.md`, validate at minimum:

- `SKILL.md` has valid YAML frontmatter with `name` and `description`;
- `agents/openai.yaml` parses and points at existing icon paths;
- `.claude/skills` still resolves to `../.agents/skills`;
- `git diff --check` passes.

## Choose the commit and PR title

Inspect recent first-parent Git history and recently merged human-authored PRs. Ignore
Dependabot bodies as a prose model. Follow the repository's Conventional Commit style,
such as `feat:`, `fix:`, `test:`, `docs:`, or `chore:` with a useful scope when one adds
clarity.

Prefer one logical commit for newly completed task changes. Stage explicit task-owned
paths, inspect the staged patch, and commit only that patch. A single new commit should
use the same subject as the PR title. With multiple existing commits, derive the title
from the complete base-to-head diff rather than copying the latest commit subject.

Use a concise, human-readable title that explains the outcome or why it matters. Prefer
`chore(agents): standardize pull request filing` over `add file-pr skill`. PR titles may
become squash-merge commit messages, so do not use an implementation inventory as the
title.

## Write the pull request body

Preserve `.github/pull_request_template.md` and complete its sections truthfully.

- Open `Summary` with the user problem or project need from the original request, then
  explain the solution and result briefly.
- Do not lead with a list of files, functions, deleted symbols, or implementation
  mechanics.
- In `Validation`, check only commands that actually passed and add any relevant focused
  checks not present in the template.
- In `Changelog`, select exactly one true option.
- State known pre-existing or unrelated validation failures when they affect the
  evidence, without presenting them as fixed.

Write the body to a task-specific file created with `mktemp` and pass it with
`--body-file`. Do not interpolate Markdown into a shell command. Remove only that exact
temporary file after GitHub has accepted the body or after a safely handled failure.

## Publish and verify

1. Push with `git push -u <resolved-remote> <branch>`.
2. For a new PR, call `gh pr create` with explicit `--repo`, `--base`, `--head`,
   `--title`, and `--body-file`. Do not pass `--draft`; the default is ready for review.
3. For an existing open PR, push the commit and use `gh pr edit` only if its title or
   body is stale.
4. Read the resulting PR back with `gh pr view`. Confirm its URL, title, base, head,
   `isDraft: false`, and head SHA against the pushed branch.

Report the commit SHA, branch, PR URL, validation performed, and any intentionally
uncommitted paths. A local commit, successful push, or local test alone is not proof that
the requested PR exists in the expected state.

## Continue only when requested

Normally stop after verifying the PR. If the user explicitly asks to babysit, monitor,
or bring it to green, watch its checks. Route a concrete failing Actions run through
`ci-failure-triage`; do not depend on a nonexistent `babysit-pr` skill.
Address review comments only when the user's request also includes review follow-up.
