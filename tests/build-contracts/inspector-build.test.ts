import { readFile } from "node:fs/promises";
import path from "node:path";

import ts from "typescript";
import { expect, test, vi } from "vitest";

import {
  ignoredPositions,
  RUNTIME_DEBUG_CONTENT,
  RUNTIME_DEBUG_SOURCES,
} from "../../config/runtime-debug-map";
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
      expect(map.sources).toEqual(RUNTIME_DEBUG_SOURCES);
      expect(map.ignoreList).toEqual([0]);
      expect(map.ignoreList).not.toContain(1);
      // DevTools opens the paused frame's source; without inline content it
      // fetches the extension URL and shows ERR_BLOCKED_BY_CLIENT.
      expect(map.sourcesContent).toEqual(RUNTIME_DEBUG_CONTENT);
      expect(map.sourcesContent[1]).toMatch(/^debugger;/);
      expect(map.names).toEqual([]);
      expect(text).not.toMatch(
        /privacy[ -]?thing|refract|analyst|inspector|\.ts|\/home\//i,
      );
    });

    test(`${target}/${file} leaves only pause functions outside the ignore list`, async () => {
      const code = (
        await readFile(path.resolve("build", target, file), "utf8")
      ).replace(
        /\n\/\/# sourceMappingURL=data:application\/json;base64,([^\s]+)\n?$/,
        "",
      );
      const encoded = RegExp.$1;
      const map = JSON.parse(Buffer.from(encoded, "base64").toString());
      const lineStarts = [0];
      for (const [index, char] of [...code].entries())
        if (char === "\n") lineStarts.push(index + 1);
      const offsets = ignoredPositions(map).map(
        ({ lineNumber, columnNumber }) => lineStarts[lineNumber]! + columnNumber,
      );
      // Ignored from offset 0, so odd boundaries open the visible gaps.
      expect(offsets[0]).toBe(0);
      const visible = [];
      for (let index = 1; index < offsets.length; index += 2)
        visible.push(code.slice(offsets[index], offsets[index + 1] ?? code.length));
      // Any other visible function would be a DevTools frame left inside the
      // extension instead of the calling page frame.
      expect(visible.length).toBeGreaterThan(0);
      for (const range of visible) {
        const [statement] = ts.createSourceFile(
          "pause.js",
          `(${range})`,
          ts.ScriptTarget.Latest,
        ).statements;
        const fn =
          statement && ts.isExpressionStatement(statement)
            ? (statement.expression as ts.ParenthesizedExpression).expression
            : undefined;
        expect(fn && ts.isFunctionLike(fn)).toBe(true);
        const body = (fn as ts.ArrowFunction).body;
        expect(ts.isBlock(body) && body.statements.map((node) => node.kind)).toEqual([
          ts.SyntaxKind.DebuggerStatement,
        ]);
      }
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
