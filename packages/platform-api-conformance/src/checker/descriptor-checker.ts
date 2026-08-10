/**
 * Descriptor conformance checker.
 *
 * Flags API patches where property descriptor attributes differ between
 * vanilla and spoofed snapshots.
 */

import type { BrowserTarget, DetectedPatch, Finding } from "../types.js";

type PatchContext = {
  affectedTargets: string[];
  findings: Finding[];
  patch: DetectedPatch;
};

const getAffectedTargetLabels = (
  patchBrowser: "chromium" | "firefox",
  targets: BrowserTarget[],
): string[] =>
  targets
    .filter((target) =>
      patchBrowser === "chromium"
        ? target.name === "chrome" || target.name === "edge"
        : target.name === "firefox",
    )
    .map((target) => `${target.name} ${target.version}`);

const pushFinding = (
  context: PatchContext,
  finding: Omit<Finding, "affectedTargets" | "api">,
): void => {
  context.findings.push({
    ...finding,
    affectedTargets: context.affectedTargets,
    api: context.patch.api,
  });
};

const checkDescriptorShape = (context: PatchContext): void => {
  const vanilla = context.patch.vanillaDescriptor;
  const spoofed = context.patch.spoofedDescriptor;
  if (!vanilla || !spoofed) return;

  const vanillaAccessor = vanilla.get !== undefined || vanilla.set !== undefined;
  const spoofedAccessor = spoofed.get !== undefined || spoofed.set !== undefined;
  if (vanillaAccessor !== spoofedAccessor) {
    pushFinding(context, {
      category: "stealth",
      severity: "WARNING",
      message: `[descriptor-mismatch] Descriptor type changed in ${context.patch.browser}: vanilla is ${vanillaAccessor ? "accessor" : "data"}, spoofed is ${spoofedAccessor ? "accessor" : "data"}.`,
    });
  }

  for (const attr of ["writable", "enumerable", "configurable"] as const) {
    if (
      vanilla[attr] !== undefined &&
      spoofed[attr] !== undefined &&
      vanilla[attr] !== spoofed[attr]
    ) {
      pushFinding(context, {
        category: "stealth",
        severity: "WARNING",
        message: `[descriptor-mismatch] ${attr}: vanilla=${String(vanilla[attr])}, spoofed=${String(spoofed[attr])} in ${context.patch.browser}. Detectable via Object.getOwnPropertyDescriptor().`,
      });
    }
  }
};

const checkFunctionShape = (context: PatchContext): void => {
  const vanilla = context.patch.vanillaDescriptor;
  const spoofed = context.patch.spoofedDescriptor;
  if (!vanilla || !spoofed) return;

  if (
    vanilla.fnName !== undefined &&
    spoofed.fnName !== undefined &&
    vanilla.fnName !== spoofed.fnName
  ) {
    pushFinding(context, {
      category: "stealth",
      severity: "WARNING",
      message: `[fn-name] Function.name differs in ${context.patch.browser}: vanilla="${vanilla.fnName}", spoofed="${spoofed.fnName}". Detectable via Function.name comparison.`,
    });
  }
  if (
    vanilla.fnLength !== undefined &&
    spoofed.fnLength !== undefined &&
    vanilla.fnLength !== spoofed.fnLength
  ) {
    pushFinding(context, {
      category: "stealth",
      severity: "WARNING",
      message: `[fn-length] Function.length differs in ${context.patch.browser}: vanilla=${String(vanilla.fnLength)}, spoofed=${String(spoofed.fnLength)}. Detectable via Function.length comparison.`,
    });
  }
  if (
    vanilla.fnSurfaceValue !== undefined &&
    spoofed.fnSurfaceValue !== undefined &&
    vanilla.fnSurfaceValue !== spoofed.fnSurfaceValue
  ) {
    pushFinding(context, {
      category: "stealth",
      severity: "WARNING",
      message: `[fn-surface-value] Zero-argument method behavior on the owning surface differs in ${context.patch.browser}: vanilla=${vanilla.fnSurfaceValue}, spoofed=${spoofed.fnSurfaceValue}. Detectable via direct method.call(surface) / prototype-call parity checks.`,
    });
  }
};

const checkGetterShape = (context: PatchContext): void => {
  const vanilla = context.patch.vanillaDescriptor;
  const spoofed = context.patch.spoofedDescriptor;
  if (!vanilla || !spoofed) return;

  const comparisons = [
    {
      category: "compatibility" as const,
      key: "getterValue" as const,
      label: "getter-value",
      message: "Getter return value",
      suffix: "Descriptor shape preserved.",
    },
    {
      category: "stealth" as const,
      key: "getterFnName" as const,
      label: "getter-fn-name",
      message: "Getter Function.name",
      suffix: "Detectable via Object.getOwnPropertyDescriptor(...).get.name.",
    },
    {
      category: "stealth" as const,
      key: "getterFnLength" as const,
      label: "getter-fn-length",
      message: "Getter Function.length",
      suffix: "Detectable via Object.getOwnPropertyDescriptor(...).get.length.",
    },
    {
      category: "stealth" as const,
      key: "getterSurfaceValue" as const,
      label: "getter-surface-value",
      message: "Getter behavior on the owning surface",
      suffix:
        "Detectable via direct getter.call(surface) / prototype access parity checks.",
    },
  ];

  for (const comparison of comparisons) {
    const vanillaValue = vanilla[comparison.key];
    const spoofedValue = spoofed[comparison.key];
    if (
      vanillaValue === undefined ||
      spoofedValue === undefined ||
      vanillaValue === spoofedValue
    )
      continue;
    pushFinding(context, {
      category: comparison.category,
      severity: comparison.category === "compatibility" ? "INFO" : "WARNING",
      message: `[${comparison.label}] ${comparison.message} differs in ${context.patch.browser}: vanilla=${String(vanillaValue)}, spoofed=${String(spoofedValue)}. ${comparison.suffix}`,
    });
  }
};

const checkActualValue = (context: PatchContext): void => {
  const vanilla = context.patch.vanillaDescriptor;
  const spoofed = context.patch.spoofedDescriptor;
  if (
    !vanilla ||
    !spoofed ||
    vanilla.actualValue === undefined ||
    spoofed.actualValue === undefined ||
    vanilla.actualValue === spoofed.actualValue
  ) {
    return;
  }
  pushFinding(context, {
    category: "compatibility",
    severity: "INFO",
    message: `[actual-value] Property value differs in ${context.patch.browser}: vanilla=${vanilla.actualValue}, spoofed=${spoofed.actualValue}.`,
  });
};

const checkPatch = (context: PatchContext): void => {
  const { patch } = context;
  if (patch.diffType === "added") {
    pushFinding(context, {
      category: "stealth",
      severity: "CRITICAL",
      message: `Phantom property: exists in spoofed but NOT in vanilla ${patch.browser}. Detectable via Object.getOwnPropertyDescriptor().`,
    });
    return;
  }
  if (patch.diffType === "removed") {
    pushFinding(context, {
      category: "stealth",
      severity: "CRITICAL",
      message: `Own property missing from spoofed ${patch.browser}: present as own property on vanilla prototype but absent in spoofed. May still be accessible via prototype chain. Detectable via Object.getOwnPropertyDescriptor() returning undefined.`,
    });
    return;
  }
  if (patch.diffType === "changed") {
    checkDescriptorShape(context);
    checkFunctionShape(context);
    checkGetterShape(context);
    checkActualValue(context);
    return;
  }
  if (patch.diffType === "value-changed") {
    const severity = patch.valueProbeSeverity ?? "INFO";
    const note =
      severity === "INFO"
        ? "Descriptor shape preserved (anti-detection) but observable behavior changed."
        : "Configured as compatibility-sensitive output drift, so this value change is treated as a reportable bug signal.";
    pushFinding(context, {
      category: patch.valueProbeCategory ?? "compatibility",
      severity,
      message: `[value-probe] Return value differs in ${patch.browser}: vanilla=${patch.vanillaValue ?? "N/A"}, spoofed=${patch.spoofedValue ?? "N/A"}. ${note}`,
    });
    return;
  }
  if (patch.diffType === "value-policy-violation") {
    const expectation =
      patch.valueProbeDescription ??
      (patch.valueProbePattern
        ? `expected spoofed value to match /${patch.valueProbePattern}/`
        : "spoofed value violated the configured output policy");
    pushFinding(context, {
      category: patch.valueProbeCategory ?? "compatibility",
      severity: patch.valueProbeSeverity ?? "WARNING",
      message: `[value-policy] ${expectation} in ${patch.browser}: vanilla=${patch.vanillaValue ?? "N/A"}, spoofed=${patch.spoofedValue ?? "N/A"}.`,
    });
  }
};

export class DescriptorChecker {
  static check(patches: DetectedPatch[], targets: BrowserTarget[]): Finding[] {
    const findings: Finding[] = [];
    for (const patch of patches) {
      checkPatch({
        affectedTargets: getAffectedTargetLabels(patch.browser, targets),
        findings,
        patch,
      });
    }
    return findings;
  }
}
