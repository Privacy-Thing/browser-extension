const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const isConflict = (value: Record<string, unknown> | null): boolean =>
  value?.version === 2 &&
  value.connected === true &&
  value.status === "conflict" &&
  typeof value.lastError === "string";

// A failed preview persists the conflict again (new lastAttemptAt), so only the write that
// enters the conflict may start a review; reacting to every conflict write loops forever.
export const isConflictEntered = (change: {
  newValue?: unknown;
  oldValue?: unknown;
}): boolean =>
  isConflict(asRecord(change.newValue)) &&
  asRecord(change.oldValue)?.status !== "conflict";
