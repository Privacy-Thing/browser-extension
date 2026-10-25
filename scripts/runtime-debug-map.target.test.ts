import { describe, expect, it } from "vitest";

import {
  ignoredPositions,
  RUNTIME_DEBUG_CONTENT,
  runtimeDebugMap,
  runtimeDebugMapPlugin,
} from "../config/runtime-debug-map";

const decode = (segment: string): number[] => {
  const digits = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const values: number[] = [];
  let value = 0;
  let shift = 0;
  for (const char of segment) {
    const digit = digits.indexOf(char);
    value |= (digit & 31) << shift;
    if (digit & 32) shift += 5;
    else {
      values.push((value & 1 ? -1 : 1) * (value >> 1));
      value = 0;
      shift = 0;
    }
  }
  return values;
};

const sourceAt = (mappings: string, line: number, column: number): number => {
  let source = 0;
  let found = -1;
  for (const [index, encoded] of mappings.split(";").entries()) {
    let generatedColumn = 0;
    for (const segment of encoded.split(",")) {
      const values = decode(segment);
      generatedColumn += values[0] ?? 0;
      source += values[1] ?? 0;
      if (index === line && generatedColumn <= column) found = source;
    }
    if (index === line) break;
  }
  return found;
};

describe("runtime debug map", () => {
  it("excludes the entire pause function from ignored ranges, including its entry", () => {
    const code =
      'const label = "debugger;";\nconst ignored = () => 1;\nconst trap = () => { debugger; }; trap();';
    const map = runtimeDebugMap(code);
    expect(map.ignoreList).toEqual([0]);
    expect(sourceAt(map.mappings, 0, 0)).toBe(0);
    expect(sourceAt(map.mappings, 1, 8)).toBe(0);
    expect(sourceAt(map.mappings, 2, 13)).toBe(1);
    expect(sourceAt(map.mappings, 2, 20)).toBe(1);
    expect(sourceAt(map.mappings, 2, 35)).toBe(0);
    expect(map.sourcesContent).toEqual(RUNTIME_DEBUG_CONTENT);
    expect(JSON.stringify(map)).not.toMatch(/label|ignored =|trap/);
  });
  it("reports the ignored ranges DevTools derives from the map", () => {
    const code = "const a = 1;\nconst trap = () => { debugger; }; trap();";
    expect(ignoredPositions(runtimeDebugMap(code))).toEqual([
      { lineNumber: 0, columnNumber: 0 },
      { lineNumber: 1, columnNumber: 13 },
      { lineNumber: 1, columnNumber: 32 },
    ]);
  });
  it("rejects a minified runtime with only a debugger string and no pause statement", () => {
    const plugin = runtimeDebugMapPlugin();
    const hook = plugin.generateBundle;
    if (typeof hook !== "function") throw new Error("Missing bundle hook");
    expect(() =>
      Reflect.apply(hook, {}, [
        {},
        {
          runtime: {
            type: "chunk",
            fileName: "main-world-runtime.js",
            code: 'console.log("debugger;")',
          },
        },
        false,
      ]),
    ).toThrow("removed by minification");
  });
});
