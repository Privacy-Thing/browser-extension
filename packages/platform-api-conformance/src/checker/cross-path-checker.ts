import type { DetectedPatch, Finding } from "../types.js";

/**
 * Expected coverage matrix: which API categories should be patched in which browsers.
 * Based on CLAUDE.md "Duplicated Injection Paths" table.
 *
 * Dedicated Worker wrapping is Chromium-only: worker-bootstrap.ts is only imported by
 * the Chromium injection pipeline (main/index.ts, main/early-runtime.ts).
 * SharedWorker is intentionally left native for cross-tab compatibility, and
 * Firefox's geo-shim.ts has no dedicated Worker code — these are intentional
 * architectural boundaries, not coverage gaps.
 *
 * Locale: Navigator.prototype.language AND Navigator.prototype.languages
 * plus Intl.DateTimeFormat are expected in both browsers (Firefox patches
 * DateTimeFormat via SpoofedDateTimeFormat in geo-shim.ts). Other Intl
 * constructors (NumberFormat, Collator, etc.) are patched only in Chromium
 * via patchIntlConstructor() in date-intl-patch.ts.
 *
 * NavigatorUAData: Client Hints are Chromium-only — Firefox has no UA client
 * hints API surface.
 */
const COVERAGE_MATRIX: {
  pattern: RegExp;
  expectedBrowsers: string[];
  label: string;
}[] = [
  {
    pattern: /^Geolocation(\.prototype)?\./,
    expectedBrowsers: ["chromium", "firefox"],
    label: "Geolocation",
  },
  {
    pattern: /^Date(\.|$)|^Intl\.DateTimeFormat(\.|\b)/,
    expectedBrowsers: ["chromium", "firefox"],
    label: "Date/Intl",
  },
  {
    pattern: /^Navigator\.prototype\.languages?\b/,
    expectedBrowsers: ["chromium", "firefox"],
    label: "Locale (navigator.language/languages)",
  },
  {
    pattern:
      /^Intl\.(NumberFormat|Collator|RelativeTimeFormat|ListFormat|DisplayNames|PluralRules|Segmenter)(\.|\b)/,
    expectedBrowsers: ["chromium"],
    label: "Intl constructors (non-DTF)",
  },
  {
    pattern: /^(?:NavigatorUAData\.|.*\.userAgentData(?:\.|$)|.*\.brands(?:\.|$))/,
    expectedBrowsers: ["chromium"],
    label: "Client Hints",
  },
  {
    pattern: /^Permissions\.prototype/,
    expectedBrowsers: ["chromium", "firefox"],
    label: "Permissions",
  },
  {
    pattern: /^Worker(\.|$)/,
    expectedBrowsers: ["chromium"],
    label: "Worker wrapping",
  },
];

export interface CrossPathCheckerOptions {
  /** Whether the Firefox runtime snapshot was successfully captured */
  firefoxSnapshotAvailable: boolean;
}

export class CrossPathChecker {
  /**
   * Compares Chromium runtime diff vs Firefox runtime diff.
   * Flags APIs that are patched in one browser but missing in the other where expected.
   *
   * When `firefoxSnapshotAvailable` is false, cross-path findings where Firefox
   * is the "missing" side are downgraded from WARNING to INFO (the gap is
   * expected — we simply have no Firefox data to compare against).
   */
  static check(patches: DetectedPatch[], options: CrossPathCheckerOptions): Finding[] {
    const { firefoxSnapshotAvailable } = options;
    const findings: Finding[] = [];

    // Group APIs by browser
    const chromiumApis = new Set<string>();
    const firefoxApis = new Set<string>();

    for (const patch of patches) {
      if (
        patch.diffType === "value-changed" ||
        patch.diffType === "value-policy-violation"
      ) {
        continue;
      }
      if (patch.browser === "chromium") chromiumApis.add(patch.api);
      if (patch.browser === "firefox") firefoxApis.add(patch.api);
    }

    // All unique APIs across both browsers
    const allApis = new Set([...chromiumApis, ...firefoxApis]);

    for (const api of allApis) {
      const inChromium = chromiumApis.has(api);
      const inFirefox = firefoxApis.has(api);

      if (inChromium && inFirefox) continue; // Present in both — no gap

      // Check against coverage matrix
      let matchedMatrix = false;
      for (const rule of COVERAGE_MATRIX) {
        if (rule.pattern.test(api)) {
          matchedMatrix = true;

          const presentIn = inChromium ? "chromium" : "firefox";
          const missingIn = inChromium ? "firefox" : "chromium";

          // Only flag if the missing browser is expected to have it
          if (rule.expectedBrowsers.includes(missingIn)) {
            // Downgrade to INFO when the missing browser's snapshot was not captured
            const downgraded = missingIn === "firefox" && !firefoxSnapshotAvailable;
            const suffix = downgraded ? " (firefox snapshot unavailable)" : "";
            findings.push({
              category: "stealth",
              severity: downgraded ? "INFO" : "WARNING",
              api,
              message: `[cross-path] ${rule.label} surface expected patched in [${rule.expectedBrowsers.join(", ")}]; diff detected in ${presentIn} but no corresponding change in ${missingIn}.${suffix}`,
            });
          }
          break;
        }
      }

      // Fallback: generic parity check for APIs not in the coverage matrix.
      // Covers both directions (Chromium-only and Firefox-only diffs).
      if (!matchedMatrix) {
        if (inChromium && !inFirefox) {
          findings.push({
            category: "stealth",
            severity: "INFO",
            api,
            message: `[cross-path] Diff detected in Chromium, no corresponding change in Firefox (not in coverage matrix — may be expected).`,
          });
        } else if (inFirefox && !inChromium) {
          findings.push({
            category: "stealth",
            severity: "INFO",
            api,
            message: `[cross-path] Diff detected in Firefox, no corresponding change in Chromium (not in coverage matrix — may be expected).`,
          });
        }
      }
    }

    return findings;
  }
}
