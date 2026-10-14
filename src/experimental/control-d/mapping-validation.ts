import type { ControlDMapping } from "./contracts";

export const isMapping = (value: unknown): value is ControlDMapping => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ControlDMapping>;
  return (
    typeof candidate.locationId === "string" &&
    (typeof candidate.proxyPk === "string" || candidate.proxyPk === null) &&
    ["exact", "approximate", "skipped"].includes(candidate.status ?? "") &&
    typeof candidate.confirmed === "boolean"
  );
};
