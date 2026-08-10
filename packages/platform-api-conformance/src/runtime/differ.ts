/**
 * Deep-diffs vanilla vs spoofed runtime snapshots.
 *
 * Produces a DetectedPatch[] that represents every API surface change
 * introduced by the extension.
 */

import type {
  RuntimeSnapshot,
  DescriptorInfo,
  DetectedPatch,
  ProbeResults,
  ValueProbe,
} from "../types.js";

function createProbeRegex(probe: ValueProbe): RegExp | null {
  if (probe.expectedPattern == null) {
    return null;
  }

  return new RegExp(probe.expectedPattern, probe.expectedPatternFlags);
}

function getExpectationValue(rawValue: string, path?: string): string | null {
  if (path == null) {
    return rawValue;
  }

  let current: unknown;
  try {
    current = JSON.parse(rawValue);
  } catch {
    return null;
  }

  for (const segment of path.split(".")) {
    if (current == null || typeof current !== "object" || !(segment in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  if (typeof current === "string") {
    return current;
  }
  if (typeof current === "number" || typeof current === "boolean" || current == null) {
    return String(current);
  }

  return JSON.stringify(current);
}

function getProbeCategory(probe?: ValueProbe): "stealth" | "compatibility" {
  if (probe?.category) {
    return probe.category;
  }

  return probe?.kind === "function-lies" ? "stealth" : "compatibility";
}

function getProbeSeverity(
  probe?: ValueProbe,
): "CRITICAL" | "WARNING" | "INFO" | undefined {
  if (probe?.severityOnChange) {
    return probe.severityOnChange;
  }

  return getProbeCategory(probe) === "stealth" ? "WARNING" : undefined;
}

// ---------------------------------------------------------------------------
// Descriptor comparison
// ---------------------------------------------------------------------------

/**
 * Compares two descriptors for equality, including enhanced v2.1 fields.
 *
 * Beyond traditional descriptor attributes (value type, get/set, writable/
 * enumerable/configurable), also compares observable behavioral fields:
 * getterValue, getterFnName, getterFnLength, getterSurfaceValue, fnName,
 * fnLength, fnSurfaceValue, actualValue. These detect Privacy Thing patches
 * that preserve descriptor shape (anti-detection) but change behavior.
 */
function descriptorsEqual(a: DescriptorInfo, b: DescriptorInfo): boolean {
  return (
    a.value === b.value &&
    a.get === b.get &&
    a.set === b.set &&
    a.writable === b.writable &&
    a.enumerable === b.enumerable &&
    a.configurable === b.configurable &&
    // Enhanced v2.1 — behavioral difference detection
    a.getterValue === b.getterValue &&
    a.getterFnName === b.getterFnName &&
    a.getterFnLength === b.getterFnLength &&
    a.getterSurfaceValue === b.getterSurfaceValue &&
    a.fnName === b.fnName &&
    a.fnLength === b.fnLength &&
    a.fnSurfaceValue === b.fnSurfaceValue &&
    a.actualValue === b.actualValue
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Diffs a vanilla snapshot against a spoofed snapshot for one browser.
 *
 * Returns one DetectedPatch per differing property, tagged with `browser`.
 *
 * Diff categories:
 * - `added`   — property exists in spoofed but NOT in vanilla (phantom property)
 * - `removed` — property exists in vanilla but NOT in spoofed (stripped native)
 * - `changed` — property exists in both but descriptors differ (conformance / spoofing)
 */
export function diffSnapshots(
  vanilla: RuntimeSnapshot,
  spoofed: RuntimeSnapshot,
  browser: "chromium" | "firefox",
): DetectedPatch[] {
  const patches: DetectedPatch[] = [];

  for (const surface of Object.keys(vanilla)) {
    const vanillaDescs = vanilla[surface];
    const spoofedDescs = spoofed[surface];

    // If the surface doesn't exist in either snapshot, skip.
    if (vanillaDescs == null && spoofedDescs == null) continue;

    // If vanilla has the surface but spoofed doesn't — every property was removed.
    if (vanillaDescs != null && spoofedDescs == null) {
      for (const [key, desc] of Object.entries(vanillaDescs)) {
        patches.push({
          api: `${surface}.${key}`,
          browser,
          diffType: "removed",
          vanillaDescriptor: desc as DescriptorInfo,
        });
      }
      continue;
    }

    // If spoofed has the surface but vanilla doesn't — entire surface was added.
    if (vanillaDescs == null && spoofedDescs != null) {
      for (const [key, desc] of Object.entries(spoofedDescs)) {
        patches.push({
          api: `${surface}.${key}`,
          browser,
          diffType: "added",
          spoofedDescriptor: desc as DescriptorInfo,
        });
      }
      continue;
    }

    // Both exist — compare property-by-property.
    const allKeys = new Set([
      ...Object.keys(vanillaDescs!),
      ...Object.keys(spoofedDescs!),
    ]);

    for (const key of allKeys) {
      const api = `${surface}.${key}`;
      const vDesc = vanillaDescs![key] as DescriptorInfo | undefined;
      const sDesc = spoofedDescs![key] as DescriptorInfo | undefined;

      if (vDesc && !sDesc) {
        patches.push({
          api,
          browser,
          diffType: "removed",
          vanillaDescriptor: vDesc,
        });
      } else if (!vDesc && sDesc) {
        patches.push({
          api,
          browser,
          diffType: "added",
          spoofedDescriptor: sDesc,
        });
      } else if (vDesc && sDesc && !descriptorsEqual(vDesc, sDesc)) {
        patches.push({
          api,
          browser,
          diffType: "changed",
          vanillaDescriptor: vDesc,
          spoofedDescriptor: sDesc,
        });
      }
    }
  }

  return patches;
}

// ---------------------------------------------------------------------------
// Value Probe diffing
// ---------------------------------------------------------------------------

/**
 * Diffs value probe results between vanilla and spoofed environments.
 *
 * Value probes evaluate JS expressions (e.g. `new Date().getTimezoneOffset()`)
 * that detect function-based spoofing invisible to descriptor analysis.
 * Returns one DetectedPatch per probe where the return value differs.
 */
export function diffValueProbes(
  vanillaProbes: ProbeResults,
  spoofedProbes: ProbeResults,
  browser: "chromium" | "firefox",
  valueProbes: ValueProbe[] = [],
): DetectedPatch[] {
  const patches: DetectedPatch[] = [];
  const probeByApi = new Map(valueProbes.map((probe) => [probe.api, probe]));

  for (const api of Object.keys(vanillaProbes)) {
    const vanilla = vanillaProbes[api];
    const spoofed = spoofedProbes[api];
    const probe = probeByApi.get(api);

    if (spoofed !== undefined) {
      const expectedPattern = createProbeRegex(probe ?? { expression: "", api });
      const expectationValue = getExpectationValue(spoofed, probe?.expectedPatternPath);
      if (
        expectedPattern &&
        (expectationValue == null || !expectedPattern.test(expectationValue))
      ) {
        const severity = getProbeSeverity(probe) ?? "WARNING";
        patches.push({
          api,
          browser,
          diffType: "value-policy-violation",
          spoofedValue: spoofed,
          valueProbeCategory: getProbeCategory(probe),
          valueProbeSeverity: severity,
          ...(vanilla !== undefined ? { vanillaValue: vanilla } : {}),
          ...(probe?.expectedPattern
            ? { valueProbePattern: probe.expectedPattern }
            : {}),
          ...(probe?.expectedDescription
            ? { valueProbeDescription: probe.expectedDescription }
            : {}),
        });
        continue;
      }
    }

    if (vanilla !== undefined && spoofed !== undefined && vanilla !== spoofed) {
      const severity = getProbeSeverity(probe);
      patches.push({
        api,
        browser,
        diffType: "value-changed",
        vanillaValue: vanilla,
        spoofedValue: spoofed,
        valueProbeCategory: getProbeCategory(probe),
        ...(severity ? { valueProbeSeverity: severity } : {}),
      });
    }
  }

  return patches;
}
