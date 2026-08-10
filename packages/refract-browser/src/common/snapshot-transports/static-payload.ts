/**
 * Static payload transport — reads a build-time embedded value from a
 * `Symbol.for(key)` property on `globalThis`.
 *
 * The background registers the symbol key at build time; the page-world
 * runtime reads it once and clears it. Works without any DOM or network I/O.
 */

/**
 * Reads the value at `globalThis[Symbol.for(symbolKey)]` and returns it.
 * Does NOT remove the value — call `clearStaticPayload` when done.
 * Returns `null` when the property is absent or its value is `null`/`undefined`.
 */
export const readStaticPayload = (
  globalRef: typeof globalThis,
  symbolKey: string,
): unknown | null => {
  const value = (globalRef as Record<string | symbol, unknown>)[Symbol.for(symbolKey)];
  return value ?? null;
};

/**
 * Reads and immediately clears the static payload in one operation.
 * Returns the value that was present, or `null`.
 */
export const takeStaticPayload = (
  globalRef: typeof globalThis,
  symbolKey: string,
): unknown | null => {
  const record = globalRef as Record<string | symbol, unknown>;
  const sym = Symbol.for(symbolKey);
  const value = record[sym] ?? null;
  delete record[sym];
  return value;
};

/** Removes the static payload without reading it. */
export const clearStaticPayload = (
  globalRef: typeof globalThis,
  symbolKey: string,
): void => {
  delete (globalRef as Record<string | symbol, unknown>)[Symbol.for(symbolKey)];
};
