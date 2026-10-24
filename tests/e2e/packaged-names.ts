import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Identifier-shaped string literals of the injected bundles. A page can recover
 * them from the published package, so it can dispatch any of them as an event.
 */
export const readPackagedNames = (extensionDir: string): string[] => {
  const names = new Set<string>();
  for (const file of [
    "content-bootstrap.js",
    "main-world-early.js",
    "main-world-runtime.js",
  ]) {
    const source = readFileSync(path.join(extensionDir, file), "utf8");
    for (const [, name] of source.matchAll(/["'`]([A-Za-z_$][\w$]{3,15})["'`]/g))
      names.add(name!);
  }
  return [...names].sort();
};

/**
 * Page code: dispatches every name on `document` and returns the ones whose
 * page listener never ran. A listener that stops propagation reveals itself.
 */
export const probeHiddenEvents = (names: string[]): string[] =>
  names.filter((type) => {
    let seen = false;
    const listener = (): void => {
      seen = true;
    };
    document.addEventListener(type, listener);
    document.dispatchEvent(
      new MouseEvent(type, { relatedTarget: document.createElement("div") }),
    );
    document.removeEventListener(type, listener);
    return !seen;
  });
