import { createRequire } from "node:module";

import { CacheManager } from "../cache/cache-manager.js";

import { mapToBcdKey } from "./bcd-mapper.js";

const require = createRequire(import.meta.url);

export interface BcdSupport {
  version_added: string | boolean;
  version_removed?: string | boolean;
  flags?: any[];
  partial_implementation?: boolean;
}

export interface BcdResult {
  key: string | null;
  support: Record<string, BcdSupport>;
}

export class BcdFetcher {
  private static bcdData: any;

  private static loadBcd() {
    if (!this.bcdData) {
      this.bcdData = require("@mdn/browser-compat-data");
    }
    return this.bcdData;
  }

  static getSupport(apiPath: string): BcdResult {
    const cached = CacheManager.get<BcdResult>(`bcd-${apiPath}`);
    if (cached) return cached;

    this.loadBcd();
    const key = mapToBcdKey(apiPath);

    if (!key) {
      const result = { key: null, support: {} };
      CacheManager.set(`bcd-${apiPath}`, result);
      return result;
    }

    const parts = key.split(".");
    let current: any = this.bcdData;
    for (const part of parts) {
      if (!current || typeof current !== "object") {
        const result: BcdResult = { key: null, support: {} };
        CacheManager.set(`bcd-${apiPath}`, result);
        return result;
      }
      if (!(part in current)) {
        const result: BcdResult = { key: null, support: {} };
        CacheManager.set(`bcd-${apiPath}`, result);
        return result;
      }
      current = current[part];
    }

    const supportInfo = current?.__compat?.support || {};
    const result: BcdResult = {
      key,
      support: {},
    };

    const targetBrowsers = ["chrome", "firefox", "safari", "edge"];
    for (const browser of targetBrowsers) {
      if (supportInfo[browser]) {
        let browserSupport = supportInfo[browser];
        if (Array.isArray(browserSupport)) {
          // Use the primary entry (usually first non-flagged or most recent)
          browserSupport = browserSupport[0];
        }
        result.support[browser] = {
          version_added: browserSupport.version_added,
          version_removed: browserSupport.version_removed,
          flags: browserSupport.flags,
          partial_implementation: browserSupport.partial_implementation,
        };
      }
    }

    CacheManager.set(`bcd-${apiPath}`, result);
    return result;
  }
}
