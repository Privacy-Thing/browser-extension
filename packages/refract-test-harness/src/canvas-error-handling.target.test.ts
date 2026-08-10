import {
  CANVAS_ERROR_SOURCE,
  isCanvasReadbackError,
} from "@privacy-brand/refract-core";
import { describe, expect, it } from "vitest";

describe("canvas-error-handling", () => {
  it("treats known canvas readback DOMException names as recoverable", () => {
    expect(isCanvasReadbackError({ name: "SecurityError", message: "" })).toBe(true);
    expect(
      isCanvasReadbackError({
        name: "InvalidStateError",
        message: "",
      }),
    ).toBe(true);
  });

  it("treats taint-related messages as recoverable", () => {
    expect(
      isCanvasReadbackError({
        name: "Error",
        message: "Canvas is not origin-clean and readback is blocked",
      }),
    ).toBe(true);
  });

  it("rejects unrelated failures and non-objects", () => {
    expect(isCanvasReadbackError(new Error("boom"))).toBe(false);
    expect(isCanvasReadbackError("tainted")).toBe(false);
  });

  it("builds worker inline source from the shared helper", () => {
    expect(CANVAS_ERROR_SOURCE).toContain("const isCanvasReadbackError = (error) => {");
    expect(CANVAS_ERROR_SOURCE).toContain('message.includes("origin-clean")');
  });
});
