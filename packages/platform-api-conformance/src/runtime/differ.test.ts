import { describe, it, expect } from "vitest";

import type {
  DescriptorInfo,
  ProbeResults,
  RuntimeSnapshot,
  ValueProbe,
} from "../types.js";

import { diffSnapshots, diffValueProbes } from "./differ.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dataDescriptor(value: string, writable = true): DescriptorInfo {
  return { value, writable, enumerable: true, configurable: true };
}

function accessorDescriptor(): DescriptorInfo {
  return { get: "[Function]", set: "[Function]", enumerable: true, configurable: true };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("diffSnapshots", () => {
  it("returns empty array for empty snapshots", () => {
    const result = diffSnapshots({}, {}, "chromium");
    expect(result).toEqual([]);
  });

  it("returns empty array for identical snapshots", () => {
    const snapshot: RuntimeSnapshot = {
      "Date.prototype": {
        getTimezoneOffset: dataDescriptor("function"),
        toString: dataDescriptor("function"),
      },
    };
    const result = diffSnapshots(snapshot, snapshot, "chromium");
    expect(result).toEqual([]);
  });

  it("detects added properties (phantom)", () => {
    const vanilla: RuntimeSnapshot = {
      "Navigator.prototype": {
        language: dataDescriptor("string"),
      },
    };
    const spoofed: RuntimeSnapshot = {
      "Navigator.prototype": {
        language: dataDescriptor("string"),
        __pt: dataDescriptor("boolean"),
      },
    };

    const result = diffSnapshots(vanilla, spoofed, "chromium");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      api: "Navigator.prototype.__pt",
      browser: "chromium",
      diffType: "added",
    });
    expect(result[0]!.spoofedDescriptor).toBeDefined();
    expect(result[0]!.vanillaDescriptor).toBeUndefined();
  });

  it("detects removed properties (stripped native)", () => {
    const vanilla: RuntimeSnapshot = {
      "Navigator.prototype": {
        language: dataDescriptor("string"),
        languages: dataDescriptor("object"),
      },
    };
    const spoofed: RuntimeSnapshot = {
      "Navigator.prototype": {
        language: dataDescriptor("string"),
      },
    };

    const result = diffSnapshots(vanilla, spoofed, "firefox");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      api: "Navigator.prototype.languages",
      browser: "firefox",
      diffType: "removed",
    });
    expect(result[0]!.vanillaDescriptor).toBeDefined();
    expect(result[0]!.spoofedDescriptor).toBeUndefined();
  });

  it("detects changed descriptors", () => {
    const vanilla: RuntimeSnapshot = {
      "Date.prototype": {
        getTimezoneOffset: dataDescriptor("function"),
      },
    };
    const spoofed: RuntimeSnapshot = {
      "Date.prototype": {
        getTimezoneOffset: accessorDescriptor(),
      },
    };

    const result = diffSnapshots(vanilla, spoofed, "chromium");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      api: "Date.prototype.getTimezoneOffset",
      browser: "chromium",
      diffType: "changed",
    });
    expect(result[0]!.vanillaDescriptor).toEqual(dataDescriptor("function"));
    expect(result[0]!.spoofedDescriptor).toEqual(accessorDescriptor());
  });

  it("handles null surface in vanilla only (entire surface added)", () => {
    const vanilla: RuntimeSnapshot = {
      SharedWorker: null,
    };
    const spoofed: RuntimeSnapshot = {
      SharedWorker: {
        port: dataDescriptor("object"),
      },
    };

    const result = diffSnapshots(vanilla, spoofed, "chromium");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      api: "SharedWorker.port",
      diffType: "added",
    });
  });

  it("handles null surface in spoofed only (entire surface removed)", () => {
    const vanilla: RuntimeSnapshot = {
      SharedWorker: {
        port: dataDescriptor("object"),
        onerror: dataDescriptor("function"),
      },
    };
    const spoofed: RuntimeSnapshot = {
      SharedWorker: null,
    };

    const result = diffSnapshots(vanilla, spoofed, "chromium");
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.diffType === "removed")).toBe(true);
  });

  it("handles both surfaces being null (no diff)", () => {
    const vanilla: RuntimeSnapshot = { SharedWorker: null };
    const spoofed: RuntimeSnapshot = { SharedWorker: null };

    const result = diffSnapshots(vanilla, spoofed, "firefox");
    expect(result).toEqual([]);
  });

  it("diffs across multiple surfaces", () => {
    const vanilla: RuntimeSnapshot = {
      "Date.prototype": {
        getTimezoneOffset: dataDescriptor("function"),
      },
      "Navigator.prototype": {
        language: dataDescriptor("string"),
      },
    };
    const spoofed: RuntimeSnapshot = {
      "Date.prototype": {
        getTimezoneOffset: accessorDescriptor(),
      },
      "Navigator.prototype": {
        language: { ...dataDescriptor("string"), writable: false },
      },
    };

    const result = diffSnapshots(vanilla, spoofed, "chromium");
    expect(result).toHaveLength(2);

    const dateChange = result.find((p) => p.api === "Date.prototype.getTimezoneOffset");
    const navChange = result.find((p) => p.api === "Navigator.prototype.language");
    expect(dateChange).toBeDefined();
    expect(navChange).toBeDefined();
    expect(dateChange!.diffType).toBe("changed");
    expect(navChange!.diffType).toBe("changed");
  });

  it("tags patches with the correct browser", () => {
    const vanilla: RuntimeSnapshot = {
      "Date.prototype": { toString: dataDescriptor("function") },
    };
    const spoofed: RuntimeSnapshot = {
      "Date.prototype": { toString: accessorDescriptor() },
    };

    const chromium = diffSnapshots(vanilla, spoofed, "chromium");
    const ff = diffSnapshots(vanilla, spoofed, "firefox");

    expect(chromium[0]!.browser).toBe("chromium");
    expect(ff[0]!.browser).toBe("firefox");
  });

  // Enhanced v2.1 — behavioral difference detection via new descriptor fields

  it("detects getterValue differences (spoofed getter return value)", () => {
    const vanilla: RuntimeSnapshot = {
      "Navigator.prototype": {
        language: {
          get: "[Function]",
          enumerable: true,
          configurable: true,
          getterValue: '"en-US"',
        },
      },
    };
    const spoofed: RuntimeSnapshot = {
      "Navigator.prototype": {
        language: {
          get: "[Function]",
          enumerable: true,
          configurable: true,
          getterValue: '"en-GB"',
        },
      },
    };

    const result = diffSnapshots(vanilla, spoofed, "chromium");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      api: "Navigator.prototype.language",
      diffType: "changed",
    });
  });

  it("detects getterFnName differences (accessor getter identity drift)", () => {
    const vanilla: RuntimeSnapshot = {
      "Intl.DateTimeFormat.prototype": {
        format: {
          get: "[Function]",
          enumerable: false,
          configurable: true,
          getterFnName: "get format",
          getterFnLength: 0,
          getterSurfaceValue: "[Error: TypeError]",
        },
      },
    };
    const spoofed: RuntimeSnapshot = {
      "Intl.DateTimeFormat.prototype": {
        format: {
          get: "[Function]",
          enumerable: false,
          configurable: true,
          getterFnName: "format",
          getterFnLength: 0,
          getterSurfaceValue: "[Error: TypeError]",
        },
      },
    };

    const result = diffSnapshots(vanilla, spoofed, "firefox");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      api: "Intl.DateTimeFormat.prototype.format",
      diffType: "changed",
    });
  });

  it("detects getterSurfaceValue differences (illegal receiver parity drift)", () => {
    const vanilla: RuntimeSnapshot = {
      "Intl.DateTimeFormat.prototype": {
        format: {
          get: "[Function]",
          enumerable: false,
          configurable: true,
          getterFnName: "get format",
          getterFnLength: 0,
          getterSurfaceValue: "[Error: TypeError]",
        },
      },
    };
    const spoofed: RuntimeSnapshot = {
      "Intl.DateTimeFormat.prototype": {
        format: {
          get: "[Function]",
          enumerable: false,
          configurable: true,
          getterFnName: "get format",
          getterFnLength: 0,
          getterSurfaceValue: "function() { [native code] }",
        },
      },
    };

    const result = diffSnapshots(vanilla, spoofed, "firefox");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      api: "Intl.DateTimeFormat.prototype.format",
      diffType: "changed",
    });
  });

  it("detects fnName differences (replaced function with wrong name)", () => {
    const vanilla: RuntimeSnapshot = {
      "Date.prototype": {
        getTimezoneOffset: {
          value: "function",
          writable: true,
          enumerable: true,
          configurable: true,
          fnName: "getTimezoneOffset",
          fnLength: 0,
        },
      },
    };
    const spoofed: RuntimeSnapshot = {
      "Date.prototype": {
        getTimezoneOffset: {
          value: "function",
          writable: true,
          enumerable: true,
          configurable: true,
          fnName: "spoofedGetTimezoneOffset",
          fnLength: 0,
        },
      },
    };

    const result = diffSnapshots(vanilla, spoofed, "chromium");
    expect(result).toHaveLength(1);
    expect(result[0]!.diffType).toBe("changed");
  });

  it("detects fnLength differences (replaced function with wrong arity)", () => {
    const vanilla: RuntimeSnapshot = {
      "Date.prototype": {
        toString: {
          value: "function",
          writable: true,
          enumerable: true,
          configurable: true,
          fnName: "toString",
          fnLength: 0,
        },
      },
    };
    const spoofed: RuntimeSnapshot = {
      "Date.prototype": {
        toString: {
          value: "function",
          writable: true,
          enumerable: true,
          configurable: true,
          fnName: "toString",
          fnLength: 1,
        },
      },
    };

    const result = diffSnapshots(vanilla, spoofed, "chromium");
    expect(result).toHaveLength(1);
    expect(result[0]!.diffType).toBe("changed");
  });

  it("detects fnSurfaceValue differences (zero-arg method receiver drift)", () => {
    const vanilla: RuntimeSnapshot = {
      "Date.prototype": {
        toString: {
          value: "function",
          writable: true,
          enumerable: true,
          configurable: true,
          fnName: "toString",
          fnLength: 0,
          fnSurfaceValue: "[Error: TypeError]",
        },
      },
    };
    const spoofed: RuntimeSnapshot = {
      "Date.prototype": {
        toString: {
          value: "function",
          writable: true,
          enumerable: true,
          configurable: true,
          fnName: "toString",
          fnLength: 0,
          fnSurfaceValue: "Thu Jan 01 1970 00:00:00 GMT+0000 (UTC)",
        },
      },
    };

    const result = diffSnapshots(vanilla, spoofed, "firefox");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      api: "Date.prototype.toString",
      diffType: "changed",
    });
  });

  it("detects actualValue differences (non-function data property changed)", () => {
    const vanilla: RuntimeSnapshot = {
      "Navigator.prototype": {
        maxTouchPoints: {
          value: "number",
          writable: true,
          enumerable: true,
          configurable: true,
          actualValue: "0",
        },
      },
    };
    const spoofed: RuntimeSnapshot = {
      "Navigator.prototype": {
        maxTouchPoints: {
          value: "number",
          writable: true,
          enumerable: true,
          configurable: true,
          actualValue: "5",
        },
      },
    };

    const result = diffSnapshots(vanilla, spoofed, "chromium");
    expect(result).toHaveLength(1);
    expect(result[0]!.diffType).toBe("changed");
  });

  it("treats identical enhanced fields as equal (no false positives)", () => {
    const desc: DescriptorInfo = {
      value: "function",
      writable: true,
      enumerable: true,
      configurable: true,
      fnName: "getTimezoneOffset",
      fnLength: 0,
    };
    const vanilla: RuntimeSnapshot = { "Date.prototype": { getTimezoneOffset: desc } };
    const spoofed: RuntimeSnapshot = {
      "Date.prototype": { getTimezoneOffset: { ...desc } },
    };

    const result = diffSnapshots(vanilla, spoofed, "chromium");
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// diffValueProbes
// ---------------------------------------------------------------------------

describe("diffValueProbes", () => {
  it("detects value differences between vanilla and spoofed probes", () => {
    const vanilla: ProbeResults = {
      "Date.prototype.getTimezoneOffset": "-300",
      "Date.prototype.toString": "Thu Jan 01 1970 00:00:00 GMT+0000 (UTC)",
    };
    const spoofed: ProbeResults = {
      "Date.prototype.getTimezoneOffset": "0",
      "Date.prototype.toString": "Thu Jan 01 1970 00:00:00 GMT+0000 (GMT)",
    };

    const result = diffValueProbes(vanilla, spoofed, "chromium");
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      api: "Date.prototype.getTimezoneOffset",
      browser: "chromium",
      diffType: "value-changed",
      vanillaValue: "-300",
      spoofedValue: "0",
    });
  });

  it("returns empty array when probe values match", () => {
    const probes: ProbeResults = {
      "Date.prototype.getTimezoneOffset": "-300",
    };

    const result = diffValueProbes(probes, { ...probes }, "chromium");
    expect(result).toEqual([]);
  });

  it("returns empty array for empty probes", () => {
    const result = diffValueProbes({}, {}, "firefox");
    expect(result).toEqual([]);
  });

  it("skips probes missing from spoofed results", () => {
    const vanilla: ProbeResults = {
      "Date.prototype.getTimezoneOffset": "-300",
    };
    const spoofed: ProbeResults = {};

    const result = diffValueProbes(vanilla, spoofed, "chromium");
    expect(result).toEqual([]);
  });

  it("tags probe patches with the correct browser", () => {
    const vanilla: ProbeResults = { test: "a" };
    const spoofed: ProbeResults = { test: "b" };

    const cr = diffValueProbes(vanilla, spoofed, "chromium");
    const ff = diffValueProbes(vanilla, spoofed, "firefox");

    expect(cr[0]!.browser).toBe("chromium");
    expect(ff[0]!.browser).toBe("firefox");
  });

  it("propagates configured severity from value probe metadata", () => {
    const vanilla: ProbeResults = {
      "Date.prototype.toString": "Thu Jan 01 1970 00:00:00 GMT+0000 (UTC)",
    };
    const spoofed: ProbeResults = {
      "Date.prototype.toString": "Thu Jan 01 1970 01:00:00 GMT+0100 (CET)",
    };
    const valueProbes: ValueProbe[] = [
      {
        expression: "new Date(0).toString()",
        api: "Date.prototype.toString",
        severityOnChange: "WARNING",
      },
    ];

    const result = diffValueProbes(vanilla, spoofed, "chromium", valueProbes);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      api: "Date.prototype.toString",
      valueProbeCategory: "compatibility",
      valueProbeSeverity: "WARNING",
    });
  });

  it("reports expected-pattern violations even without vanilla drift", () => {
    const vanilla: ProbeResults = {
      "Date.prototype.toString(parseable)": "invalid",
    };
    const spoofed: ProbeResults = {
      "Date.prototype.toString(parseable)": "invalid",
    };
    const valueProbes: ValueProbe[] = [
      {
        expression: "(() => 'invalid')()",
        api: "Date.prototype.toString(parseable)",
        category: "compatibility",
        expectedPattern: "^ok$",
        expectedDescription: "roundtrip parse should stay usable",
      },
    ];

    const result = diffValueProbes(vanilla, spoofed, "chromium", valueProbes);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      api: "Date.prototype.toString(parseable)",
      diffType: "value-policy-violation",
      valueProbeCategory: "compatibility",
      valueProbeSeverity: "WARNING",
      valueProbePattern: "^ok$",
      valueProbeDescription: "roundtrip parse should stay usable",
    });
  });

  it("applies expectation regexes to a nested result path when configured", () => {
    const vanilla: ProbeResults = {
      "Intl.DateTimeFormat.prototype.format(returned-function-lies)":
        '{"callOutcome":"1/1/1970","applyOutcome":"1/1/1970"}',
    };
    const spoofed: ProbeResults = {
      "Intl.DateTimeFormat.prototype.format(returned-function-lies)":
        '{"callOutcome":"01/01/1970","applyOutcome":"01/01/1970"}',
    };
    const valueProbes: ValueProbe[] = [
      {
        kind: "function-lies",
        expression: "(() => null)()",
        api: "Intl.DateTimeFormat.prototype.format(returned-function-lies)",
        category: "compatibility",
        expectedPattern: "^\\d{1,2}/\\d{1,2}/\\d{4}$",
        expectedPatternPath: "callOutcome",
        expectedDescription: "callOutcome should stay native-looking",
      },
    ];

    const result = diffValueProbes(vanilla, spoofed, "chromium", valueProbes);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      diffType: "value-changed",
      valueProbeCategory: "compatibility",
    });
    expect(result[0]).not.toHaveProperty("valueProbeSeverity");
  });
});
