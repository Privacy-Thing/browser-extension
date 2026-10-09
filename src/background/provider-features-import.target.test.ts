import { describe, expect, it } from "vitest";

import { planSettingsImport } from "./settings-import-plan";
import {
  configurationToExport,
  importedConfiguration,
} from "./settings-import-storage";

import { EXTENSION_STORAGE_KEYS as KEY } from "@/shared/extension-contract";
import type { RuleFeatureBinding } from "@/shared/provider-feature";
import type { ExportedSettings } from "@/shared/types";

const binding: RuleFeatureBinding = {
  rulePattern: "video.example.com",
  providerId: "example-provider",
  featureId: "video",
  featureName: "Video",
  featureType: "service",
  matchSource: "manual",
  confirmedAt: "2026-10-09T10:00:00.000Z",
};
const backup = (bindings: RuleFeatureBinding[] = [binding]): ExportedSettings => ({
  version: 3,
  exportedAt: "2026-10-09T10:00:00.000Z",
  locations: [],
  rules: [
    {
      pattern: binding.rulePattern,
      enabled: true,
      ruleSeedKey: "abc123",
      authKey: "abcdefgh",
    },
  ],
  featureBindings: bindings,
});

describe("provider feature backup", () => {
  it("round-trips generic bindings without provider credentials or recognition cache", () => {
    const storage = importedConfiguration(backup());
    const exported = configurationToExport({
      ...storage,
      [KEY.providerFeatureMatches]: {
        featureMatches: [{ hostname: "private.example.com" }],
      },
      "pt.experimental.control-d.v2.api-key": "fake-private-key",
      "pt.experimental.control-d.v2.recognition": { resolverDoh: "private" },
    });
    expect(exported.featureBindings).toEqual([binding]);
    expect(exported.rules[0]).toMatchObject({
      ruleSeedKey: "abc123",
      authKey: "abcdefgh",
    });
    expect(JSON.stringify(exported)).not.toContain("fake-private-key");
    expect(JSON.stringify(exported)).not.toContain("private.example.com");
    expect(JSON.stringify(exported)).not.toContain("resolverDoh");
  });

  it("migrates old backups to an empty binding collection", () => {
    const old = backup();
    delete old.featureBindings;
    expect(importedConfiguration(old)[KEY.providerFeatures]).toEqual({
      featureBindings: [],
    });
  });

  it.each(["keep", "skip"] as const)(
    "preserves local bindings when an incoming source rule is %s",
    (choice) => {
      const incoming = { ...binding, featureId: "music", featureName: "Music" };
      const result = planSettingsImport({
        current: backup(),
        source: backup([incoming]),
        selection: {
          mode: "merge",
          rules: { [binding.rulePattern]: choice },
          locations: {},
          containers: {},
        },
        localContainerIds: new Set(),
      });
      expect(result.problems).toEqual([]);
      expect(result.settings.featureBindings).toEqual([binding]);
    },
  );

  it("replaces the binding together with an imported source rule", () => {
    const incoming = { ...binding, featureId: "music", featureName: "Music" };
    const result = planSettingsImport({
      current: backup(),
      source: backup([incoming]),
      selection: {
        mode: "merge",
        rules: { [binding.rulePattern]: "import" },
        locations: {},
        containers: {},
      },
      localContainerIds: new Set(),
    });
    expect(result.settings.featureBindings).toEqual([incoming]);
  });

  it("rejects foreign rule references and duplicate service ownership", () => {
    expect(() =>
      importedConfiguration(
        backup([{ ...binding, rulePattern: "missing.example.com" }]),
      ),
    ).toThrow("Unknown rule");
    const duplicate = backup([
      binding,
      { ...binding, rulePattern: "other.example.com" },
    ]);
    duplicate.rules.push({ pattern: "other.example.com", enabled: true });
    expect(() => importedConfiguration(duplicate)).toThrow("Conflicting");
  });
});
