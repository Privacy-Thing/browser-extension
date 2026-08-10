---
name: privacything-ci-failure-triage
description: Inspect a concrete Privacy Thing GitHub Actions failure, isolate the first real failing job, and route it to the correct repository-specific fix family. Use when given a run URL, run ID, failing check, or request to diagnose or repair CI; do not use for an unrelated local test failure without Actions context.
---

# Privacy Thing CI Failure Triage

Start with the exact run. Do not scan workflows broadly or edit product code before the
failing job and decisive error are known.

## Inspect the run

1. Resolve the repository from the supplied URL or current checkout; never hard-code a
   historical private repository name.
2. Run `gh auth status`. If access is unavailable, report the exact limitation.
3. Inspect run metadata and jobs:

   ```sh
   gh run view <run-id> --repo <owner/repo> \
     --json name,workflowName,conclusion,status,url,event,headBranch,headSha,jobs
   ```

4. Pull logs only for failed jobs. When a job never started or has no useful log, inspect
   its check-run annotations before attributing the failure to repository code.
5. Preserve the run URL, head SHA, job name and shortest decisive error string.

Read [references/failure-routing.md](references/failure-routing.md) and classify the
failure before editing.

## Fix the smallest real cause

- Respect whether the user requested diagnosis, implementation, rerun or monitoring.
- Treat a rerun as evidence about reproducibility, not as a code fix.
- Do not weaken assertions, raise budgets or add retries until the changed behavior
  proves the existing contract is wrong.
- Keep fork-PR workflow security constraints intact.
- Never print secrets or environment values from credential-bearing jobs.
- Never trigger publish, cut a version or create a tag without explicit approval.

## Verify and close the loop

Run the narrowest local reproduction for the identified family. If a change is made,
verify the current branch/diff and the exact affected command. When the user requested
shipping or monitoring, follow the new run to completion; otherwise do not infer push or
rerun authorization.

Report the exact cause, targeted fix, verification result and any remaining gap between
local evidence and the requested CI run.
