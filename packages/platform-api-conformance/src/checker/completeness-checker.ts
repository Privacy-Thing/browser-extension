import { join } from "node:path";

import { SourceScanner } from "../scanner/source-scanner.js";
import type { DetectedPatch, Finding } from "../types.js";

/**
 * Source-to-runtime ratio threshold above which a completeness warning is
 * emitted. A value of 2 means: if indexed source patch sites outnumber unique
 * runtime descriptor API changes by ≥2×, it's likely that some API surfaces are
 * missing from the config's `apiSurfaces` list.
 *
 * This is intentionally generous because:
 * - Source scanning is still heuristic-based and may include helper aliases.
 * - Runtime coverage only counts descriptor-level surfaces, not value probes.
 *
 * A tighter threshold (e.g. 1.5×) would produce noisy false positives.
 */
const GAP_THRESHOLD = 2;

export class CompletenessChecker {
  /**
   * Compares indexed source patch sites vs unique runtime descriptor API changes
   * as a safety net for config drift. Scans only src/injection/ to avoid
   * inflating the estimate with non-spoofing code.
   */
  static check(patches: DetectedPatch[], projectRoot: string): Finding[] {
    const findings: Finding[] = [];
    const sourceStats = SourceScanner.scan(join(projectRoot, "src", "injection"));
    const runtimeApiCount = new Set(
      patches
        .filter((patch) => patch.diffType !== "value-changed")
        .map((patch) => patch.api),
    ).size;

    findings.push({
      category: "coverage",
      severity: "INFO",
      api: "System",
      message: `Completeness: ~${sourceStats.totalEstimated} indexed source patch sites found, ${runtimeApiCount} unique runtime descriptor API changes detected.`,
    });

    // Heuristic notice if source has significantly more indexed sites than
    // descriptor-level runtime coverage.
    // and not directly actionable — logged as INFO rather than WARNING.
    if (
      runtimeApiCount === 0
        ? sourceStats.totalEstimated > 0
        : sourceStats.totalEstimated > runtimeApiCount * GAP_THRESHOLD
    ) {
      findings.push({
        category: "coverage",
        severity: "INFO",
        api: "System",
        message: `Completeness gap: ${sourceStats.totalEstimated} indexed source patch sites vs ${runtimeApiCount} unique runtime descriptor detections. Possible undetected patches — review apiSurfaces list.`,
      });
    }

    return findings;
  }
}
