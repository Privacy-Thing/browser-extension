import { BcdFetcher } from "../compat/bcd-fetcher.js";
import type { DetectedPatch, BrowserTarget, Finding } from "../types.js";

export class CompatChecker {
  static check(patch: DetectedPatch, targets: BrowserTarget[]): Finding[] {
    const findings: Finding[] = [];
    const bcd = BcdFetcher.getSupport(patch.api);

    if (!bcd.key) return findings;

    for (const target of targets) {
      const support = bcd.support[target.name];
      if (!support) continue;

      const targetLabel = `${target.name} ${target.version}`;

      if (support.version_added === false) {
        findings.push({
          category: "compatibility",
          severity: "CRITICAL",
          api: patch.api,
          message: `API not supported in ${target.name} (${bcd.key}: never added). Spoofing nonexistent API = fingerprinting signal.`,
          affectedTargets: [targetLabel],
        });
      } else if (
        typeof support.version_added === "string" &&
        !support.version_added.startsWith("\u2264")
      ) {
        const addedVersion = parseFloat(support.version_added);
        if (!isNaN(addedVersion) && addedVersion > target.version) {
          findings.push({
            category: "compatibility",
            severity: "CRITICAL",
            api: patch.api,
            message: `API added in ${target.name} ${addedVersion}, but target is ${target.version} (${bcd.key}).`,
            affectedTargets: [targetLabel],
          });
        }
      }

      if (support.version_removed) {
        const removedVersion = parseFloat(support.version_removed as string);
        if (!isNaN(removedVersion) && removedVersion <= target.version) {
          findings.push({
            category: "compatibility",
            severity: "CRITICAL",
            api: patch.api,
            message: `API removed in ${target.name} ${removedVersion}, but target is ${target.version} (${bcd.key}).`,
            affectedTargets: [targetLabel],
          });
        }
      }

      // Only warn about flags if the unflagged version hasn't shipped yet for this target.
      // BCD often retains historical flag entries even after unflagged support shipped.
      if (support.flags && support.flags.length > 0) {
        const addedVersion =
          typeof support.version_added === "string"
            ? parseFloat(support.version_added)
            : NaN;
        const stillFlagGated = isNaN(addedVersion) || addedVersion > target.version;
        if (stillFlagGated) {
          findings.push({
            category: "compatibility",
            severity: "WARNING",
            api: patch.api,
            message: `API requires a feature flag in ${target.name} ${target.version} (${bcd.key}). Spoofing could be risky.`,
            affectedTargets: [targetLabel],
          });
        }
      }
    }
    return findings;
  }
}
