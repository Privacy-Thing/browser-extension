import type {
  RuntimeSnapshot,
  SpoofingSurfaceMethodId,
  XRaySurfaceCategory,
} from "@privacy-brand/xray-protocol";

import { pause } from "./analyst-trap";
import { createPrivateSet, privateSetAdd, privateSetHas } from "./primordials";

type UsageEmitter = (
  category: XRaySurfaceCategory,
  methodId?: SpoofingSurfaceMethodId,
) => void;

/** Chooses the emitter once at activation; the unarmed binding is identical. */
export const bindAnalystTraps = <T extends UsageEmitter>(
  plain: T,
  config: RuntimeSnapshot["analystTraps"],
  stop: () => void = pause,
): T | UsageEmitter => {
  if (!config) return plain;
  const methods = createPrivateSet<SpoofingSurfaceMethodId>();
  for (let index = 0; index < config.methods.length; index += 1) {
    privateSetAdd(methods, config.methods[index]!);
  }
  const seen = createPrivateSet<SpoofingSurfaceMethodId>();
  const first = config.mode === "first-call";
  return (category, methodId) => {
    if (
      methodId &&
      privateSetHas(methods, methodId) &&
      (!first || !privateSetHas(seen, methodId))
    ) {
      if (first) privateSetAdd(seen, methodId);
      stop();
    }
    plain(category, methodId);
  };
};
