import type { ValueProbe } from "../types.js";

type GenericConstructor = abstract new (...args: never[]) => object;

export const GETTER_THIS_MAP: Record<string, string> = {
  "Navigator.prototype": "navigator",
  "Geolocation.prototype": "navigator.geolocation",
  "Permissions.prototype": "navigator.permissions",
  "NavigatorUAData.prototype": "navigator.userAgentData",
  "ServiceWorkerContainer.prototype": "navigator.serviceWorker",
  "HTMLIFrameElement.prototype": "document.createElement('iframe')",
  "Node.prototype": "document.createElement('div')",
  "Screen.prototype": "screen",
};

/** Argument bundle for {@link captureDescriptorsInPage} (serialised into page context). */
interface CaptureArgs {
  surfaces: string[];
  getterThisMap: Record<string, string>;
}

/**
 * The function serialised into the page context.
 * Captures Object.getOwnPropertyDescriptors() for each requested API surface,
 * plus enhanced value data:
 *
 * - **getterValue**: For accessor properties with a getter, calls the getter
 *   with the appropriate `this` instance and serialises the return value.
 * - **getterFnName / getterFnLength**: For accessor properties with a getter,
 *   captures the getter function's `name` and `length`.
 * - **getterSurfaceValue**: Calls the getter with the owning surface object as
 *   `this` to detect illegal-receiver / prototype-access parity regressions.
 * - **fnName / fnLength**: For function data properties, captures the function's
 *   `name` and `length` (argument count).
 * - **fnSurfaceValue**: For zero-argument function data properties, calls the
 *   method with the owning surface object as `this` to detect receiver/prototype
 *   parity regressions without bespoke probes.
 * - **actualValue**: For non-function data properties, captures the actual value.
 *
 * These extra fields let the differ detect Privacy Thing patches that preserve
 * descriptor shape (anti-detection) but change observable behavior.
 */
export function captureDescriptorsInPage(
  args: CaptureArgs,
): Record<string, Record<string, unknown> | null> {
  const { surfaces, getterThisMap } = args;
  const result: Record<string, Record<string, unknown> | null> = {};

  // Polyfill esbuild's __name helper. esbuild (via tsx) decorates named
  // function/variable declarations with __name() to preserve Function.name.
  // The helper is defined at module scope, but page.evaluate() serialises
  // only this function body — the module-level definition is absent in the
  // browser page context, causing ReferenceError for inner declarations.
  if (!(globalThis as Record<string, unknown>)["__name"]) {
    (globalThis as Record<string, unknown>)["__name"] = (fn: unknown) => fn;
  }

  // Inline copy of serializeForDiff — this function is stringified into the
  // page context so it cannot reference outer scope.
  function serialize(val: unknown): string {
    if (val === undefined) return "undefined";
    if (val === null) return "null";
    if (typeof val === "symbol") return val.toString();
    try {
      if (typeof val === "object") return JSON.stringify(val);
    } catch {
      /* circular / non-serialisable */
    }
    return String(val);
  }

  for (const surface of surfaces) {
    try {
      // Uses new Function() to resolve dynamic API surface names (e.g.
      // "Date.prototype", "Navigator.prototype") in the page's global scope.
      // This runs inside Playwright's page.evaluate() context, not in Node.
      // Static property access isn't possible here because surface names are
      // runtime strings that may contain dots and "prototype" segments.
      const obj = new Function("return " + surface)();
      if (obj == null) {
        result[surface] = null;
        continue;
      }

      // Resolve the `this` instance for getter calls (if available).
      let getterThis: unknown = undefined;
      const thisExpr = getterThisMap[surface];
      if (thisExpr) {
        try {
          getterThis = new Function("return " + thisExpr)();
        } catch {
          /* skip */
        }
      }

      const descs = Object.getOwnPropertyDescriptors(obj);
      const serialized: Record<string, unknown> = {};

      for (const [key, desc] of Object.entries(descs)) {
        const entry: Record<string, unknown> = {};

        if ("value" in desc) {
          entry.value = typeof desc.value;
          if (typeof desc.value === "function") {
            // Enhanced: capture function metadata for identity comparison.
            entry.fnName = desc.value.name;
            entry.fnLength = desc.value.length;
            if (desc.value.length === 0) {
              try {
                entry.fnSurfaceValue = serialize(Reflect.apply(desc.value, obj, []));
              } catch (error) {
                entry.fnSurfaceValue = `[Error: ${error instanceof Error ? error.name : String(error)}]`;
              }
            }
          } else {
            // Enhanced: capture actual primitive/object value.
            entry.actualValue = serialize(desc.value);
          }
        }
        if ("get" in desc) {
          entry.get = typeof desc.get === "function" ? "[Function]" : undefined;
          if (typeof desc.get === "function") {
            entry.getterFnName = desc.get.name;
            entry.getterFnLength = desc.get.length;
            try {
              entry.getterSurfaceValue = serialize(desc.get.call(obj));
            } catch (error) {
              entry.getterSurfaceValue = `[Error: ${error instanceof Error ? error.name : String(error)}]`;
            }
          }
          // Enhanced: call getter with appropriate `this` to capture
          // the observable return value (e.g. navigator.language).
          if (typeof desc.get === "function" && getterThis !== undefined) {
            try {
              entry.getterValue = serialize(desc.get.call(getterThis));
            } catch {
              entry.getterValue = "[Error]";
            }
          }
        }
        if ("set" in desc) {
          entry.set = typeof desc.set === "function" ? "[Function]" : undefined;
        }
        if ("writable" in desc) entry.writable = desc.writable;
        if ("enumerable" in desc) entry.enumerable = desc.enumerable;
        if ("configurable" in desc) entry.configurable = desc.configurable;

        serialized[key] = entry;
      }

      result[surface] = serialized;
    } catch {
      result[surface] = null;
    }
  }

  return result;
}

/**
 * Evaluate value probes in the page context.
 * Each probe is a JS expression whose return value is serialised for comparison.
 * Probes detect function-based spoofing invisible to descriptor analysis
 * (e.g. `new Date().getTimezoneOffset()` or `Intl.DateTimeFormat().resolvedOptions()`).
 */
export async function captureValueProbes(
  probes: ValueProbe[],
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  const serialize = (value: unknown): string => {
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };
  const evaluate = (expression: string): unknown =>
    new Function("return " + expression)();
  const errorName = (error: unknown): string =>
    `[Error: ${error instanceof Error ? error.name : String(error)}]`;
  const nativeSource = Function.prototype.toString;
  const captureFunction = (probe: ValueProbe): Record<string, unknown> => {
    const target = evaluate(probe.expression);
    if (typeof target !== "function") {
      return { targetMissing: target == null, targetType: typeof target };
    }
    const outcome = (callback: () => unknown): string => {
      try {
        return serialize(callback());
      } catch (error) {
        return errorName(error);
      }
    };
    const result: Record<string, unknown> = {
      classExtendsOutcome: outcome(() => {
        const subclass = class extends (target as GenericConstructor) {};
        return typeof subclass === "function" ? "ok" : "unexpected";
      }),
      descriptorKeys: Object.keys(Object.getOwnPropertyDescriptors(target)).sort(),
      hasPrototype: "prototype" in target,
      length: target.length,
      name: target.name,
      newOutcome: outcome(() => Reflect.construct(target, [])),
      ownNames: Object.getOwnPropertyNames(target).sort(),
      sourceLooksNative: nativeSource.call(target).includes("[native code]"),
      toStringLooksNative: nativeSource.call(target.toString).includes("[native code]"),
    };
    if (probe.receiverExpression || probe.callArgsExpression) {
      const receiver = probe.receiverExpression
        ? evaluate(probe.receiverExpression)
        : undefined;
      const rawArgs = probe.callArgsExpression
        ? evaluate(probe.callArgsExpression)
        : [];
      const args = Array.isArray(rawArgs) ? rawArgs : [];
      result.callOutcome = outcome(() => Reflect.apply(target, receiver, args));
      result.applyOutcome = outcome(() =>
        Reflect.apply(Function.prototype.apply, target, [receiver, args]),
      );
    }
    return result;
  };
  const evaluateWorker = (probe: ValueProbe, shared: boolean): Promise<string> =>
    new Promise((resolve) => {
      try {
        if (shared && typeof SharedWorker === "undefined") {
          resolve("[Error: SharedWorker unsupported]");
          return;
        }
        const dedicated = shared ? undefined : new Worker("/__conformance_worker__.js");
        const port = shared
          ? new SharedWorker("/__conformance_shared_worker__.js").port
          : undefined;
        const target = port ?? dedicated!;
        const closeSafely = (): void => {
          try {
            if (port) port.close();
            else dedicated?.terminate();
          } catch {
            // Ignore cleanup failures.
          }
        };
        const timeoutId = setTimeout(() => {
          closeSafely();
          resolve(`[Error: ${shared ? "SharedWorker" : "Worker"} probe timed out]`);
        }, 3000);
        const finish = (value: string): void => {
          clearTimeout(timeoutId);
          closeSafely();
          resolve(value);
        };
        target.onmessage = (event: MessageEvent) => {
          finish(
            typeof event.data?.value === "string"
              ? event.data.value
              : serialize(event.data?.value),
          );
        };
        const fail = (): void =>
          finish(`[Error: ${shared ? "SharedWorker" : "Worker"} probe failed]`);
        if (port) port.onmessageerror = fail;
        else dedicated!.onerror = fail;
        port?.start();
        target.postMessage({ probe });
      } catch (error) {
        resolve(`[Error: ${error instanceof Error ? error.message : String(error)}]`);
      }
    });
  for (const probe of probes) {
    try {
      if (probe.context === "worker" || probe.context === "shared-worker") {
        const shared = probe.context === "shared-worker";
        results[probe.api] = await evaluateWorker(probe, shared);
        continue;
      }
      const value =
        probe.kind === "function-lies"
          ? captureFunction(probe)
          : await Promise.resolve(evaluate(probe.expression));
      results[probe.api] = serialize(value);
    } catch (error) {
      results[probe.api] =
        `[Error: ${error instanceof Error ? error.message : String(error)}]`;
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Polling helpers — deterministic readiness signals instead of static delays.
// Mirrors E2E fixture patterns (expect.poll / retry loop).
// ---------------------------------------------------------------------------
