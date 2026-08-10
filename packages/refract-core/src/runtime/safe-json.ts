import {
  createPrivateArray,
  createPrivateRecord,
  privateArrayIsArray,
  privateJsonStringify,
  privateOwnDescriptor,
  privateObjectKeys,
} from "./primordials";

const copyJsonData = (input: unknown): unknown => {
  if (typeof input !== "object" || input === null) return input;

  const isArray = privateArrayIsArray(input);
  const length = isArray ? privateOwnDescriptor(input, "length")?.value : 0;
  if (isArray && typeof length !== "number") {
    throw new TypeError("Runtime JSON array has an invalid length");
  }

  const copy = isArray
    ? createPrivateArray<unknown>(length as number)
    : createPrivateRecord<Record<string, unknown>>();
  const keys = privateObjectKeys(input);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]!;
    const descriptor = privateOwnDescriptor(input, key);
    if (!descriptor || !("value" in descriptor)) {
      throw new TypeError(`Runtime JSON property ${key} must be data-only`);
    }
    (copy as Record<string, unknown>)[key] = copyJsonData(descriptor.value);
  }
  return copy;
};

const escapeScriptText = (json: string): string => {
  let output = "";
  for (let index = 0; index < json.length; index += 1) {
    output += json[index] === "<" ? "\\u003c" : json[index];
  }
  return output;
};

/** Serializes data without invoking mutable JSON or prototype hooks. */
export const safeJsonStringify = (value: unknown): string => {
  const json = privateJsonStringify(copyJsonData(value));
  if (json === undefined) throw new TypeError("Runtime data is not serializable");
  return escapeScriptText(json);
};
