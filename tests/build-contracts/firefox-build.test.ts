import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "vitest";

import {
  BUNDLE_SIZE_TOLERANCE,
  FX_GEO_SHIM_MAX_BYTES,
  FX_MAIN_WORLD_MAX_BYTES,
} from "../../config/build-budgets";
import {
  BRAND_DISPLAY_NAME,
  BETA_FX_EXT_ID,
  STABLE_FX_EXT_ID,
} from "../../scripts/brand-config.mjs";

import { findRetiredBuildLeaks } from "./retired-name";

type FirefoxManifest = {
  version?: string;
  version_name?: string;
  background?: {
    scripts?: string[];
    service_worker?: string;
    type?: string;
  };
  minimum_chrome_version?: string;
  action?: {
    default_popup?: string;
  };
  browser_specific_settings?: {
    gecko?: {
      id?: string;
      update_url?: string;
      data_collection_permissions?: {
        required?: string[];
      };
    };
  };
  content_scripts?: Array<{
    all_frames?: boolean;
    js?: string[];
    match_about_blank?: boolean;
    world?: string;
  }>;
  web_accessible_resources?: Array<{
    resources?: string[];
  }>;
};

const readFirefoxManifest = async (): Promise<FirefoxManifest> => {
  const manifestPath = path.resolve(process.cwd(), "build", "firefox", "manifest.json");
  return JSON.parse(await readFile(manifestPath, "utf8")) as FirefoxManifest;
};

const clusteredBuildIdBindings =
  /(?:[A-Za-z_$][\w$]*=(?:"[^"\\]{4,40}"|`[^`\\]{4,40}`),){2,}/;

test("contains no retired namespace outside approved Firefox IDs and notification values", async () => {
  expect(await findRetiredBuildLeaks("firefox")).toEqual([]);
});

test("builds a firefox artifact with gecko settings and script-injection fallback", async () => {
  const manifest = await readFirefoxManifest();
  const isNonReleaseBuild = Boolean(manifest.version_name);

  expect(manifest.minimum_chrome_version).toBeUndefined();
  expect(manifest.browser_specific_settings?.gecko?.id).toBe(
    isNonReleaseBuild ? BETA_FX_EXT_ID : STABLE_FX_EXT_ID,
  );
  expect(manifest.browser_specific_settings?.gecko?.update_url).toBeUndefined();
  expect(
    manifest.browser_specific_settings?.gecko?.data_collection_permissions?.required,
  ).toEqual(["locationInfo", "searchTerms"]);
  expect(manifest.background?.service_worker).toBeUndefined();
  expect(manifest.background?.scripts).toHaveLength(1);
  expect(manifest.background?.scripts?.[0]).toBe("assets/background.js");
  expect(manifest.background?.type).toBe("module");

  const mainWorldScript = manifest.content_scripts?.find((script) =>
    script.js?.some((entry) => entry.includes("injection/main")),
  );
  expect(mainWorldScript).toBeUndefined();
  expect(manifest.content_scripts?.flatMap((script) => script.js ?? [])).toEqual(
    expect.arrayContaining(["content-bootstrap.js"]),
  );
  expect(manifest.content_scripts?.every((script) => script.all_frames === true)).toBe(
    true,
  );
  const bootstrapScript = manifest.content_scripts?.find((script) =>
    script.js?.includes("content-bootstrap.js"),
  );
  expect(bootstrapScript?.match_about_blank).toBe(true);

  const resources = manifest.web_accessible_resources?.flatMap(
    (entry) => entry.resources ?? [],
  );
  expect(resources).toEqual(expect.arrayContaining(["main-world-runtime.js"]));
  expect(manifest.action?.default_popup).toBe("src/ui/popup/index.html");
  expect(
    manifest.content_scripts
      ?.flatMap((script) => script.js ?? [])
      .includes("main-world-battery-early.js"),
  ).toBe(false);

  const geoShimPath = path.resolve(
    process.cwd(),
    "build",
    "firefox",
    "main-world-early.js",
  );
  const geoShim = await readFile(geoShimPath, "utf8");
  expect(geoShim).not.toContain("__PT_FF_GEO_SHIM__");
  expect(geoShim).not.toContain("__gw_ff_shim__");
  // Positive: Symbol.for guard must be present in compiled output
  expect(geoShim).toContain("Symbol.for(");
  expect(geoShim).toContain("getSeconds(){");
  expect(geoShim).toContain("getMilliseconds(){");
  expect(geoShim).toMatch(
    /Object\.defineProperty\([A-Za-z_$][\w$]*\.prototype,"format"/,
  );
  expect(geoShim).not.toContain('Object.defineProperty(this,"format"');
  expect(geoShim).not.toContain("__PT_FIREFOX_HOST_PAYLOAD__");
});

test("does not ship removed QA devtools in firefox builds", async () => {
  const manifest = await readFirefoxManifest();
  const scripts = manifest.content_scripts?.flatMap((entry) => entry.js ?? []) ?? [];
  const files = await readdir(path.resolve(process.cwd(), "build", "firefox"));

  expect(scripts).not.toContain("content-devtools.js");
  expect(files).not.toContain("content-devtools.js");
});

test("does not emit or bundle Chromium Battery support", async () => {
  const files = await readdir(path.resolve(process.cwd(), "build", "firefox"));
  expect(files).not.toContain("main-world-battery-early.js");
  const runtime = await readFile(
    path.resolve(process.cwd(), "build", "firefox", "main-world-runtime.js"),
    "utf8",
  );
  expect(runtime).not.toContain("getBattery");
  expect(runtime).not.toContain("BatteryManager");
});

test("stamps non-release firefox builds with a local or beta version label", async () => {
  const manifest = await readFirefoxManifest();

  if (manifest.version_name) {
    expect(manifest.version_name).toMatch(/^0\.\d{4}\.\d{3,4}\.\d{1,4}-(local|beta)$/);
    expect(manifest.version).toMatch(/^0\.\d{4}\.\d{3,4}\.\d{1,4}$/);
    return;
  }

  expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
});

test("compiled firefox page-world scripts do not contain product-identifying channel strings", async () => {
  const geoShimPath = path.resolve(
    process.cwd(),
    "build",
    "firefox",
    "main-world-early.js",
  );
  const mainWorldPath = path.resolve(
    process.cwd(),
    "build",
    "firefox",
    "main-world-runtime.js",
  );

  const [geoShim, mainWorld] = await Promise.all([
    readFile(geoShimPath, "utf8"),
    readFile(mainWorldPath, "utf8"),
  ]);

  for (const [label, source] of [
    ["geo-shim", geoShim],
    ["main-world", mainWorld],
  ] as const) {
    // No hardcoded product-identifying DOM IDs, event names, or global flags
    expect(source, `${label}: pt-firefox-state-port`).not.toContain(
      "pt-firefox-state-port",
    );
    expect(source, `${label}: pt-firefox-state-change`).not.toContain(
      "pt-firefox-state-change",
    );
    expect(source, `${label}: __PT_RUNTIME_READY__`).not.toContain(
      "__PT_RUNTIME_READY__",
    );
    expect(source, `${label}: pt:log-event`).not.toContain("pt:log-event");
    expect(source, `${label}: pt:native-sources`).not.toContain("pt:native-sources");
    // No hardcoded Symbol.for keys used for internal markers
    expect(source, `${label}: date-shift:7f4c3e9b`).not.toContain(
      "date-shift:7f4c3e9b",
    );
    // No persistent DOM element selectors (hybrid transport uses ephemeral <script> only)
    expect(source, `${label}: getElementById`).not.toContain("getElementById");
  }
});

test("does not cluster build identifiers at the start of firefox page-world bundles", async () => {
  for (const fileName of ["main-world-early.js", "main-world-runtime.js"]) {
    const source = await readFile(
      path.resolve(process.cwd(), "build", "firefox", fileName),
      "utf8",
    );

    expect(source.slice(0, 5_000), fileName).not.toMatch(clusteredBuildIdBindings);
  }
});

test(`main-world-early.js is within the ${FX_GEO_SHIM_MAX_BYTES / 1024} KB budget`, async () => {
  const geoShimPath = path.resolve(
    process.cwd(),
    "build",
    "firefox",
    "main-world-early.js",
  );
  const geoShim = await readFile(geoShimPath);
  expect(
    geoShim.byteLength,
    `main-world-early.js is ${geoShim.byteLength} B — exceeds ${FX_GEO_SHIM_MAX_BYTES} B budget + ${BUNDLE_SIZE_TOLERANCE} B tolerance`,
  ).toBeLessThanOrEqual(FX_GEO_SHIM_MAX_BYTES + BUNDLE_SIZE_TOLERANCE);
});

test(`main-world-runtime.js is within the ${FX_MAIN_WORLD_MAX_BYTES / 1024} KB budget`, async () => {
  const mainWorldPath = path.resolve(
    process.cwd(),
    "build",
    "firefox",
    "main-world-runtime.js",
  );
  const mainWorld = await readFile(mainWorldPath);
  expect(
    mainWorld.byteLength,
    `main-world-runtime.js is ${mainWorld.byteLength} B — exceeds ${FX_MAIN_WORLD_MAX_BYTES} B budget + ${BUNDLE_SIZE_TOLERANCE} B tolerance`,
  ).toBeLessThanOrEqual(FX_MAIN_WORLD_MAX_BYTES + BUNDLE_SIZE_TOLERANCE);
});

test("captures collection primordials before private bundle collections", async () => {
  for (const fileName of ["main-world-early.js", "main-world-runtime.js"]) {
    const source = await readFile(
      path.resolve(process.cwd(), "build", "firefox", fileName),
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

test("keeps the generated worker runtime compressed out of page-world artifacts", async () => {
  const geoShimPath = path.resolve(
    process.cwd(),
    "build",
    "firefox",
    "main-world-early.js",
  );
  const mainWorldPath = path.resolve(
    process.cwd(),
    "build",
    "firefox",
    "main-world-runtime.js",
  );

  const [geoShim, mainWorld] = await Promise.all([
    readFile(geoShimPath, "utf8"),
    readFile(mainWorldPath, "utf8"),
  ]);

  for (const source of [geoShim, mainWorld]) {
    expect(source).not.toContain("inactive-before-schedule");
    expect(source).not.toContain("suspended-hidden");
    expect(source).not.toContain("createGeoWatchController");
  }
  expect(mainWorld).toContain("atob(");
});

test("compiled firefox transport names have no semantic signatures", async () => {
  const sources = await Promise.all(
    ["content-bootstrap.js", "main-world-early.js", "main-world-runtime.js"].map(
      (fileName) =>
        readFile(path.resolve(process.cwd(), "build", "firefox", fileName), "utf8"),
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

test("packages legal artifacts in the firefox build output", async () => {
  const noticesPath = path.resolve(
    process.cwd(),
    "build",
    "firefox",
    "licenses",
    "privacything",
    "THIRD_PARTY_NOTICES.md",
  );
  const noticePath = path.resolve(process.cwd(), "build", "firefox", "NOTICE.md");
  const licensePath = path.resolve(process.cwd(), "build", "firefox", "LICENSE.md");
  const commercialLicensePath = path.resolve(
    process.cwd(),
    "build",
    "firefox",
    "licenses",
    "privacything",
    "COMMERCIAL_LICENSE.md",
  );
  const agplLicensePath = path.resolve(
    process.cwd(),
    "build",
    "firefox",
    "licenses",
    "AGPL-3.0.txt",
  );
  const apacheLicensePath = path.resolve(
    process.cwd(),
    "build",
    "firefox",
    "licenses",
    "Apache-2.0.txt",
  );

  const [notices, notice, license, commercialLicense, agplLicense, apacheLicense] =
    await Promise.all([
      readFile(noticesPath, "utf8"),
      readFile(noticePath, "utf8"),
      readFile(licensePath, "utf8"),
      readFile(commercialLicensePath, "utf8"),
      readFile(agplLicensePath, "utf8"),
      readFile(apacheLicensePath, "utf8"),
    ]);

  expect(notices).toContain("Third-Party Notices");
  expect(notices).toContain("MapLibre GL JS");
  expect(notice).toContain(`# ${BRAND_DISPLAY_NAME} Notices`);
  expect(license).toContain(`# ${BRAND_DISPLAY_NAME} License`);
  expect(license).toContain("SPDX-License-Identifier: AGPL-3.0-or-later");
  expect(commercialLicense).toContain("dual-license model");
  expect(agplLicense).toContain("GNU AFFERO GENERAL PUBLIC LICENSE");
  expect(apacheLicense).toContain("Apache License");
});
