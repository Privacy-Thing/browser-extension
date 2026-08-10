import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Lazy-loaded BCD data (~65MB). Only loaded on first call to avoid import-time
// cost when BCD lookups are not needed (e.g. --scan-only, cache hits).
let bcdData: any;
function getBcd(): any {
  if (!bcdData) {
    bcdData = require("@mdn/browser-compat-data");
  }
  return bcdData;
}

export function mapToBcdKey(apiPath: string): string | null {
  // Normalize paths
  const cleanPath = apiPath
    .replace(/\.prototype\./g, ".")
    .replace(/^(globalThis|window|self)\./, "")
    .replace(/^navigator\./, "Navigator.")
    .replace(/^document\./, "Document.");

  const parts = cleanPath.split(".");

  const candidates = [`api.${cleanPath}`, `javascript.builtins.${cleanPath}`];

  // If it's something like globalThis.Date -> Date.Date in BCD
  // We want to check the specific constructor path first before the generic object
  if (parts.length === 1) {
    candidates.unshift(`javascript.builtins.${cleanPath}.${cleanPath}`);
    candidates.unshift(`api.${cleanPath}.${cleanPath}`);
  }

  for (const candidate of candidates) {
    if (resolveBcdPath(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolveBcdPath(path: string): any {
  const parts = path.split(".");
  let current: any = getBcd();
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }
  return current;
}
