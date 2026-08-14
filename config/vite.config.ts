import { createHmac, randomBytes } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin, type ResolvedConfig } from "vite";

import {
  normalizeBuildChannel,
  resolveFirefoxExtensionId,
  resolveFirefoxUpdateUrl,
  resolveManifestExtName,
  resolveManifestShortDescription,
  shouldEmitBuildSourceMaps,
  MANIFEST_DEFAULT_LOCALE,
  MANIFEST_LOCALE_CODES,
} from "../scripts/build-channel-config.mjs";

import baseManifest from "./manifest";
import {
  configDirectory,
  repositoryRootDirectory,
  uiAliasEntries,
} from "./path-aliases";

type BuildTarget = "chromium" | "firefox";

const buildTarget =
  (process.env.PT_BROWSER_TARGET as BuildTarget) === "firefox" ? "firefox" : "chromium";
const extraEntry = process.env.PT_EXTRA_ENTRY ?? "";
const outDir =
  process.env.PT_OUT_DIR ??
  (buildTarget === "firefox" ? "build/firefox" : "build/chrome");
const buildChannel = normalizeBuildChannel(process.env.PT_BUILD_CHANNEL ?? "local");
if (!["release", "beta", "local"].includes(buildChannel)) {
  throw new Error(`Unsupported build channel: ${buildChannel}`);
}

/**
 * Per-build random identifiers that replace product-specific strings in the
 * compiled output.  Each build gets fresh values so that static string matching
 * cannot fingerprint the extension.
 *
 * Obfuscation is controlled by the `PT_ENV` environment variable:
 * - `"development"` → human-readable developer-friendly names
 * - any other value (or unset) → HMAC-derived random identifiers (default)
 *
 * When running through the build script (`scripts/build-target.mjs`), the salt
 * is passed via `PT_BUILD_SALT` env so that all entry-point bundles share
 * the same identifiers.  For one-off `vite build` or `vitest` invocations a
 * fresh random salt is generated.
 *
 * HMAC-derived identifiers use HMAC-SHA256(salt, tag) → base62, producing output
 * indistinguishable from typical minified JS variable names.  Variable length
 * (4-16 chars) is itself derived from the hash to prevent fixed-length pattern
 * matching.  The first character is always drawn from [a-zA-Z_$] so identifiers
 * are valid in all JS/CSS/DOM contexts.
 *
 * A full build manifest is written only for local developer debugging. CI gets
 * only the runtime-applied marker required by API conformance, so it does not
 * publish a semantic dictionary for every private channel.
 */
const shouldObfuscateIds = process.env.PT_ENV !== "development";

const buildSalt = process.env.PT_BUILD_SALT || randomBytes(80).toString("hex");

const BASE62_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
// Characters valid as JS identifier start (letters + _ + $)
const ID_START_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";

const nextBuildId = (tag: string): string => {
  const hmac = createHmac("sha256", buildSalt).update(tag).digest();
  // Use first byte to determine length: 4-16 chars
  const idLen = 4 + (hmac[0]! % 13);
  // First character: draw from ID_START_CHARS to guarantee valid identifier start
  let id = ID_START_CHARS[hmac[1]! % ID_START_CHARS.length]!;
  // Remaining characters: draw from full base62 set (idLen - 1 more chars)
  for (let i = 2; i <= idLen && i < hmac.length; i++) {
    id += BASE62_CHARS[hmac[i]! % BASE62_CHARS.length]!;
  }
  return id;
};

/**
 * Generates a DOM-attribute-safe identifier: `[a-z][a-z0-9]*`.
 *
 * Used for values that end up in HTML `data-*` attribute names or CSS
 * selectors.  Unlike `nextBuildId`, this avoids uppercase, `$`, `_`, and
 * other characters that are valid in JS identifiers but not in
 * `data-*` attribute names or unescaped CSS selectors.
 */
const DOM_ATTR_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const DOM_ATTR_START = "abcdefghijklmnopqrstuvwxyz";

const nextDomAttrId = (tag: string): string => {
  const hmac = createHmac("sha256", buildSalt).update(tag).digest();
  const idLen = 4 + (hmac[0]! % 13);
  let id = DOM_ATTR_START[hmac[1]! % DOM_ATTR_START.length]!;
  for (let i = 2; i <= idLen && i < hmac.length; i++) {
    id += DOM_ATTR_CHARS[hmac[i]! % DOM_ATTR_CHARS.length]!;
  }
  return id;
};

/**
 * Developer-friendly identifiers used when `PT_ENV` is set to
 * `"development"`.  These are human-readable and make debugging easier during
 * local development, while the HMAC-derived variants (the default) are used
 * for all other builds to prevent static-string fingerprinting.
 */
const DEV_FRIENDLY_IDS = {
  firefoxStatePortId: "gwportid",
  firefoxStateChangeEvent: "gw_state_change",
  runtimeReadyEvent: "gw_runtime_ready",
  runtimeAppliedMarkerAttr: "gwruntimeapplied",
  runtimeConfigMarkerAttr: "gwruntimeconfig",
  runtimeConfigPayloadAttr: "data-gwruntimepayload",
  disabledMarkerAttr: "data-gwruntimedisabled",
  logEventType: "gw_log_event",
  shimGuardKey: "gw_shim_guard",
  temporalHandoffKey: "gw_temporal_handoff",
  workerPatchGuardKey: "gw_worker_patch",
  serviceWorkerPatchGuardKey: "gw_service_worker_patch",
  firefoxStaticStateCandidatesSymbolKey: "gw_firefox_static_state_candidates",
  surfaceUsageType: "gw_surface_usage",
  surfaceErrorType: "gw_surface_error",
  surfaceUsageRegisterType: "gw_surface_usage_register",
  sharedWorkerRewriteCandidateType: "gw:shared_worker_rewrite_candidate",
  sharedWorkerStrictIssueType: "gw:shared_worker_strict_issue",
  firefoxMainHandoffMarkerAttr: "gwfirefoxmainhandoff",
  firefoxMainHandoffReadyEvent: "gw_firefox_main_handoff_ready",
  strictSharedWorkerNamePrefix: "gwsharedworker",
  workerBootstrapAckType: "gw:worker_bootstrap_ack",
} as const;

const BUILD_IDS = shouldObfuscateIds
  ? ({
      firefoxStatePortId: nextDomAttrId("port-id"),
      firefoxStateChangeEvent: nextBuildId("state-change"),
      runtimeReadyEvent: nextBuildId("runtime-ready"),
      runtimeAppliedMarkerAttr: nextDomAttrId("runtime-applied"),
      runtimeConfigMarkerAttr: nextDomAttrId("runtime-config"),
      runtimeConfigPayloadAttr: `data-${nextDomAttrId("runtime-config-payload")}`,
      disabledMarkerAttr: `data-${nextDomAttrId("runtime-disabled")}`,
      logEventType: nextBuildId("log-event"),
      shimGuardKey: nextBuildId("shim-guard"),
      temporalHandoffKey: nextBuildId("temporal-handoff"),
      workerPatchGuardKey: nextBuildId("worker-patch-guard"),
      serviceWorkerPatchGuardKey: nextBuildId("service-worker-patch-guard"),
      firefoxStaticStateCandidatesSymbolKey: nextBuildId(
        "firefox-static-state-candidates-symbol",
      ),
      surfaceUsageType: nextBuildId("surface-usage"),
      surfaceErrorType: nextBuildId("surface-error"),
      surfaceUsageRegisterType: nextBuildId("surface-usage-register"),
      sharedWorkerRewriteCandidateType: nextBuildId("shared-worker-rewrite-candidate"),
      sharedWorkerStrictIssueType: nextBuildId("shared-worker-strict-issue"),
      firefoxMainHandoffMarkerAttr: nextDomAttrId("firefox-main-handoff"),
      firefoxMainHandoffReadyEvent: nextBuildId("firefox-main-handoff-ready"),
      strictSharedWorkerNamePrefix: nextBuildId("strict-shared-worker-name"),
      workerBootstrapAckType: nextBuildId("worker-bootstrap-ack"),
    } as const)
  : DEV_FRIENDLY_IDS;

const BUILD_ID_DEFINITIONS = {
  __PT_FIREFOX_STATE_PORT_ID__: BUILD_IDS.firefoxStatePortId,
  __PT_FX_STATE_CHANGE_EVENT__: BUILD_IDS.firefoxStateChangeEvent,
  __PT_RUNTIME_READY_EVENT_NAME__: BUILD_IDS.runtimeReadyEvent,
  __PT_RUNTIME_APPLIED_ATTR__: BUILD_IDS.runtimeAppliedMarkerAttr,
  __PT_RUNTIME_CONFIG_ATTR__: BUILD_IDS.runtimeConfigMarkerAttr,
  __PT_RUNTIME_PAYLOAD_ATTR__: BUILD_IDS.runtimeConfigPayloadAttr,
  __PT_RUNTIME_DISABLED_ATTR__: BUILD_IDS.disabledMarkerAttr,
  __PT_LOG_EVENT_TYPE__: BUILD_IDS.logEventType,
  __PT_SHIM_GUARD_KEY__: BUILD_IDS.shimGuardKey,
  __PT_TEMPORAL_HANDOFF_KEY__: BUILD_IDS.temporalHandoffKey,
  __PT_WORKER_PATCH_GUARD_KEY__: BUILD_IDS.workerPatchGuardKey,
  __PT_SW_PATCH_GUARD_KEY__: BUILD_IDS.serviceWorkerPatchGuardKey,
  __PT_FX_STATIC_CANDIDATES_KEY__: BUILD_IDS.firefoxStaticStateCandidatesSymbolKey,
  __PT_SURFACE_USAGE_TYPE__: BUILD_IDS.surfaceUsageType,
  __PT_SURFACE_ERROR_TYPE__: BUILD_IDS.surfaceErrorType,
  __PT_SURFACE_USAGE_REG_TYPE__: BUILD_IDS.surfaceUsageRegisterType,
  __PT_SW_REWRITE_TYPE__: BUILD_IDS.sharedWorkerRewriteCandidateType,
  __PT_SW_STRICT_ISSUE_TYPE__: BUILD_IDS.sharedWorkerStrictIssueType,
  __PT_FX_HANDOFF_ATTR__: BUILD_IDS.firefoxMainHandoffMarkerAttr,
  __PT_FX_HANDOFF_READY_EVENT__: BUILD_IDS.firefoxMainHandoffReadyEvent,
  __PT_STRICT_WORKER_PREFIX__: BUILD_IDS.strictSharedWorkerNamePrefix,
  __PT_WORKER_ACK_TYPE__: BUILD_IDS.workerBootstrapAckType,
} as const;

const BUILD_ID_INTERPOLATIONS = Object.entries(BUILD_ID_DEFINITIONS).map(
  ([defineName, value], index) => {
    const prefix = `Q${index.toString(36)}`;
    const placeholder = `${prefix}${"Z".repeat(value.length + 2 - prefix.length)}`;
    return {
      defineName,
      placeholder,
      replacement: JSON.stringify(value),
    };
  },
);

const BUILD_ID_DEFINES = Object.fromEntries(
  BUILD_ID_INTERPOLATIONS.map(({ defineName, placeholder }) => [
    defineName,
    placeholder,
  ]),
);
const BUILD_ID_VALUES = Object.values(BUILD_ID_DEFINITIONS);
const BUILD_ID_SEMANTIC_KEYS = Object.keys(BUILD_IDS);
const CLUSTERED_LITERALS =
  /(?:[A-Za-z_$][\w$]*=(?:"[^"\\]{4,40}"|`[^`\\]{4,40}`),){2,}/g;

// Log build identifiers to stdout for developer debugging.
if (!process.env.VITEST && process.env.PT_LOG_BUILD_IDS !== "false") {
  console.log(
    `[Privacy Thing] Build IDs (${shouldObfuscateIds ? "obfuscated" : "dev-friendly"}):`,
    JSON.stringify(BUILD_IDS, null, 2),
  );
}

function buildIdReplacePlugin(): Plugin {
  return {
    name: "privacy-thing-build-id-interpolation",
    enforce: "post",
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") continue;

        for (const { placeholder, replacement } of BUILD_ID_INTERPOLATIONS) {
          output.code = output.code.replaceAll(placeholder, replacement);
        }

        const unresolved = BUILD_ID_INTERPOLATIONS.find(({ placeholder }) =>
          output.code.includes(placeholder),
        );
        if (unresolved) {
          throw new Error(
            `Build identifier placeholder survived interpolation: ${unresolved.placeholder}`,
          );
        }

        for (const match of output.code.matchAll(CLUSTERED_LITERALS)) {
          const buildIdCount = BUILD_ID_VALUES.filter((value) =>
            match[0].includes(value),
          ).length;
          if (buildIdCount >= 2) {
            throw new Error(
              `Build identifiers were clustered in ${output.fileName}: ${match[0]}`,
            );
          }
        }

        const semanticKey = BUILD_ID_SEMANTIC_KEYS.find((key) =>
          output.code.includes(key),
        );
        if (semanticKey) {
          throw new Error(
            `Semantic build identifier key leaked into ${output.fileName}: ${semanticKey}`,
          );
        }
      }
    },
  };
}

const staticContentScriptFiles = {
  bootstrap: "content-bootstrap.js",
  mainEarly: "main-world-early.js",
  mainRuntime: "main-world-runtime.js",
} as const;

const extraEntryBuilds = {
  "firefox-main-runtime": {
    input: fileURLToPath(new URL("../src/injection/main/index.ts", import.meta.url)),
    output: {
      format: "iife",
      name: "PrivacyThingFirefoxMainWorld",
      entryFileNames: staticContentScriptFiles.mainRuntime,
    },
  },
  "firefox-main-early": {
    input: fileURLToPath(new URL("../src/injection/firefox/early.ts", import.meta.url)),
    output: {
      format: "iife",
      name: "PrivacyThingFirefoxGeoShim",
      entryFileNames: staticContentScriptFiles.mainEarly,
    },
  },
  "firefox-timing-spike": {
    input: fileURLToPath(
      new URL("../src/injection/firefox/timing-spike.ts", import.meta.url),
    ),
    output: {
      format: "iife",
      name: "PrivacyThingFirefoxTimingSpike",
      entryFileNames: "timing-spike.js",
    },
  },
  "chromium-content-bootstrap": {
    input: fileURLToPath(new URL("../src/content/bootstrap.ts", import.meta.url)),
    output: {
      format: "iife",
      name: "PrivacyThingContentBootstrap",
      entryFileNames: staticContentScriptFiles.bootstrap,
    },
  },
  "chromium-main-early": {
    input: fileURLToPath(new URL("../src/injection/main/early.ts", import.meta.url)),
    output: {
      format: "iife",
      name: "PrivacyThingMainWorldEarly",
      entryFileNames: staticContentScriptFiles.mainEarly,
    },
  },
  "chromium-main-runtime": {
    input: fileURLToPath(new URL("../src/injection/main/index.ts", import.meta.url)),
    output: {
      format: "iife",
      name: "PrivacyThingMainWorldRuntime",
      entryFileNames: staticContentScriptFiles.mainRuntime,
    },
  },
} as const;

/**
 * Custom plugin to generate manifest.json for Chromium/Firefox.
 */
function manifestPlugin(target: BuildTarget): Plugin {
  let config: ResolvedConfig;

  return {
    name: "privacything-manifest",
    apply: "build",
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    writeBundle() {
      // Manifest should only be written by the main build
      if (extraEntry) return;

      const manifest = structuredClone(baseManifest) as any;

      if (target === "chromium") {
        // Chromium paths
        manifest.background = {
          service_worker: "assets/background.js",
          type: "module",
        };
        manifest.content_scripts = [
          {
            matches: ["<all_urls>"],
            js: [staticContentScriptFiles.bootstrap],
            run_at: "document_start",
            all_frames: true,
            match_origin_as_fallback: true,
          },
          {
            matches: ["<all_urls>"],
            js: [staticContentScriptFiles.mainEarly],
            run_at: "document_start",
            world: "MAIN",
            all_frames: true,
            match_origin_as_fallback: true,
          },
          {
            matches: ["<all_urls>"],
            js: [staticContentScriptFiles.mainRuntime],
            run_at: "document_start",
            world: "MAIN",
            all_frames: true,
            match_origin_as_fallback: true,
          },
        ];

        // Anti-fingerprinting: use_dynamic_url: true
        manifest.web_accessible_resources = [
          {
            resources: ["assets/*"],
            matches: ["<all_urls>"],
            use_dynamic_url: true,
          },
        ];
      } else {
        // Firefox paths
        Reflect.deleteProperty(manifest, "minimum_chrome_version");
        manifest.permissions = manifest.permissions.filter(
          (p: string) => p !== "declarativeNetRequestWithHostAccess",
        );
        manifest.browser_specific_settings = {
          gecko: {
            id: resolveFirefoxExtensionId(buildChannel),
            ...(resolveFirefoxUpdateUrl(buildChannel)
              ? {
                  update_url: resolveFirefoxUpdateUrl(buildChannel),
                }
              : {}),
            data_collection_permissions: {
              required: ["locationInfo", "searchTerms"],
            },
          },
        };
        // Firefox doesn't support world: MAIN in MV3 content_scripts
        manifest.content_scripts = [
          {
            matches: ["<all_urls>"],
            js: [staticContentScriptFiles.bootstrap],
            run_at: "document_start",
            all_frames: true,
            match_about_blank: true,
          },
        ];
        manifest.background = {
          scripts: ["assets/background.js"],
          type: "module",
        };
        manifest.web_accessible_resources = [
          {
            resources: [
              staticContentScriptFiles.mainRuntime,
              staticContentScriptFiles.mainEarly,
              "timing-spike.js",
              "assets/*",
            ],
            matches: ["<all_urls>"],
            use_dynamic_url: true,
          },
        ];
      }

      const manifestPath = path.resolve(config.build.outDir, "manifest.json");
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

      // Emit _locales/<locale>/messages.json for the __MSG__ placeholders used
      // by the manifest (extName, extShortDescription). extName resolves to the
      // localized CWS title on Chromium and the channel brand name on Firefox;
      // extShortDescription is per-locale and per-target (Chrome <=132 chars,
      // Firefox <=250). default_locale ("en") must have a messages.json, which
      // MANIFEST_LOCALE_CODES guarantees.
      if (!MANIFEST_LOCALE_CODES.includes(MANIFEST_DEFAULT_LOCALE)) {
        throw new Error(
          `default_locale "${MANIFEST_DEFAULT_LOCALE}" has no _locales entry; ` +
            "extensions with __MSG__ placeholders fail to load without it.",
        );
      }
      const manifestDescCtx =
        target === "firefox"
          ? "Localized manifest description for Firefox (max 250 characters)."
          : "Localized manifest description for Chromium (max 132 characters).";
      for (const locale of MANIFEST_LOCALE_CODES) {
        const messages = {
          extName: {
            message: resolveManifestExtName(locale, target, buildChannel),
            description: "Public extension name.",
          },
          extShortDescription: {
            message: resolveManifestShortDescription(locale, target),
            description: manifestDescCtx,
          },
        };
        const localeDir = path.resolve(config.build.outDir, "_locales", locale);
        mkdirSync(localeDir, { recursive: true });
        writeFileSync(
          path.resolve(localeDir, "messages.json"),
          JSON.stringify(messages, null, 2),
        );
      }

      // API conformance needs only the applied marker. Keep that narrow handoff
      // separate from the complete developer-only identifier dictionary.
      const buildRoot = path.resolve(config.build.outDir, "..");
      mkdirSync(buildRoot, { recursive: true });
      writeFileSync(
        path.resolve(buildRoot, `runtime-applied-marker.${target}.txt`),
        `${BUILD_IDS.runtimeAppliedMarkerAttr}\n`,
      );

      const idManifestPath = path.resolve(buildRoot, `.id-manifest.${target}.json`);
      if (process.env.CI) {
        rmSync(idManifestPath, { force: true });
      } else {
        const idManifestContent = JSON.stringify(BUILD_IDS, null, 2) + "\n";
        writeFileSync(idManifestPath, idManifestContent);
      }
    },
  };
}

export default defineConfig({
  root: repositoryRootDirectory,
  plugins:
    extraEntry in extraEntryBuilds
      ? [buildIdReplacePlugin()]
      : [react(), buildIdReplacePlugin(), manifestPlugin(buildTarget)],
  css: {
    postcss: configDirectory,
  },
  resolve: {
    alias: [
      ...(buildTarget === "chromium"
        ? [
            {
              find: "@privacy-brand/refract-browser/firefox",
              replacement: path.resolve(
                repositoryRootDirectory,
                "packages/refract-browser/src/firefox/stub.ts",
              ),
            },
            {
              find: "@/content/firefox-heartbeat-forwarder",
              replacement: path.resolve(
                repositoryRootDirectory,
                "src/stubs/firefox-heartbeat-forwarder.ts",
              ),
            },
            {
              find: "@/content/bootstrap-resolver",
              replacement: path.resolve(
                repositoryRootDirectory,
                "src/stubs/bootstrap-resolver.chromium.ts",
              ),
            },
            {
              find: "@/content/bootstrap-target",
              replacement: path.resolve(
                repositoryRootDirectory,
                "src/content/bootstrap-target.chromium.ts",
              ),
            },
            {
              find: "@/injection/shared/firefox-shim-state",
              replacement: path.resolve(
                repositoryRootDirectory,
                "src/stubs/firefox-shim-state.ts",
              ),
            },
            {
              find: "@privacy-brand/refract-browser/common/firefox-shim-state",
              replacement: path.resolve(
                repositoryRootDirectory,
                "src/stubs/firefox-shim-state.ts",
              ),
            },
            {
              find: "@/shared/firefox-page-world-buffer",
              replacement: path.resolve(
                repositoryRootDirectory,
                "src/stubs/firefox-page-world-buffer.ts",
              ),
            },
          ]
        : [
            {
              find: "@/content/bootstrap-target",
              replacement: path.resolve(
                repositoryRootDirectory,
                "src/content/bootstrap-target.firefox.ts",
              ),
            },
            {
              find: "@privacy-brand/refract-browser/chromium",
              replacement: path.resolve(
                repositoryRootDirectory,
                "packages/refract-browser/src/chromium/stub.ts",
              ),
            },
          ]),
      ...uiAliasEntries,
    ],
  },
  define: {
    __PT_BROWSER_TARGET__: JSON.stringify(buildTarget),
    __PT_BUILD_CHANNEL__: JSON.stringify(buildChannel),
    __PT_FX_RUNTIME_TEST_HOST__: JSON.stringify(
      process.env.PT_FIREFOX_RUNTIME_TEST_HOST ?? "",
    ),
    __PT_CONFORMANCE_LOCATION_ID__: JSON.stringify(
      process.env.PT_API_CONFORMANCE_LOCATION_ID ?? "",
    ),
    ...BUILD_ID_DEFINES,
  },
  build: {
    outDir,
    // Timing-sensitive injected bundles benefit from Oxc's smaller output;
    // keep the broader UI/background build on the established minifier.
    minify: extraEntry ? "oxc" : "esbuild",
    emptyOutDir: process.env.PT_EMPTY_OUT_DIR !== "false",
    sourcemap: shouldEmitBuildSourceMaps(buildChannel),
    copyPublicDir: !(extraEntry && extraEntry in extraEntryBuilds),
    // Options/popup UI bundles intentionally ship MapLibre and extension-only
    // assets, so Vite's default 500 kB warning is too noisy for this project.
    chunkSizeWarningLimit: 1100,
    ...(extraEntry && extraEntry in extraEntryBuilds
      ? {
          rollupOptions: {
            input: extraEntryBuilds[extraEntry as keyof typeof extraEntryBuilds].input,
            output:
              extraEntryBuilds[extraEntry as keyof typeof extraEntryBuilds].output,
          },
        }
      : {
          rollupOptions: {
            input: {
              options: "src/ui/options/index.html",
              popup: "src/ui/popup/index.html",
              sidebar: "src/ui/sidebar/index.html",
              // Background is now a direct entry
              background: "src/background/index.ts",
            },
            output: {
              entryFileNames: (chunk) => {
                if (chunk.name === "background") {
                  return "assets/background.js";
                }
                return "assets/[name]-[hash].js";
              },
              chunkFileNames: "assets/[name]-[hash].js",
              assetFileNames: "assets/[name]-[hash].[ext]",
            },
          },
        }),
  },
});
