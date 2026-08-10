export const isCanvasReadbackError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const name = "name" in error && typeof error.name === "string" ? error.name : "";
  if (
    name === "SecurityError" ||
    name === "InvalidStateError" ||
    name === "IndexSizeError" ||
    name === "NotSupportedError"
  ) {
    return true;
  }

  const message =
    "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";

  return (
    message.includes("tainted") ||
    message.includes("origin-clean") ||
    message.includes("cross-origin") ||
    message.includes("readback")
  );
};

export const CANVAS_ERROR_SOURCE = [
  "    const isCanvasReadbackError = (error) => {",
  '      if (typeof error !== "object" || error === null) {',
  "        return false;",
  "      }",
  '      const name = "name" in error && typeof error.name === "string" ? error.name : "";',
  "      if (",
  '        name === "SecurityError" ||',
  '        name === "InvalidStateError" ||',
  '        name === "IndexSizeError" ||',
  '        name === "NotSupportedError"',
  "      ) {",
  "        return true;",
  "      }",
  '      const message = "message" in error && typeof error.message === "string"',
  "        ? error.message.toLowerCase()",
  '        : "";',
  "      return (",
  '        message.includes("tainted") ||',
  '        message.includes("origin-clean") ||',
  '        message.includes("cross-origin") ||',
  '        message.includes("readback")',
  "      );",
  "    };",
].join("\n");
