import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { resolveRepoPath } from "../repo-paths.js";

/**
 * Bump this version whenever cache-breaking changes are made to snapshot
 * capture, differ logic, or BCD processing. Stale cache entries with an
 * older version are silently discarded on read.
 */
const CACHE_VERSION = 2;

interface CacheEnvelope<T> {
  _v: number;
  data: T;
}

export class CacheManager {
  private static CACHE_DIR = "";

  static init(cacheDir: string) {
    this.CACHE_DIR = resolveRepoPath(cacheDir);
    if (!existsSync(this.CACHE_DIR)) {
      mkdirSync(this.CACHE_DIR, { recursive: true });
    }
  }

  static get<T>(key: string): T | null {
    if (!this.CACHE_DIR) return null;
    const filePath = join(this.CACHE_DIR, `${key}.json`);
    if (existsSync(filePath)) {
      try {
        const raw = JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
        // Reject entries missing the version envelope or from a stale version.
        if (
          raw != null &&
          typeof raw === "object" &&
          "_v" in raw &&
          (raw as CacheEnvelope<T>)._v === CACHE_VERSION &&
          "data" in raw
        ) {
          return (raw as CacheEnvelope<T>).data;
        }
        // Stale or unversioned — delete the file to avoid re-parsing on
        // future reads and accumulating dead entries across version bumps.
        try {
          unlinkSync(filePath);
        } catch {
          /* best-effort cleanup */
        }
        return null;
      } catch {
        return null;
      }
    }
    return null;
  }

  static set<T>(key: string, data: T): void {
    if (!this.CACHE_DIR) return;
    const filePath = join(this.CACHE_DIR, `${key}.json`);
    const envelope: CacheEnvelope<T> = { _v: CACHE_VERSION, data };
    writeFileSync(filePath, JSON.stringify(envelope, null, 2), "utf-8");
  }

  static clear(): void {
    if (!this.CACHE_DIR || !existsSync(this.CACHE_DIR)) return;
    for (const file of readdirSync(this.CACHE_DIR)) {
      if (file.endsWith(".json")) {
        unlinkSync(join(this.CACHE_DIR, file));
      }
    }
  }
}
