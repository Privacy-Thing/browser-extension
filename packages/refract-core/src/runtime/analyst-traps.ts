import type {
  RuntimeSnapshot,
  SpoofingSurfaceMethodId,
} from "@privacy-brand/xray-protocol";

import { createPrivateSet, privateSetAdd } from "./primordials";

/** Build private selection state once; reporters perform their check inline. */
export const createAnalystTrapState = (
  config: NonNullable<RuntimeSnapshot["analystTraps"]>,
) => {
  const methods = createPrivateSet<SpoofingSurfaceMethodId>();
  for (let index = 0; index < config.methods.length; index += 1) {
    privateSetAdd(methods, config.methods[index]!);
  }
  return { methods, first: config.mode === "first-call" };
};
