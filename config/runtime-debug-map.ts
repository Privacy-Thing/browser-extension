import ts from "typescript";
import type { Plugin } from "vite";

const digits = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const vlq = (value: number): string => {
  let number = value < 0 ? -value * 2 + 1 : value * 2;
  let result = "";
  do {
    const digit = number & 31;
    number >>>= 5;
    result += digits[digit | (number > 0 ? 32 : 0)];
  } while (number > 0);
  return result;
};
const unvlq = (segment: string): number[] => {
  const values: number[] = [];
  let value = 0;
  let shift = 0;
  for (const char of segment) {
    const digit = digits.indexOf(char);
    value += (digit & 31) * 2 ** shift;
    if (digit & 32) shift += 5;
    else {
      values.push(value % 2 ? -(value - 1) / 2 : value / 2);
      value = 0;
      shift = 0;
    }
  }
  return values;
};

const pauseRanges = (code: string): { start: number; end: number }[] => {
  const file = ts.createSourceFile(
    "0.js",
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const ranges: { start: number; end: number }[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isDebuggerStatement(node)) {
      let owner = node.parent;
      while (owner && !ts.isFunctionLike(owner)) owner = owner.parent;
      ranges.push({ start: (owner ?? node).getStart(file), end: (owner ?? node).end });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return ranges;
};

/**
 * Chromium skips a debugger statement whose whole function is ignore-listed, and
 * DevTools always opens the top paused frame. The pause function therefore stays
 * visible as a named source whose inline content points to the calling frame;
 * without content DevTools fetches the URL and reports ERR_BLOCKED_BY_CLIENT.
 */
export const RUNTIME_DEBUG_SOURCES = ["runtime.js", "script-stop.js"];
export const RUNTIME_DEBUG_CONTENT = [
  "// Ignore-listed extension code.\n",
  "debugger; // Stopped before a page script read a selected value. Select the next Call Stack frame to see the calling line.\n",
];

/**
 * Minimal positional map: runtime ranges are ignored, debugger statements are
 * not. No module paths, symbols, or product identifiers are shipped; the only
 * content is the fixed text above. Full development maps would expose
 * implementation names in page-owned Blobs.
 */
export const runtimeDebugMap = (code: string) => {
  const ranges = pauseRanges(code);
  let source = 0;
  let offset = 0;
  const mappings = code
    .split("\n")
    .map((line) => {
      let column = 0;
      const segment = (nextColumn: number, nextSource: number) => {
        const encoded = `${vlq(nextColumn - column)}${vlq(nextSource - source)}AA`;
        column = nextColumn;
        source = nextSource;
        return encoded;
      };
      const segments = [
        segment(
          0,
          ranges.some((range) => range.start <= offset && range.end > offset) ? 1 : 0,
        ),
      ];
      for (const range of ranges) {
        if (range.start > offset && range.start <= offset + line.length)
          segments.push(segment(range.start - offset, 1));
        if (range.end > offset && range.end <= offset + line.length)
          segments.push(segment(range.end - offset, 0));
      }
      offset += line.length + 1;
      return segments.join(",");
    })
    .join(";");
  return {
    version: 3,
    sources: RUNTIME_DEBUG_SOURCES,
    sourcesContent: RUNTIME_DEBUG_CONTENT,
    names: [],
    mappings,
    ignoreList: [0],
  };
};

/**
 * Generated positions where the ignore-list state flips, as DevTools sends them
 * to `Debugger.setBlackboxedRanges`: `[start, end)` pairs, the last one open.
 */
export const ignoredPositions = (map: { mappings: string; ignoreList: number[] }) => {
  const positions: { lineNumber: number; columnNumber: number }[] = [];
  let source = 0;
  let ignored = false;
  for (const [lineNumber, line] of map.mappings.split(";").entries()) {
    let columnNumber = 0;
    for (const segment of line.split(",")) {
      if (!segment) continue;
      const [column = 0, sourceDelta = 0] = unvlq(segment);
      columnNumber += column;
      source += sourceDelta;
      if (map.ignoreList.includes(source) === ignored) continue;
      ignored = !ignored;
      positions.push({ lineNumber, columnNumber });
    }
  }
  return positions;
};

export const inlineRuntimeMap = (code: string): string => {
  const map = Buffer.from(JSON.stringify(runtimeDebugMap(code))).toString("base64");
  return `${code}\n//# sourceMappingURL=data:application/json;base64,${map}\n`;
};

export const runtimeDebugMapPlugin = (): Plugin => ({
  name: "runtime-debug-map",
  enforce: "post",
  generateBundle(_options, bundle) {
    for (const output of Object.values(bundle)) {
      if (
        output.type !== "chunk" ||
        !/^main-world-(early|runtime)\.js$/.test(output.fileName)
      )
        continue;
      if (pauseRanges(output.code).length === 0)
        throw new Error("Runtime pause statement was removed by minification.");
      output.code = inlineRuntimeMap(output.code);
    }
  },
});
