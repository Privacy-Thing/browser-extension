/**
 * Reads the bootstrap snapshot that the background/content layers seed into a
 * document or `window.name` before the main-world runtime starts patching.
 */

import { safeJsonStringify } from "@privacy-brand/refract-core/runtime/safe-json";

import { isRuntimeSnapshot } from "@/shared/runtime-snapshot";
import type { RuntimeSnapshot } from "@/shared/types";

const WINDOW_NAME_PREFIX = "\u001f\u001e";
const CONFIG_OBSERVER_TIMEOUT = 1_500;
const RUNTIME_CONFIG_SELECTOR = `script[type="application/json"][data-${__PT_RUNTIME_CONFIG_ATTR__}]`;
const RUNTIME_MARKER_ATTR = `data-${__PT_RUNTIME_APPLIED_ATTR__}`;
let runtimeDisabled = false;
let runtimeDecisionFinalized = false;
const NativeTextEncoder = TextEncoder;
const nativeEncode = TextEncoder.prototype.encode;
const nativeFromCharCode = String.fromCharCode;
const nativeBtoa = globalThis.btoa;
const nativeReflectApply = Reflect.apply;

const encodeWindowSeed = (json: string): string => {
  const bytes = nativeReflectApply(nativeEncode, new NativeTextEncoder(), [
    json,
  ]) as Uint8Array;
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += nativeReflectApply(nativeFromCharCode, String, [bytes[index]]) as string;
  }
  const base64 = nativeReflectApply(nativeBtoa, globalThis, [binary]) as string;
  let encoded = "";
  for (let index = 0; index < base64.length && base64[index] !== "="; index += 1) {
    const character = base64[index];
    if (character === "+") encoded += "-";
    else if (character === "/") encoded += "_";
    else encoded += character;
  }
  return encoded;
};

/**
 * Whether the main-world runtime has already applied in this document (it sets
 * the applied marker on `documentElement` after install). Lets late bootstrap
 * writers skip re-injecting the DOM handoff element the runtime already consumed.
 */
export const isRuntimeApplied = (
  targetDocument: Document | null | undefined = typeof document === "undefined"
    ? null
    : document,
): boolean =>
  targetDocument?.documentElement?.hasAttribute(RUNTIME_MARKER_ATTR) === true;

type ObserveConfigOptions = {
  onTimeout?: () => void;
  targetDocument?: Document | null | undefined;
  timeoutMs?: number;
};

export type RuntimeWindowSeedPayload = {
  previousName: string;
  sourceHostname?: string;
} & (
  | {
      kind: "snapshot";
      snapshot: RuntimeSnapshot;
    }
  | {
      kind: "disabled";
    }
);

export type SeedCleanupResult = "absent" | "restored" | "cleared-invalid";

export type PostInitSeedCleanup = {
  stop(): void;
};

/**
 * Assigns JSON payload to a script element's content.
 *
 * When TrustedTypes is active we skip createPolicy entirely: calling
 * createPolicy with a name that violates the page's trusted-types directive
 * fires a securitypolicyviolation event synchronously even when the resulting
 * exception is caught. Pages like Cloudflare Turnstile listen for that event
 * as an anti-tamper signal. The payload data attribute is not a TrustedScript
 * sink and never triggers a violation.
 */
export const setScriptPayload = (element: HTMLScriptElement, json: string): void => {
  if ((globalThis as Record<string, unknown>)["trustedTypes"]) {
    element.setAttribute(__PT_RUNTIME_PAYLOAD_ATTR__, json);
  } else {
    try {
      element.textContent = json;
    } catch {
      element.setAttribute(__PT_RUNTIME_PAYLOAD_ATTR__, json);
    }
  }
};

const parseRuntimeSnapshot = (value: string): RuntimeSnapshot | null => {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRuntimeSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Finds the DOM bootstrap script element that contains the seeded runtime
 * snapshot, if present.
 */
export const findConfigElement = (
  targetDocument: Document | null | undefined,
): HTMLScriptElement | null => {
  if (!targetDocument) {
    return null;
  }

  const element = targetDocument.querySelector<HTMLScriptElement>(
    RUNTIME_CONFIG_SELECTOR,
  );
  if (!element) {
    return null;
  }

  const content =
    element.textContent || element.getAttribute(__PT_RUNTIME_PAYLOAD_ATTR__);
  return content && parseRuntimeSnapshot(content) ? element : null;
};

export const findRuntimeConfigElement = (): HTMLScriptElement | null =>
  typeof document === "undefined" ? null : findConfigElement(document);

export const markRuntimeDisabled = (
  targetDocument: Document | null | undefined = typeof document === "undefined"
    ? null
    : document,
): void => {
  if (!runtimeDecisionFinalized) {
    runtimeDisabled = true;
  }

  const root = getRuntimeConfigRoot(targetDocument);
  if (!targetDocument || !root) {
    return;
  }

  findConfigElement(targetDocument)?.remove();
  targetDocument.documentElement?.setAttribute(__PT_RUNTIME_DISABLED_ATTR__, "");
};

export const clearDisabledMarker = (
  targetDocument: Document | null | undefined = typeof document === "undefined"
    ? null
    : document,
): void => {
  if (!runtimeDecisionFinalized) {
    runtimeDisabled = false;
  }
  targetDocument?.documentElement?.removeAttribute(__PT_RUNTIME_DISABLED_ATTR__);
};

export const isRuntimeDisabled = (
  targetDocument: Document | null | undefined = typeof document === "undefined"
    ? null
    : document,
): boolean => {
  if (
    !runtimeDecisionFinalized &&
    targetDocument?.documentElement?.hasAttribute(__PT_RUNTIME_DISABLED_ATTR__) === true
  ) {
    runtimeDisabled = true;
  }
  return runtimeDisabled;
};

/** Locks an accepted enabled bootstrap decision into this bundle's private state. */
export const finalizeRuntimeEnabled = (
  targetDocument: Document | null | undefined = typeof document === "undefined"
    ? null
    : document,
): void => {
  if (runtimeDisabled) {
    return;
  }
  runtimeDecisionFinalized = true;
  targetDocument?.documentElement?.removeAttribute(__PT_RUNTIME_DISABLED_ATTR__);
};

const getRuntimeConfigRoot = (
  targetDocument: Document | null | undefined,
): ParentNode | null =>
  targetDocument?.head ??
  targetDocument?.documentElement ??
  targetDocument?.body ??
  null;

const getConfigObserverTarget = (
  targetDocument: Document | null | undefined,
): Node | null => getRuntimeConfigRoot(targetDocument) ?? targetDocument ?? null;

/** Reads the runtime snapshot from the DOM bootstrap script, if present. */
export const readConfigElement = (
  targetDocument: Document | null | undefined,
): RuntimeSnapshot | null => {
  const element = findConfigElement(targetDocument);
  const content =
    element?.textContent || element?.getAttribute(__PT_RUNTIME_PAYLOAD_ATTR__);
  if (!content) {
    return null;
  }

  return parseRuntimeSnapshot(content);
};

export const readRuntimeConfigElement = (): RuntimeSnapshot | null =>
  readConfigElement(typeof document === "undefined" ? null : document);

export const writeConfigElement = (
  targetDocument: Document | null | undefined,
  snapshot: RuntimeSnapshot,
): boolean => {
  const root = getRuntimeConfigRoot(targetDocument);
  if (!root || !targetDocument) {
    return false;
  }

  const element =
    findConfigElement(targetDocument) ?? targetDocument.createElement("script");
  element.type = "application/json";
  element.setAttribute(`data-${__PT_RUNTIME_CONFIG_ATTR__}`, "");
  setScriptPayload(element, safeJsonStringify(snapshot));
  if (!element.isConnected) {
    root.prepend(element);
  }

  return true;
};

export const observeConfigInsertion = (
  onRuntimeConfigAvailable: () => void,
  {
    onTimeout,
    targetDocument = typeof document === "undefined" ? null : document,
    timeoutMs = CONFIG_OBSERVER_TIMEOUT,
  }: ObserveConfigOptions = {},
): (() => void) => {
  const observerTarget = getConfigObserverTarget(targetDocument);
  if (!observerTarget) {
    return () => undefined;
  }

  let stopped = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const observer = new MutationObserver(() => {
    if (!findConfigElement(targetDocument)) {
      return;
    }

    stop();
    onRuntimeConfigAvailable();
  });

  const stop = (): void => {
    if (stopped) {
      return;
    }

    stopped = true;
    observer.disconnect();
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  };

  observer.observe(observerTarget, {
    childList: true,
    // subtree only when the target is the Document node itself — the config element
    // is always prepended as a direct child of head / documentElement / body, so
    // subtree scanning of those nodes is unnecessary and expensive on heavy SPAs.
    ...(observerTarget === targetDocument ? { subtree: true } : {}),
  });

  timeoutId = setTimeout(() => {
    stop();
    onTimeout?.();
  }, timeoutMs);

  return stop;
};

export const parseRuntimeWindowSeed = (
  value: string,
): RuntimeWindowSeedPayload | null => {
  if (!value.startsWith(WINDOW_NAME_PREFIX)) {
    return null;
  }

  try {
    const encoded = value.slice(WINDOW_NAME_PREFIX.length);
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padding =
      normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    const binary = atob(`${normalized}${padding}`);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(decoded) as {
      kind?: unknown;
      previousName?: unknown;
      sourceHostname?: unknown;
      snapshot?: unknown;
    };
    if (typeof parsed.previousName !== "string") {
      return null;
    }
    if (
      parsed.sourceHostname !== undefined &&
      typeof parsed.sourceHostname !== "string"
    ) {
      return null;
    }
    const sourceHostname =
      typeof parsed.sourceHostname === "string"
        ? { sourceHostname: parsed.sourceHostname }
        : {};
    if (parsed.kind === "disabled") {
      return {
        kind: "disabled",
        previousName: parsed.previousName,
        ...sourceHostname,
      };
    }
    if (!isRuntimeSnapshot(parsed.snapshot)) {
      return null;
    }
    return {
      kind: "snapshot",
      previousName: parsed.previousName,
      snapshot: parsed.snapshot,
      ...sourceHostname,
    };
  } catch {
    return null;
  }
};

export const writeRuntimeWindowSeed = (
  snapshot: RuntimeSnapshot,
  targetWindow: { name?: string } = globalThis as typeof globalThis & { name?: string },
  options: {
    preserveExistingSeed?: boolean;
    sourceHostname?: string;
  } = {},
): void => {
  const currentName = targetWindow.name ?? "";
  const existingPayload = parseRuntimeWindowSeed(currentName);

  if (existingPayload && options.preserveExistingSeed) {
    // The background navigation hook can seed the *next* document before the
    // current page finishes unloading. When that already happened, unload-time
    // persistence must not clobber the authoritative next-navigation snapshot.
    return;
  }

  const previousName = existingPayload?.previousName ?? currentName;
  const json = safeJsonStringify({
    kind: "snapshot",
    previousName,
    snapshot,
    ...(options.sourceHostname ? { sourceHostname: options.sourceHostname } : {}),
  });
  const encoded = encodeWindowSeed(json);
  targetWindow.name = `${WINDOW_NAME_PREFIX}${encoded}`;
};

export const writeDisabledSeed = (
  targetWindow: { name?: string } = globalThis as typeof globalThis & { name?: string },
): void => {
  const currentName = targetWindow.name ?? "";
  const existingPayload = parseRuntimeWindowSeed(currentName);
  const previousName = existingPayload?.previousName ?? currentName;
  const json = safeJsonStringify({ kind: "disabled", previousName });
  const encoded = encodeWindowSeed(json);
  targetWindow.name = `${WINDOW_NAME_PREFIX}${encoded}`;
};

export const consumeRuntimeWindowSeed = (
  targetWindow: { name?: string } = globalThis as typeof globalThis & { name?: string },
): RuntimeWindowSeedPayload | null => {
  const result = takeRuntimeWindowSeed(targetWindow);
  return result.status === "restored" ? result.payload : null;
};

const takeRuntimeWindowSeed = (targetWindow: {
  name?: string;
}): {
  status: SeedCleanupResult;
  payload: RuntimeWindowSeedPayload | null;
} => {
  const currentName = targetWindow.name;
  if (typeof currentName !== "string" || !currentName.startsWith(WINDOW_NAME_PREFIX)) {
    return { status: "absent", payload: null };
  }

  // Remove the public artifact before parsing its page-controlled contents.
  targetWindow.name = "";
  const payload = parseRuntimeWindowSeed(currentName);
  if (payload) {
    targetWindow.name = payload.previousName;
    return { status: "restored", payload };
  }

  return { status: "cleared-invalid", payload: null };
};

/** Removes a runtime seed without exposing or applying its snapshot. */
export const cleanupRuntimeWindowSeed = (
  targetWindow: { name?: string } = globalThis as typeof globalThis & { name?: string },
): SeedCleanupResult => takeRuntimeWindowSeed(targetWindow).status;

/**
 * Briefly removes seeds that arrive after the runtime has accepted its snapshot.
 * It stops before unload handlers intentionally seed the next navigation.
 */
export const installPostInitCleanup = (
  cleanup: () => void,
  targetWindow: Window = window,
): PostInitSeedCleanup => {
  let stopped = false;
  const timers: Array<ReturnType<typeof setTimeout>> = [];
  const controller = new AbortController();
  const run = (): void => {
    if (!stopped) cleanup();
  };
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    controller.abort();
    for (const timer of timers) clearTimeout(timer);
    timers.length = 0;
  };

  targetWindow.addEventListener("pagehide", stop, {
    capture: true,
    once: true,
    signal: controller.signal,
  });
  targetWindow.addEventListener("beforeunload", stop, {
    capture: true,
    once: true,
    signal: controller.signal,
  });
  if (targetWindow.document.readyState === "loading") {
    targetWindow.addEventListener("DOMContentLoaded", run, {
      once: true,
      signal: controller.signal,
    });
  }
  if (targetWindow.document.readyState !== "complete") {
    targetWindow.addEventListener("load", run, {
      once: true,
      signal: controller.signal,
    });
  }
  run();
  queueMicrotask(run);
  for (const delay of [0, 25, 100, 250, 500, 1000, 2000]) {
    timers.push(setTimeout(run, delay));
  }
  timers.push(setTimeout(stop, 2100));
  return { stop };
};

/**
 * Reads the runtime snapshot encoded into `window.name` during navigation
 * preload. A valid seed is immediately restored to the page-owned name.
 */
export const readWindowSeedSnapshot = (): RuntimeSnapshot | null => {
  const payload = consumeRuntimeWindowSeed();
  if (payload?.kind === "disabled") {
    markRuntimeDisabled();
    return null;
  }
  if (
    payload?.sourceHostname &&
    typeof location !== "undefined" &&
    payload.sourceHostname !== location.hostname
  ) {
    return null;
  }
  return payload?.snapshot ?? null;
};

/** Reads the first available bootstrap snapshot during initial runtime install. */
export const readInitialSnapshot = (): RuntimeSnapshot | null => {
  const windowSeedSnapshot = readWindowSeedSnapshot();
  if (windowSeedSnapshot || isRuntimeDisabled()) {
    return windowSeedSnapshot;
  }

  return readRuntimeConfigElement();
};

/**
 * Reads the latest available runtime snapshot using all supported bootstrap
 * transport channels.
 */
export const readRuntimeSnapshot = (): RuntimeSnapshot | null => {
  return (
    readWindowSeedSnapshot() ??
    (isRuntimeDisabled() ? null : readRuntimeConfigElement())
  );
};

/**
 * Removes the DOM bootstrap script element from the document once it has been
 * consumed by all readers. Eliminates a persistent DOM artifact that page
 * scripts could discover via `querySelectorAll('script[type="application/json"]')`.
 */
export const removeConfigElement = (): void => {
  findRuntimeConfigElement()?.remove();
};

/** Custom event name dispatched once the runtime snapshot has been seeded. */
export const getRuntimeReadyEvent = (): string => __PT_RUNTIME_READY_EVENT_NAME__;
/** Prefix used to distinguish runtime payloads stored in `window.name`. */
export const getWindowSeedPrefix = (): string => WINDOW_NAME_PREFIX;
