---
name: runtime-triage
description: Diagnose Privacy Thing runtime leaks, wrong spoofed values, first-inline misses, realm parity gaps, X-Ray mismatches, and Firefox runtime Playwright failures. Use when a site or test exposes host values, runtime behavior differs by browser or realm, or the root cause of a bootstrap/runtime failure is not yet proven.
---

# Privacy Thing Runtime Triage

Use this skill to establish the failure family before changing product code. If the
cause is already validated and the task is to implement the semantic fix, use the
sibling [`runtime-semantics-change`](../runtime-semantics-change/SKILL.md)
skill.

## Start from exact evidence

1. Capture the concrete URL, test name, log line, trace, or probe output that failed.
2. Record the browser target, extension build/channel and source SHA when available.
3. Record the active rule/profile and the affected surface, realm and timing:
   - page, iframe, dedicated worker, shared worker, service worker
   - first inline read, first API call, refresh, navigation or late convergence
4. Confirm that the artifact under test was built from the current source. A local build
   is not evidence about a store build or a different CI artifact.

Read [references/leak-classification.md](references/leak-classification.md), then gather
the smallest evidence that separates resolver, bootstrap, patch semantics, realm parity
and reporting failures.

For Firefox runtime Playwright failures, also read
[references/firefox-e2e.md](references/firefox-e2e.md) before editing helpers or adding
readiness logic.

## Diagnose in order

1. Verify the resolved `RuntimeSnapshot` before inspecting injected code.
2. Verify that the expected early carrier and runtime marker reached the affected realm.
3. Compare the observed value, descriptor, constructor behavior and native masking with
   the intended semantic contract.
4. Compare the same surface across Chromium main, Chromium early, Firefox early and the
   worker runtime where applicable.
5. Check X-Ray only after proving runtime behavior. Correct spoofing with incorrect
   reporting is a reporting defect, not a spoofing leak.

Prefer repository probes and focused tests over a broad external fingerprint score.
External diagnostics may identify a symptom, but they do not identify which Privacy
Thing layer caused it.

## Preserve evidence

- Do not hide a race with sleeps, larger timeouts or retries.
- Do not weaken descriptor, parity or first-call assertions to make a failure green.
- When the request is diagnosis-only, report the proven cause and stop before editing.
- If the evidence is incomplete, state which layer remains unverified.

## Report

Return:

1. exact reproduction and affected environment;
2. first layer that diverged from the expected state;
3. evidence excluding neighboring layers;
4. smallest plausible fix surface;
5. verification performed and any gap between local, CI and released state.
