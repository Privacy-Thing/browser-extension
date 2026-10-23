import type { AnalystTraps } from "@privacy-brand/xray-protocol";

/** Bootstrap shape check; catalog validation belongs to the background. */
export const isAnalystTraps = (value: unknown): value is AnalystTraps => {
  if (!value || typeof value !== "object") return false;
  const { methods, mode } = value as { methods?: unknown; mode?: unknown };
  return (
    (mode === "first-call" || mode === "every-call") &&
    Array.isArray(methods) &&
    methods.length > 0 &&
    methods.length <= 128 &&
    methods.every((method) => typeof method === "string")
  );
};
