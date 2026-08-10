// ---- Runtime Snapshot Types ----

/** Serialized property descriptor captured via Object.getOwnPropertyDescriptors() */
export interface DescriptorInfo {
  value?: string; // serialized type/value indicator (e.g. "function", "string", "undefined")
  get?: string; // "[Function]" when getter present, absent otherwise
  set?: string; // "[Function]" when setter present, absent otherwise
  writable?: boolean;
  enumerable?: boolean;
  configurable?: boolean;

  // Enhanced value capture (v2.1) ------------------------------------------------
  // These fields provide deeper comparison than typeof/shape alone.
  // Privacy Thing preserves descriptor shapes (anti-detection), so typeof comparison
  // misses most patches. These fields capture observable behavioral differences.

  /** For getter properties: serialized return value from calling the getter
   *  with the appropriate instance (e.g. navigator for Navigator.prototype).
   *  JSON.stringify for objects/arrays, String() for primitives. */
  getterValue?: string;
  /** For getter properties: Function.name of the getter function itself. */
  getterFnName?: string;
  /** For getter properties: Function.length of the getter function itself. */
  getterFnLength?: number;
  /** For getter properties: serialized result (or error marker) from calling the
   *  getter with the owning surface object as `this` (e.g. DateTimeFormat.prototype).
   *  This catches illegal-receiver parity regressions that normal getterValue
   *  checks miss because they only exercise a valid instance receiver. */
  getterSurfaceValue?: string;
  /** For function data properties: Function.name */
  fnName?: string;
  /** For function data properties: Function.length */
  fnLength?: number;
  /** For zero-argument function data properties: serialized result (or error
   *  marker) from calling the method with the owning surface object as `this`.
   *  This catches illegal-receiver / prototype-call parity regressions for
   *  ordinary methods without needing a bespoke value probe per API. */
  fnSurfaceValue?: string;
  /** For non-function data properties: serialized actual value */
  actualValue?: string;
}

/**
 * Full snapshot: mapping of API surface names to their property descriptors.
 * null means the object doesn't exist in the given browser (e.g. SharedWorker in Firefox).
 */
export type RuntimeSnapshot = Record<string, Record<string, DescriptorInfo> | null>;

// ---- Value Probes ----

/**
 * A value probe evaluates an expression in the page context and captures the
 * result. Probes detect function-based spoofing that descriptor comparison
 * cannot see (e.g. `new Date().getTimezoneOffset()` or
 * `Intl.DateTimeFormat().resolvedOptions().timeZone`).
 */
export interface ValueProbe {
  /** Probe mode. Defaults to "value" (evaluate expression and serialize result). */
  kind?: "value" | "function-lies";
  /** JS expression to evaluate in page/worker context (may return a Promise) */
  expression: string;
  /** API label this probe relates to (e.g. "Date.prototype.getTimezoneOffset") */
  api: string;
  /** High-level class of issue this probe is meant to surface. */
  category?: Exclude<FindingCategory, "coverage">;
  /** Optional severity to use when vanilla vs spoofed values differ. Defaults to INFO. */
  severityOnChange?: FindingSeverity;
  /** Optional regex source that the spoofed serialized result must satisfy. */
  expectedPattern?: string;
  /** Regex flags for expectedPattern. */
  expectedPatternFlags?: string;
  /** Optional dot-path into a JSON-serializable probe result for pattern checks. */
  expectedPatternPath?: string;
  /** Human-readable description of the expected output policy. */
  expectedDescription?: string;
  /** Execution context for the probe. Defaults to page/global scope. */
  context?: "page" | "worker" | "shared-worker";
  /** Optional browser scope for browser-specific surfaces. */
  targets?: Array<"chromium" | "firefox">;
  /** Optional receiver expression used by function-lies probes for extracted call/apply checks. */
  receiverExpression?: string;
  /** Optional expression that evaluates to an array of args for function-lies call/apply checks. */
  callArgsExpression?: string;
}

/** Serialized probe results: api label → stringified return value */
export type ProbeResults = Record<string, string>;

// ---- Diff / Detected Patch Types ----

export type DiffType =
  "changed" | "added" | "removed" | "value-changed" | "value-policy-violation";

/** A single detected difference between vanilla and spoofed runtime */
export interface DetectedPatch {
  /** Full API path, e.g. "Date.prototype.getTimezoneOffset" */
  api: string;
  /** Browser where this diff was detected */
  browser: "chromium" | "firefox";
  /** Type of difference */
  diffType: DiffType;
  /** Descriptor on vanilla (unpatched) page. Undefined when diffType is "added" or "value-changed". */
  vanillaDescriptor?: DescriptorInfo;
  /** Descriptor on spoofed (extension-loaded) page. Undefined when diffType is "removed" or "value-changed". */
  spoofedDescriptor?: DescriptorInfo;
  /** For value-probe diffs: the vanilla return value (serialized) */
  vanillaValue?: string;
  /** For value-probe diffs: the spoofed return value (serialized) */
  spoofedValue?: string;
  /** Optional configured severity for value-probe output drift. */
  valueProbeSeverity?: FindingSeverity;
  /** Optional configured category for value-probe findings. */
  valueProbeCategory?: Exclude<FindingCategory, "coverage">;
  /** Optional regex source describing the expected spoofed output shape. */
  valueProbePattern?: string;
  /** Optional human-readable expectation text for policy violations. */
  valueProbeDescription?: string;
}

// ---- Target / Config Types ----

export interface BrowserTarget {
  name: "chrome" | "firefox" | "safari" | "edge";
  version: number;
}

export type FindingSeverity = "CRITICAL" | "WARNING" | "INFO";
export type FindingCategory = "stealth" | "compatibility" | "coverage";

export interface Finding {
  severity: FindingSeverity;
  category: FindingCategory;
  api: string;
  message: string;
  location?: string;
  /** Browser targets this finding applies to. Undefined = all targets / not target-specific. */
  affectedTargets?: string[];
}

export interface ConformanceReport {
  timestamp: string;
  targets: BrowserTarget[];
  scannedApis: string[];
  findings: Finding[];
}

/**
 * Suppresses a known false-positive finding for an API pattern.
 * Suppressed findings are excluded from the report entirely.
 */
export interface Suppression {
  /** Exact API path or regex pattern (string is treated as exact match) */
  api: string | RegExp;
  /** Optional browser scope. Target-scoped suppressions never hide global findings. */
  targets?: BrowserTarget["name"][];
  /** Human-readable reason why this is suppressed */
  reason: string;
}

export interface Config {
  /** API surfaces to snapshot via Object.getOwnPropertyDescriptors() */
  apiSurfaces: string[];
  /**
   * Value probes: expressions evaluated in page context to detect behavioral
   * spoofing that preserves descriptor shapes. Each probe runs in both vanilla
   * and spoofed environments; value differences indicate active patches.
   */
  valueProbes?: ValueProbe[];
  /**
   * Suppress known false-positive findings. Matched findings are excluded
   * from the report entirely. Useful for APIs guarded by feature detection
   * at runtime (e.g. NavigatorUAData on Firefox).
   */
  suppressions?: Suppression[];
  defaultTargetPreset: string;
  targetPresets: Record<string, BrowserTarget[]>;
  cacheDir: string;
  outputDir: string;
}
