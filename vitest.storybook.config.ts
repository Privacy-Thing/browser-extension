import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

import { uiAliasEntries } from "./config/path-aliases";
import { sharedDefine } from "./config/vitest.config.base";

const configDirectory = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: uiAliasEntries,
  },
  define: {
    __PT_BROWSER_TARGET__: JSON.stringify("chromium"),
    ...sharedDefine,
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  plugins: [storybookTest({ configDir: resolve(configDirectory, ".storybook") })],
  test: {
    name: "storybook",
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
});
