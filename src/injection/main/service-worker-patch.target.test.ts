import { maskAsNative } from "@privacy-brand/refract-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RuntimeSnapshot } from "@/shared/types";

const buildSnapshot = (blockServiceWorkers: boolean): RuntimeSnapshot => ({
  geo: {
    latitude: 52.2297,
    longitude: 21.0122,
    accuracy: 25,
    noiseRadius: 50,
  },
  locale: {
    language: "pl-PL",
    languages: ["pl-PL", "pl"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl-PL,pl",
  },
  date: {
    baseEpochMs: Date.parse("2026-01-15T12:00:00.000Z"),
    offsetMs: 0,
    timeZone: "Europe/Warsaw",
  },
  debugMode: false,
  watchPositionDelay: [60, 500],
  blockServiceWorkerRegistration: blockServiceWorkers,
});

/**
 * The actual `installServiceWorker` runs as a side-effect in MAIN world
 * injection and patches `ServiceWorkerContainer.prototype.register`.  These
 * tests replicate the core patching logic in isolation without importing the
 * full injection entry point.
 */

const nativeFnToString = Function.prototype.toString;
const blockedRegMessage = (
  browserTarget: "chromium" | "firefox",
  scope: string,
  url: string,
): string =>
  browserTarget === "firefox"
    ? `Failed to register/update a ServiceWorker for scope ('${scope}'): ` +
      `The operation is insecure for script ('${url}').`
    : `Failed to register a ServiceWorker for scope ('${scope}') ` +
      `with script ('${url}'): An SSL certificate error occurred ` +
      `when fetching the script.`;

const createPatchedRegister = (
  snapshot: RuntimeSnapshot,
  nativeRegister: (...args: unknown[]) => Promise<unknown>,
  browserTarget: "chromium" | "firefox" = "chromium",
) => {
  const PatchedRegister = maskAsNative(function (
    this: unknown,
    scriptURL: string | URL,
    ...rest: [{ scope?: string }?]
  ): Promise<unknown> {
    const url = String(scriptURL);
    const scope = rest[0]?.scope ?? "/";

    if (snapshot.blockServiceWorkerRegistration) {
      return Promise.reject(
        new DOMException(blockedRegMessage(browserTarget, scope, url), "SecurityError"),
      );
    }

    return Reflect.apply(nativeRegister, this, [scriptURL, ...rest]);
  }, "function register() { [native code] }");

  return PatchedRegister;
};

describe("ServiceWorker registration intercept", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates to the native register when blocking is disabled", async () => {
    const fakeRegistration = { scope: "/" };
    const nativeRegister = vi.fn().mockResolvedValue(fakeRegistration);
    const snapshot = buildSnapshot(false);

    const patched = createPatchedRegister(snapshot, nativeRegister);
    const result = await patched.call({}, "/sw.js");

    expect(nativeRegister).toHaveBeenCalledOnce();
    expect(result).toBe(fakeRegistration);
  });

  it("rejects with SecurityError DOMException when blocking is enabled", async () => {
    const nativeRegister = vi.fn();
    const snapshot = buildSnapshot(true);

    const patched = createPatchedRegister(snapshot, nativeRegister);

    await expect(patched.call({}, "/sw.js")).rejects.toThrow(DOMException);
    await expect(patched.call({}, "/sw.js")).rejects.toMatchObject({
      name: "SecurityError",
    });
    expect(nativeRegister).not.toHaveBeenCalled();
  });

  it("includes script URL and scope in the rejection message", async () => {
    const nativeRegister = vi.fn();
    const snapshot = buildSnapshot(true);

    const patched = createPatchedRegister(snapshot, nativeRegister);

    await expect(patched.call({}, "/my-sw.js", { scope: "/app/" })).rejects.toThrow(
      /\/my-sw\.js/,
    );
    await expect(patched.call({}, "/my-sw.js", { scope: "/app/" })).rejects.toThrow(
      /\/app\//,
    );
  });

  it("uses the Chromium-style SSL wording by default", async () => {
    const patched = createPatchedRegister(buildSnapshot(true), vi.fn(), "chromium");

    await expect(patched.call({}, "/sw.js")).rejects.toThrow(
      /SSL certificate error occurred when fetching the script/,
    );
  });

  it("uses Firefox-style wording on Firefox builds", async () => {
    const patched = createPatchedRegister(buildSnapshot(true), vi.fn(), "firefox");

    await expect(patched.call({}, "/sw.js")).rejects.toThrow(
      /Failed to register\/update a ServiceWorker/,
    );
    await expect(patched.call({}, "/sw.js")).rejects.toThrow(
      /The operation is insecure/,
    );
  });

  it("passes maskAsNative check — toString returns native-looking source", () => {
    const snapshot = buildSnapshot(false);
    const patched = createPatchedRegister(snapshot, vi.fn());

    expect(patched.toString()).toBe("function register() { [native code] }");
  });

  it("forwards options to native register", async () => {
    const fakeRegistration = { scope: "/app/" };
    const nativeRegister = vi.fn().mockResolvedValue(fakeRegistration);
    const snapshot = buildSnapshot(false);

    const patched = createPatchedRegister(snapshot, nativeRegister);
    await patched.call({}, "/sw.js", { scope: "/app/" });

    expect(nativeRegister).toHaveBeenCalledWith("/sw.js", { scope: "/app/" });
  });

  afterEach(() => {
    // Restore original toString in case maskAsNative modified it
    if (Function.prototype.toString !== nativeFnToString) {
      Object.defineProperty(Function.prototype, "toString", {
        configurable: true,
        enumerable: false,
        writable: true,
        value: nativeFnToString,
      });
    }
  });
});
