import { setAnalystTraps } from "@privacy-brand/refract-browser/common/surface-usage-emitter";
import {
  privateArrayIsArray,
  privateObjectCreate,
  privateOwnDescriptor,
  privateReflectApply,
} from "@privacy-brand/refract-core/runtime/primordials";

import type { SpoofingSurfaceMethodId } from "@/shared/types";

/**
 * Receives X-Ray Inspector trap bindings from the static isolated bootstrap.
 *
 * Each MAIN bundle opens its endpoint while it is evaluated at document_start:
 * it hands a detached, never-inserted element to the isolated bootstrap with
 * one handshake event. Commands and acknowledgements then travel only on that
 * element. Everything on this path was captured before page code could run.
 */
const hasDom = typeof document === "object" && typeof Document === "function";
const nativeCreateElement = hasDom ? Document.prototype.createElement : undefined;
const nativeAddListener = hasDom ? EventTarget.prototype.addEventListener : undefined;
const nativeDispatch = hasDom ? EventTarget.prototype.dispatchEvent : undefined;
const NativeMouseEvent = hasDom ? MouseEvent : undefined;
const NativeCustomEvent = hasDom ? CustomEvent : undefined;
const nativeDetail = hasDom
  ? privateOwnDescriptor(CustomEvent.prototype, "detail")?.get
  : undefined;
const nativeJsonParse = JSON.parse;
const MAX_METHODS = 128;

type AnalystCommand = {
  r: number;
  m: SpoofingSurfaceMethodId[] | null;
  e: boolean;
};

const readCommand = (event: Event): AnalystCommand | null => {
  try {
    const detail: unknown = privateReflectApply(nativeDetail!, event, []);
    if (typeof detail !== "string") return null;
    const value = privateReflectApply(nativeJsonParse, JSON, [detail]) as unknown;
    if (typeof value !== "object" || value === null) return null;
    const { r, m, e } = value as Record<string, unknown>;
    if (typeof r !== "number" || r < 0 || typeof e !== "boolean") return null;
    if (m === null) return { r, m, e };
    if (!privateArrayIsArray(m) || m.length === 0 || m.length > MAX_METHODS)
      return null;
    for (let index = 0; index < m.length; index += 1) {
      if (typeof m[index] !== "string") return null;
    }
    return { r, m: m as SpoofingSurfaceMethodId[], e };
  } catch {
    return null;
  }
};

const acknowledge = (node: Element, revision: number): void => {
  const init = privateObjectCreate<CustomEventInit<string>>(null);
  init.detail = `${revision}`;
  privateReflectApply(nativeDispatch!, node, [
    new NativeCustomEvent!(__PT_ANALYST_ACK__, init),
  ]);
};

/** Opens this bundle's endpoint. Call once, before the bundle installs anything. */
export const openAnalystChannel = (handoffType: string): void => {
  if (!nativeCreateElement || !NativeMouseEvent || !nativeDetail) return;
  try {
    const node = privateReflectApply(nativeCreateElement, document, ["div"]) as Element;
    privateReflectApply(nativeAddListener!, node, [
      __PT_ANALYST_CMD__,
      (event: Event): void => {
        const command = readCommand(event);
        if (!command) return;
        const applied = setAnalystTraps(
          command.m
            ? { methods: command.m, mode: command.e ? "every-call" : "first-call" }
            : null,
          command.r,
        );
        if (applied) acknowledge(node, command.r);
      },
    ]);
    const init = privateObjectCreate<MouseEventInit>(null);
    init.relatedTarget = node;
    privateReflectApply(nativeDispatch!, document, [
      new NativeMouseEvent(handoffType, init),
    ]);
  } catch {
    // Without an endpoint this document applies selections on its next load.
  }
};
