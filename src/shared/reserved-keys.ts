/**
 * Names a plain object inherits from `Object.prototype`, plus `prototype`.
 * Identifiers that become object keys (import choices, plugin maps) and keys read
 * from untrusted JSON must not use them: `JSON.parse` keeps `"__proto__"` as an own
 * key that assignment and schemas drop, and a lookup of the others returns an
 * inherited member instead of `undefined`. Matching is exact; `tostring` is fine.
 */
const RESERVED_KEYS: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString",
  "toString",
  "valueOf",
]);

export const isReservedKey = (value: string): boolean => RESERVED_KEYS.has(value);
