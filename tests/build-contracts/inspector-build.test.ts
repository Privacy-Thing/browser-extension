import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, vi } from "vitest";

import { createWorkerSource } from "../../packages/refract-browser/src/common/worker-bootstrap";

for (const target of ["chrome", "firefox"]) {
  for (const file of ["main-world-early.js", "main-world-runtime.js"]) {
    test(`${target}/${file} retains a neutral pause source outside the ignore list`, async () => {
      const code = await readFile(path.resolve("build", target, file), "utf8");
      expect(code).toMatch(/\bdebugger\b/);
      const match = /sourceMappingURL=data:application\/json;base64,([^\s]+)/.exec(
        code,
      );
      expect(match).not.toBeNull();
      const text = Buffer.from(match![1]!, "base64").toString();
      const map = JSON.parse(text);
      expect(map.sources).toEqual(["0", "1"]);
      expect(map.ignoreList).toEqual([0]);
      expect(map.ignoreList).not.toContain(1);
      expect(map.sourcesContent).toBeUndefined();
      expect(map.names).toEqual([]);
      expect(text).not.toMatch(
        /privacy[ -]?thing|refract|analyst|inspector|\.ts|\/home\//i,
      );
    });
  }
}

test("decoded worker Blob runtime retains pauses without source metadata", () => {
  for (const key of [
    "__PT_LOG_EVENT_TYPE__",
    "__PT_SHIM_GUARD_KEY__",
    "__PT_WORKER_ACK_TYPE__",
  ])
    vi.stubGlobal(key, "neutral");
  const source = createWorkerSource({
    snapshot: {
      geo: { latitude: 0, longitude: 0, accuracy: 10, noiseRadius: 50 },
      locale: {
        language: "en",
        languages: ["en"],
        acceptLanguage: "en",
        timeZone: "UTC",
      },
      date: { baseEpochMs: 0, offsetMs: 0, timeZone: "UTC" },
      debugMode: false,
      watchPositionDelay: [60, 500],
    },
    workerUrl: "https://probe.example/worker.js",
    workerType: "classic",
  });
  vi.unstubAllGlobals();
  expect(source).toMatch(/\bdebugger\b/);
  expect(source).not.toMatch(/createAnalystTrapState|sourceMappingURL|sourcesContent/);
});
