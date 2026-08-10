import { resolve } from "node:path";

import { SourceLocator } from "./source-locator.js";

export class SourceScanner {
  static scan(srcDir: string) {
    const locator = new SourceLocator();
    locator.buildIndex(srcDir, resolve(srcDir, "..", ".."));

    const indexedPropertyCount = locator.getIndexedPropertyCount();
    const discoveredSurfaceCount = locator.getDiscoveredSurfaces().size;

    return {
      indexedPropertyCount,
      discoveredSurfaceCount,
      totalEstimated: indexedPropertyCount,
    };
  }
}
