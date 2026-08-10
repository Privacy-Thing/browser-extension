import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createManifest } from "../config/manifest";

const root = resolve(import.meta.dirname, "..");
const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(resolve(root, path), "utf8")) as T;
const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const collectTextFiles = (relativePath: string): string[] => {
  const absolutePath = resolve(root, relativePath);
  if (statSync(absolutePath).isFile()) return [absolutePath];

  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const child = join(relativePath, entry.name);
    if (entry.isDirectory()) return collectTextFiles(child);
    return entry.isFile() ? [resolve(root, child)] : [];
  });
};

describe("Privacy Thing brand migration", () => {
  it("uses the final product taxonomy while preserving Firefox identities", () => {
    const brand = readJson<{
      displayName: string;
      engineName: string;
      diagnosticsName: string;
      fileStem: string;
      artifactStem: string;
      settingsExportStem: string;
      shortDescription: string;
      channels: Record<string, { displayName: string; firefoxExtensionId: string }>;
    }>("config/brand-config.json");

    expect(brand).toMatchObject({
      displayName: "Privacy Thing",
      engineName: "Refract",
      diagnosticsName: "X-Ray",
      fileStem: "privacything",
      artifactStem: "privacything",
      settingsExportStem: "privacything-settings",
    });
    expect(brand.channels.stable).toMatchObject({
      displayName: "Privacy Thing (Preview)",
    });
    expect(brand.channels.beta).toMatchObject({
      displayName: "Privacy Thing Beta",
    });
    expect(sha256(brand.channels.stable.firefoxExtensionId)).toBe(
      "bc5f8591ca9111d2a0028492e2adb6a5db04c826693d2626d39db2295d4bb439",
    );
    expect(sha256(brand.channels.beta.firefoxExtensionId)).toBe(
      "6e847cd69cf7dc1d011350aa04b888f88f114a47a6e1476f7a20849e24af989c",
    );
    const runtimeBrand = readJson<Record<string, string>>(
      "config/runtime-brand-config.json",
    );
    expect(runtimeBrand).toEqual({
      displayName: brand.displayName,
      engineName: brand.engineName,
      diagnosticsName: brand.diagnosticsName,
      fileStem: brand.fileStem,
      settingsExportStem: brand.settingsExportStem,
      shortDescription: brand.shortDescription,
    });
  });

  it("keeps the browser manifest identity and current namespace stable", () => {
    const manifest = createManifest({ browserTarget: "firefox", version: "1.0.0" });
    expect(manifest.name).toBe("__MSG_extName__");

    const contract = readFileSync(
      resolve(root, "src/shared/extension-contract.ts"),
      "utf8",
    );
    expect(contract).toContain('const EXTENSION_NAMESPACE = "pt"');
    expect(contract).toContain('getXRayState: createCommandType("get-doctor-state")');
  });

  it("contains no retired public names in shipping copy", () => {
    const files = [
      ...collectTextFiles("config/store-listings"),
      ...collectTextFiles("src/ui/i18n"),
      ...collectTextFiles("scripts/legal-templates"),
    ];
    const violations = files.flatMap((file) => {
      const retiredName = ["geo", "warp"].join("");
      const match = readFileSync(file, "utf8").match(
        new RegExp(
          `\\b(?:WRPR|${retiredName}|Spoofie|Doctor|Rugate|Spectroscope)\\b`,
          "gi",
        ),
      );
      return match ? [`${file}: ${match.join(", ")}`] : [];
    });

    expect(violations).toEqual([]);
  });

  it("keeps the workspace package namespace stable", () => {
    const packageFiles = collectTextFiles("packages").filter((file) =>
      file.endsWith("package.json"),
    );
    const names = packageFiles.map(
      (file) => readJson<{ name: string }>(file.slice(root.length + 1)).name,
    );

    expect(names).toContain("@privacy-brand/refract-core");
    expect(names).toContain("@privacy-brand/refract-browser");
    expect(names).toContain("@privacy-brand/refract-worker");
    expect(names).toContain("@privacy-brand/xray-protocol");
    expect(names.every((name) => name.startsWith("@privacy-brand/"))).toBe(true);
    expect(readJson<{ name: string }>("package.json").name).toBe("privacything");
  });

  it("keeps source branding files out of public build assets", () => {
    expect(existsSync(resolve(root, "public/branding"))).toBe(false);
    expect(existsSync(resolve(root, "public/icon.svg"))).toBe(false);
    expect(existsSync(resolve(root, "public/pt_logo.svg"))).toBe(false);
    expect(
      existsSync(resolve(root, "assets/branding/privacything-icon-neutral.svg")),
    ).toBe(true);
    expect(
      existsSync(resolve(root, "assets/branding/beta/privacything-icon-neutral.svg")),
    ).toBe(true);
  });

  it("contains no superseded Rugate or Spectroscope names in current migration surfaces", () => {
    const currentTestFile = fileURLToPath(import.meta.url);
    const files = [
      "package.json",
      "pnpm-lock.yaml",
      "Taskfile.yml",
      "README.md",
      "LICENSE.md",
      "NOTICE.md",
      "PRIVACY.md",
      "AGENTS.md",
      ".storybook",
      "config",
      "licenses/privacything",
      "packages",
      "scripts",
      "src",
      "tests",
    ].flatMap(collectTextFiles);
    const violations = files.flatMap((file) => {
      if (file === currentTestFile) return [];
      const match = readFileSync(file, "utf8").match(/rugate|spectroscope/gi);
      return match ? [`${file}: ${match.join(", ")}`] : [];
    });

    expect(violations).toEqual([]);
  });
});
