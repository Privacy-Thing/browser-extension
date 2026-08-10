import packageJson from "../package.json";

// Brand name and short description are no longer inlined here: they are emitted
// per-locale into _locales/<locale>/messages.json by manifestPlugin (see
// config/vite.config.ts) and referenced below as __MSG_extName__ /
// __MSG_extShortDescription__.
const manifestVersion = process.env.PT_MANIFEST_VERSION ?? packageJson.version;
const displayVersion = process.env.PT_DISPLAY_VERSION ?? "";

export const createManifest = ({
  browserTarget = process.env.PT_BROWSER_TARGET,
  version = manifestVersion,
  versionName = displayVersion,
}: {
  browserTarget?: string | undefined;
  version?: string | undefined;
  versionName?: string | undefined;
} = {}) => {
  const firefoxTarget = browserTarget === "firefox";

  return {
    manifest_version: 3,
    // Localized via generated _locales/<locale>/messages.json (see manifestPlugin
    // in config/vite.config.ts). extName is the localized store title on
    // Chromium and the channel-resolved brand name on Firefox;
    // extShortDescription is the per-locale, per-target short description.
    default_locale: "en",
    name: "__MSG_extName__",
    version,
    ...(versionName && versionName !== version
      ? {
          version_name: versionName,
        }
      : {}),
    description: "__MSG_extShortDescription__",
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'self'; img-src 'self' data: blob: https://tile.openstreetmap.org",
    },
    icons: {
      16: "icons/icon-16.png",
      32: "icons/icon-32.png",
      48: "icons/icon-48.png",
      128: "icons/icon-128.png",
    },
    minimum_chrome_version: "120",
    permissions: [
      "storage",
      "scripting",
      "webNavigation",
      "cookies",
      "browsingData",
      "declarativeNetRequest",
      "declarativeNetRequestWithHostAccess",
      "privacy",
      "contextMenus",
      ...(firefoxTarget
        ? [
            "contextualIdentities",
            "webRequest",
            "webRequestBlocking",
            "webRequestFilterResponse",
          ]
        : ["sidePanel"]),
    ],
    ...(firefoxTarget
      ? {
          optional_permissions: ["userScripts"],
        }
      : {}),
    host_permissions: ["<all_urls>"],
    background: {
      service_worker: "src/background/index.ts",
      type: "module",
    },
    content_scripts: [
      {
        matches: ["<all_urls>"],
        js: ["src/content/bootstrap.ts"],
        run_at: "document_start",
        all_frames: true,
      },
      {
        matches: ["<all_urls>"],
        js: ["src/injection/main/early.ts"],
        run_at: "document_start",
        world: "MAIN",
        all_frames: true,
        match_origin_as_fallback: true,
      },
      {
        matches: ["<all_urls>"],
        js: ["src/injection/main/index.ts"],
        run_at: "document_start",
        world: "MAIN",
        all_frames: true,
        match_origin_as_fallback: true,
      },
    ],
    options_ui: {
      page: "src/ui/options/index.html",
      open_in_tab: true,
    },
    action: {
      default_title: "__MSG_extName__",
      default_popup: "src/ui/popup/index.html",
      default_icon: {
        16: "icons/icon-16.png",
        32: "icons/icon-32.png",
        48: "icons/icon-48.png",
        128: "icons/icon-128.png",
      },
      ...(firefoxTarget
        ? {
            theme_icons: [16, 32, 48, 128].map((size) => ({
              light: `icons/icon-theme-light-${size}.png`,
              dark: `icons/icon-theme-dark-${size}.png`,
              size,
            })),
          }
        : {}),
    },
    ...(firefoxTarget
      ? {
          sidebar_action: {
            default_panel: "src/ui/sidebar/index.html",
            default_title: "__MSG_extName__",
            default_icon: {
              16: "icons/icon-16.png",
              32: "icons/icon-32.png",
              48: "icons/icon-48.png",
              128: "icons/icon-128.png",
            },
          },
        }
      : {
          side_panel: {
            default_path: "src/ui/sidebar/index.html",
          },
        }),
    web_accessible_resources: [],
  } as const;
};

const manifest = createManifest();

export default manifest;
