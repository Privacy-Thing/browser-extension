import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { expect, test } from "vitest";

import {
  BUNDLE_SIZE_TOLERANCE,
  CHROME_BOOT_MAX_BYTES,
  CHROME_BOOT_GZIP_BYTES,
  CHROME_EARLY_MAX_BYTES,
  CHROME_RUNTIME_MAX_BYTES,
} from "../../config/build-budgets";
import { BRAND_DISPLAY_NAME } from "../../scripts/brand-config.mjs";

import { findRetiredBuildLeaks } from "./retired-name";

type ChromiumManifest = {
  version?: string;
  version_name?: string;
  content_scripts?: Array<{
    all_frames?: boolean;
    js?: string[];
    match_origin_as_fallback?: boolean;
    world?: string;
  }>;
  web_accessible_resources?: Array<{
    resources?: string[];
  }>;
};

const readChromiumManifest = async (): Promise<ChromiumManifest> => {
  const manifestPath = path.resolve(process.cwd(), "build", "chrome", "manifest.json");
  return JSON.parse(await readFile(manifestPath, "utf8")) as ChromiumManifest;
};

const readChromeBootstrapMap = async (): Promise<{
  sources: string[];
}> => {
  const sourceMapPath = path.resolve(
    process.cwd(),
    "build",
    "chrome",
    "content-bootstrap.js.map",
  );
  return JSON.parse(await readFile(sourceMapPath, "utf8")) as {
    sources: string[];
  };
};

const hasChromeBootstrapMap = async (): Promise<boolean> => {
  const sourceMapPath = path.resolve(
    process.cwd(),
    "build",
    "chrome",
    "content-bootstrap.js.map",
  );

  try {
    await access(sourceMapPath);
    return true;
  } catch {
    return false;
  }
};

const readChromeBootstrap = async (): Promise<Buffer> => {
  const bundlePath = path.resolve(
    process.cwd(),
    "build",
    "chrome",
    "content-bootstrap.js",
  );
  return readFile(bundlePath);
};

const clusteredBuildIdBindings =
  /(?:[A-Za-z_$][\w$]*=(?:"[^"\\]{4,40}"|`[^`\\]{4,40}`),){2,}/;

test("contains no retired namespace outside approved notification copy", async () => {
  expect(await findRetiredBuildLeaks("chrome")).toEqual([]);
});

test("exposes only the runtime-applied marker to downstream CI jobs", async () => {
  const markerPath = path.resolve(
    process.cwd(),
    "build",
    "runtime-applied-marker.chromium.txt",
  );
  const marker = (await readFile(markerPath, "utf8")).trim();

  expect(marker).toMatch(/^[a-z][a-z0-9]{3,15}$/);

  if (process.env.CI) {
    const fullManifestPath = path.resolve(
      process.cwd(),
      "build",
      ".id-manifest.chromium.json",
    );
    await expect(access(fullManifestPath)).rejects.toBeDefined();
  }
});

test("does not expose worker bootstrap resources in the chromium manifest", async () => {
  const manifest = await readChromiumManifest();
  const resources =
    manifest.web_accessible_resources?.flatMap((entry) => entry.resources ?? []) ?? [];

  expect(resources).not.toContain("src/injection/worker/index.ts");
});

test("stamps non-release chromium builds with a local or beta version label", async () => {
  const manifest = await readChromiumManifest();

  if (manifest.version_name) {
    expect(manifest.version_name).toMatch(/^0\.\d{4}\.\d{3,4}\.\d{1,4}-(local|beta)$/);
    expect(manifest.version).toMatch(/^0\.\d{4}\.\d{3,4}\.\d{1,4}$/);
    return;
  }

  expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
});

test("uses static content script bundles instead of async loader stubs", async () => {
  const manifest = await readChromiumManifest();
  const scripts = manifest.content_scripts?.flatMap((entry) => entry.js ?? []) ?? [];

  expect(scripts).toEqual(
    expect.arrayContaining([
      "content-bootstrap.js",
      "main-world-early.js",
      "main-world-runtime.js",
    ]),
  );
  expect(scripts.some((script) => script.includes("-loader"))).toBe(false);
});

test("does not ship removed QA devtools in chromium builds", async () => {
  const manifest = await readChromiumManifest();
  const scripts = manifest.content_scripts?.flatMap((entry) => entry.js ?? []) ?? [];
  const files = await readdir(path.resolve(process.cwd(), "build", "chrome"));

  expect(scripts).not.toContain("content-devtools.js");
  expect(files).not.toContain("content-devtools.js");
});

test("orders the early bootstrap before the single main runtime", async () => {
  const manifest = await readChromiumManifest();
  const scripts = manifest.content_scripts?.flatMap((entry) => entry.js ?? []) ?? [];
  const earlyIndex = scripts.indexOf("main-world-early.js");
  const runtimeIndex = scripts.indexOf("main-world-runtime.js");

  expect(earlyIndex).toBeGreaterThanOrEqual(0);
  expect(runtimeIndex).toBeGreaterThan(earlyIndex);
  expect(scripts).not.toContain("main-world-battery-early.js");
});

test("runs MAIN bundles in fallback-origin documents", async () => {
  const manifest = await readChromiumManifest();

  for (const scriptName of ["main-world-early.js", "main-world-runtime.js"]) {
    const entry = manifest.content_scripts?.find((script) =>
      script.js?.includes(scriptName),
    );
    expect(entry?.match_origin_as_fallback, scriptName).toBe(true);
  }

  const bootstrapEntry = manifest.content_scripts?.find((script) =>
    script.js?.includes("content-bootstrap.js"),
  );
  expect(bootstrapEntry?.match_origin_as_fallback).toBe(true);
});

test("keeps heavy profile-resolution dependencies out of the chromium content bootstrap bundle", async () => {
  const manifest = await readChromiumManifest();
  const hasSourceMap = await hasChromeBootstrapMap();

  if (!hasSourceMap) {
    expect(manifest.version).toBeTruthy();
    return;
  }

  const sourceMap = await readChromeBootstrapMap();

  const hasSource = (pattern: string): boolean =>
    sourceMap.sources.some((source) => source.includes(pattern));

  expect(hasSource("timezone-support")).toBe(false);
  expect(hasSource("background/rules/resolver.ts")).toBe(false);
  expect(hasSource("background/storage/profiles.ts")).toBe(false);
  expect(hasSource("background/storage/rules.ts")).toBe(false);
  expect(hasSource("background/storage/control-state.ts")).toBe(false);
  expect(hasSource("background/storage/preferences.ts")).toBe(false);
  expect(hasSource("packages/refract-browser/src/common/firefox-shim-state.ts")).toBe(
    false,
  );
  expect(hasSource("packages/refract-core/src/time/date-prototype-methods.ts")).toBe(
    false,
  );
  expect(hasSource("packages/refract-core/src/fingerprint/audio-noise.ts")).toBe(false);
  expect(
    hasSource("packages/refract-core/src/fingerprint/client-hints-getters.ts"),
  ).toBe(false);
  expect(hasSource("packages/refract-core/src/fingerprint/webgl-error.ts")).toBe(false);
  expect(hasSource("src/content/qa-devtools.ts")).toBe(false);
});

test("keeps the chromium content bootstrap bundle within the startup budget", async () => {
  const bundle = await readChromeBootstrap();
  const gzipBytes = gzipSync(bundle).byteLength;

  expect(
    bundle.byteLength,
    `content-bootstrap.js is ${bundle.byteLength} B — exceeds ${CHROME_BOOT_MAX_BYTES} B budget + ${BUNDLE_SIZE_TOLERANCE} B tolerance`,
  ).toBeLessThanOrEqual(CHROME_BOOT_MAX_BYTES + BUNDLE_SIZE_TOLERANCE);
  expect(gzipBytes).toBeLessThanOrEqual(CHROME_BOOT_GZIP_BYTES + BUNDLE_SIZE_TOLERANCE);
});

test(`main-world-early.js is within the ${CHROME_EARLY_MAX_BYTES / 1024} KB early-inline budget`, async () => {
  const earlyPath = path.resolve(
    process.cwd(),
    "build",
    "chrome",
    "main-world-early.js",
  );
  const early = await readFile(earlyPath);
  expect(
    early.byteLength,
    `main-world-early.js is ${early.byteLength} B — exceeds ${CHROME_EARLY_MAX_BYTES} B budget + ${BUNDLE_SIZE_TOLERANCE} B tolerance`,
  ).toBeLessThanOrEqual(CHROME_EARLY_MAX_BYTES + BUNDLE_SIZE_TOLERANCE);
});

test("keeps Battery out of the early bootstrap and in the Chromium runtime", async () => {
  const [early, runtime] = await Promise.all([
    readFile(
      path.resolve(process.cwd(), "build", "chrome", "main-world-early.js"),
      "utf8",
    ),
    readFile(
      path.resolve(process.cwd(), "build", "chrome", "main-world-runtime.js"),
      "utf8",
    ),
  ]);

  expect(early).not.toContain("getBattery");
  expect(early).not.toContain("BatteryManager");
  expect(runtime).toContain("getBattery");
  expect(runtime).toContain("BatteryManager");
});

test(`main-world-runtime.js is within the ${CHROME_RUNTIME_MAX_BYTES / 1024} KB runtime budget`, async () => {
  const runtimePath = path.resolve(
    process.cwd(),
    "build",
    "chrome",
    "main-world-runtime.js",
  );
  const runtime = await readFile(runtimePath);
  expect(
    runtime.byteLength,
    `main-world-runtime.js is ${runtime.byteLength} B — exceeds ${CHROME_RUNTIME_MAX_BYTES} B budget + ${BUNDLE_SIZE_TOLERANCE} B tolerance`,
  ).toBeLessThanOrEqual(CHROME_RUNTIME_MAX_BYTES + BUNDLE_SIZE_TOLERANCE);
});

test("compiled chromium page-world scripts do not contain product-identifying strings", async () => {
  const earlyPath = path.resolve(
    process.cwd(),
    "build",
    "chrome",
    "main-world-early.js",
  );
  const runtimePath = path.resolve(
    process.cwd(),
    "build",
    "chrome",
    "main-world-runtime.js",
  );
  const [early, runtime] = await Promise.all([
    readFile(earlyPath, "utf8"),
    readFile(runtimePath, "utf8"),
  ]);

  for (const [label, source] of [
    ["early", early],
    ["runtime", runtime],
  ] as const) {
    // No hardcoded product-identifying DOM IDs, event names, or global flags
    expect(source, `${label}: __PT_RUNTIME_READY__`).not.toContain(
      "__PT_RUNTIME_READY__",
    );
    expect(source, `${label}: pt:log-event`).not.toContain("pt:log-event");
    expect(source, `${label}: pt_log_`).not.toContain("pt_log_");
    expect(source, `${label}: pt:native-sources`).not.toContain("pt:native-sources");
    // No hardcoded Symbol.for keys used for internal markers
    expect(source, `${label}: date-shift:7f4c3e9b`).not.toContain(
      "date-shift:7f4c3e9b",
    );
  }
});

test("compiled chromium transport names have no semantic signatures", async () => {
  const sources = await Promise.all(
    ["content-bootstrap.js", "main-world-early.js", "main-world-runtime.js"].map(
      (fileName) =>
        readFile(path.resolve(process.cwd(), "build", "chrome", fileName), "utf8"),
    ),
  );
  const forbiddenSignatures = [
    /data-\$\{[^}]+\}-(?:payload|off)/i,
    /data-[a-z0-9]+-(?:payload|off)/i,
    /(?:-|:)main-runtime/i,
    /:strict_issue/i,
    /__pt[a-z]*/i,
    /pt:worker-bootstrap-ack/i,
    /__REFRACT_WORKER_[A-Z_]+/,
  ];

  for (const source of sources) {
    for (const signature of forbiddenSignatures) {
      expect(source, signature.source).not.toMatch(signature);
    }
  }
});

test("does not cluster build identifiers at the start of chromium page-world bundles", async () => {
  for (const fileName of ["main-world-early.js", "main-world-runtime.js"]) {
    const source = await readFile(
      path.resolve(process.cwd(), "build", "chrome", fileName),
      "utf8",
    );

    expect(source.slice(0, 5_000), fileName).not.toMatch(clusteredBuildIdBindings);
  }
});

test("captures collection primordials before private page-world collections", async () => {
  for (const fileName of ["main-world-early.js", "main-world-runtime.js"]) {
    const source = await readFile(
      path.resolve(process.cwd(), "build", "chrome", fileName),
      "utf8",
    );
    const captureIndex = source.indexOf("WeakMap.prototype.get");
    expect(
      captureIndex,
      `${fileName}: missing primordial capture`,
    ).toBeGreaterThanOrEqual(0);
    for (const collectionExpression of ["new Set", "new WeakMap"]) {
      const collectionIndex = source.indexOf(collectionExpression);
      if (collectionIndex >= 0) {
        expect(
          captureIndex,
          `${fileName}: ${collectionExpression} precedes primordials`,
        ).toBeLessThan(collectionIndex);
      }
    }
  }
});

test("packages legal artifacts in the chromium build output", async () => {
  const noticesPath = path.resolve(
    process.cwd(),
    "build",
    "chrome",
    "licenses",
    "privacything",
    "THIRD_PARTY_NOTICES.md",
  );
  const licensePath = path.resolve(process.cwd(), "build", "chrome", "LICENSE.md");
  const brandingPath = path.resolve(
    process.cwd(),
    "build",
    "chrome",
    "licenses",
    "privacything",
    "BRANDING.md",
  );
  const commercialLicensePath = path.resolve(
    process.cwd(),
    "build",
    "chrome",
    "licenses",
    "privacything",
    "COMMERCIAL_LICENSE.md",
  );
  const agplLicensePath = path.resolve(
    process.cwd(),
    "build",
    "chrome",
    "licenses",
    "AGPL-3.0.txt",
  );
  const mapLibreLicensePath = path.resolve(
    process.cwd(),
    "build",
    "chrome",
    "licenses",
    "maplibre-gl-LICENSE.txt",
  );

  const [notices, license, branding, commercialLicense, agplLicense, mapLibreLicense] =
    await Promise.all([
      readFile(noticesPath, "utf8"),
      readFile(licensePath, "utf8"),
      readFile(brandingPath, "utf8"),
      readFile(commercialLicensePath, "utf8"),
      readFile(agplLicensePath, "utf8"),
      readFile(mapLibreLicensePath, "utf8"),
    ]);

  expect(notices).toContain("Third-Party Notices");
  expect(notices).toContain("Font Awesome Free");
  expect(license).toContain(`# ${BRAND_DISPLAY_NAME} License`);
  expect(license).toContain("SPDX-License-Identifier: AGPL-3.0-or-later");
  expect(branding).toContain("Branding and Attribution Policy");
  expect(commercialLicense).toContain("dual-license model");
  expect(agplLicense).toContain("GNU AFFERO GENERAL PUBLIC LICENSE");
  expect(mapLibreLicense).toContain(
    "Contains code from mapbox-gl-js v1.13 and earlier",
  );
});

test("does not output Firefox specific injection files in the chromium build output", async () => {
  const mainWorldPath = path.resolve(
    process.cwd(),
    "build",
    "chrome",
    "firefox-main-world.js",
  );
  const geoShimPath = path.resolve(
    process.cwd(),
    "build",
    "chrome",
    "firefox-geo-shim.js",
  );

  const checkExists = async (filePath: string): Promise<boolean> => {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  };

  expect(await checkExists(mainWorldPath)).toBe(false);
  expect(await checkExists(geoShimPath)).toBe(false);
});
