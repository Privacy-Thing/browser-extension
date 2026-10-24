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
 * Minimal positional map: runtime ranges are ignored, debugger statements are
 * not. No source text, module paths, symbols, or product identifiers are shipped.
 * Full development maps would expose implementation names in page-owned Blobs.
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
    sources: ["0", "1"],
    names: [],
    mappings,
    ignoreList: [0],
  };
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
