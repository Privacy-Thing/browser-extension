import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

import { configDirectory, uiAliasEntries } from "../config/path-aliases.ts";

const config: StorybookConfig = {
  stories: [
    "./*.mdx",
    "../src/ui/**/*.stories.@(ts|tsx)",
    "../packages/ui/src/**/*.stories.@(ts|tsx)",
  ],
  framework: "@storybook/react-vite",
  addons: [
    "@storybook/addon-themes",
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-vitest",
  ],
  viteFinal(config) {
    // Strip CRXJS plugin — Storybook is not a browser extension build.
    // CRXJS registers multiple sub-plugins whose names start with "crx:".
    config.plugins = config.plugins?.filter((plugin) => {
      if (!plugin) return false;
      const p = Array.isArray(plugin) ? plugin[0] : plugin;
      if (typeof p === "object" && p !== null && "name" in p) {
        const name = (p as { name: string }).name;
        if (name === "crx" || name.startsWith("crx:")) return false;
      }
      return true;
    });

    return mergeConfig(config, {
      css: {
        postcss: configDirectory,
      },
      resolve: {
        alias: uiAliasEntries,
      },
    });
  },
};

export default config;
