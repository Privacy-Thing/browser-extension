import { defineConfig } from "vitest/config";

import { repositoryRootDirectory } from "./path-aliases";

export default defineConfig({
  root: repositoryRootDirectory,
  test: {
    environment: "node",
    include: ["tests/build-contracts/**/*.test.ts"],
  },
});
