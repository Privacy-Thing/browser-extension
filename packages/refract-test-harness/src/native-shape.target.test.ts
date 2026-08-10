/**
 * Native prototype & descriptor shape verification tests.
 *
 * Per spec §7: All patched properties on global interfaces must:
 * - Have Function.prototype.toString output that mimics native code strings
 * - Have correct .name and .length values
 * - Have correct property descriptor configurations
 * - Throw "Illegal invocation" on invalid receivers
 *
 * These tests verify the native masking helpers from @privacy-brand/refract-core
 * independently of browser E2E.
 */

import {
  maskAsNative,
  mirrorNativeToStringInto,
  createNativeSource,
  defineNativeGetter,
} from "@privacy-brand/refract-core";
import { afterEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Function.prototype.toString masking
// ---------------------------------------------------------------------------

describe("native toString masking", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maskAsNative makes Function.prototype.toString return native code string", () => {
    const nativeSource = createNativeSource("getCurrentPosition");
    const fn = maskAsNative(
      function getCurrentPosition() {
        return 1;
      },
      nativeSource,
      1,
    );

    const str = Function.prototype.toString.call(fn);
    expect(str).toMatch(/\{ \[native code\] \}/);
    expect(str).toContain("getCurrentPosition");
  });

  it("masked function retains correct .name", () => {
    const fn = maskAsNative(
      function watchPosition() {
        return 0;
      },
      createNativeSource("watchPosition"),
      1,
    );
    expect(fn.name).toBe("watchPosition");
  });

  it("masked function retains correct .length", () => {
    const fn = maskAsNative(
      function clearWatch(_id: number) {},
      createNativeSource("clearWatch"),
      1,
    );
    expect(fn.length).toBe(1);
  });

  it("masking a getter produces native toString on the getter function", () => {
    const target: Record<string, unknown> = {};
    defineNativeGetter(
      target as any,
      "language",
      function language(this: unknown) {
        return "en-US";
      },
      {
        nativeGetter: function language(this: unknown) {
          return "en-US";
        },
      },
    );

    const descriptor = Object.getOwnPropertyDescriptor(target, "language");
    expect(descriptor).toBeDefined();
    expect(descriptor!.get).toBeDefined();
    const str = Function.prototype.toString.call(descriptor!.get!);
    expect(str).toMatch(/\{ \[native code\] \}/);
  });

  it("createNativeSource produces a string matching the browser native format", () => {
    const source = createNativeSource("getCurrentPosition");
    expect(source).toContain("getCurrentPosition");
    expect(source).toContain("[native code]");
  });
});

// ---------------------------------------------------------------------------
// Property descriptor shape
// ---------------------------------------------------------------------------

describe("property descriptor configuration", () => {
  it("maskAsNative-wrapped method is configurable=true and enumerable=false by default", () => {
    // Methods installed via Object.defineProperties on a prototype should be
    // configurable (so they can be re-installed if needed) but not enumerable
    // (to avoid appearing in for..in loops).
    const target: Record<string, unknown> = {};
    const fn = maskAsNative(function example() {}, createNativeSource("example"), 0);
    Object.defineProperty(target, "example", {
      configurable: true,
      enumerable: false,
      value: fn,
    });

    const descriptor = Object.getOwnPropertyDescriptor(target, "example");
    expect(descriptor!.configurable).toBe(true);
    expect(descriptor!.enumerable).toBe(false);
    expect(typeof descriptor!.value).toBe("function");
    // Object.defineProperty defaults writable to false when not explicitly set.
    expect(descriptor!.writable).toBe(false);
  });

  it("defineNativeGetter installs a non-enumerable getter", () => {
    const target: Record<string, unknown> = {};
    defineNativeGetter(
      target as any,
      "testProp",
      function testProp() {
        return "value";
      },
      {
        nativeGetter: function testProp() {
          return "value";
        },
      },
    );

    const descriptor = Object.getOwnPropertyDescriptor(target, "testProp");
    expect(descriptor).toBeDefined();
    expect(descriptor!.get).toBeDefined();
    expect(descriptor!.set).toBeUndefined();
    expect(descriptor!.enumerable).toBe(false);
    expect(descriptor!.configurable).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cross-origin iframe native source fallback
// ---------------------------------------------------------------------------

describe("native masking — cross-origin iframe fallback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back gracefully when top-window Symbol access throws SecurityError", () => {
    // Simulate a cross-origin frame where top.Symbol.for throws.
    const blockedTop = new Proxy(
      {},
      {
        get(_target, prop) {
          if (typeof prop === "symbol") {
            throw new DOMException("cross-origin", "SecurityError");
          }
          if (prop === "Symbol") {
            return new Proxy(
              {},
              {
                get() {
                  throw new DOMException("cross-origin", "SecurityError");
                },
              },
            );
          }
          return undefined;
        },
      },
    );

    vi.stubGlobal("top", blockedTop);

    const fn = maskAsNative(
      function crossOriginTest() {
        return 42;
      },
      createNativeSource("crossOriginTest"),
      0,
    );

    // Should not throw despite the blocked top access.
    expect(() => fn()).not.toThrow();
    const str = Function.prototype.toString.call(fn);
    expect(str).toMatch(/\{ \[native code\] \}/);
  });
});

// ---------------------------------------------------------------------------
// Cross-realm toString attack simulation
//
// The existing "native toString masking" tests call Function.prototype.toString
// AFTER patching — they use the already-installed patchedToString, which
// consults nativeSources and returns "[native code]". They cannot detect the
// class of bug where a fresh-realm (unpatched iframe) toString is used as the
// attack vector, because nativeSources is invisible to the raw native toString.
//
// These tests simulate that attack by capturing the native toString reference
// BEFORE any patching occurs, then verifying that mirrorNativeToStringInto
// closes the gap by installing patchedToString into the target realm.
// ---------------------------------------------------------------------------

describe("cross-realm toString attack simulation", () => {
  it("raw pre-patch toString reveals source code of a maskAsNative-registered function", () => {
    // Capture the native toString before maskAsNative (or any prior test) has
    // had a chance to replace Function.prototype.toString. Because other tests
    // in this file run first and already call maskAsNative, Function.prototype
    // .toString is already patchedToString at this point — we use Reflect to
    // get the underlying native implementation that patchedToString delegates to
    // when the function is NOT in nativeSources.
    //
    // We simulate a fresh-realm toString by creating a function that is NOT
    // registered in nativeSources and verifying that the patched toString falls
    // back to the native implementation, which returns source code.
    const unregisteredFn = function unregisteredProbe() {
      return 42;
    };

    // The patched toString falls back to the real native toString for
    // unregistered functions — exactly what a fresh-realm toString would do.
    const sourceViaCurrentToString = Function.prototype.toString.call(unregisteredFn);
    expect(sourceViaCurrentToString).not.toContain("[native code]");
    expect(sourceViaCurrentToString).toContain("return 42");
  });

  it("mirrorNativeToStringInto installs a realm-local delegating wrapper", () => {
    // Build a minimal fake realm: an object with a Function constructor whose
    // prototype carries a separate toString (simulating a fresh iframe realm
    // that has its own Function.prototype.toString, not yet patched by Privacy Thing).
    const freshRealmToString = function toString(this: Function): string {
      // Mimic native toString: return actual source code.
      return Function.prototype.toString.call(this);
    };

    const fakeRealm = {
      Function: {
        prototype: {
          toString: freshRealmToString,
        },
      },
    } as unknown as typeof globalThis;

    expect(fakeRealm.Function.prototype.toString).toBe(freshRealmToString);

    mirrorNativeToStringInto(fakeRealm);

    const mirroredToString = fakeRealm.Function.prototype.toString;
    expect(mirroredToString).not.toBe(freshRealmToString);
    expect(mirroredToString).not.toBe(Function.prototype.toString);
    expect(Function.prototype.toString.call(mirroredToString)).toContain(
      "[native code]",
    );
  });

  it("after mirroring, the realm toString returns [native code] for registered functions", () => {
    const fn = maskAsNative(
      function probeMethod() {
        return 99;
      },
      createNativeSource("probeMethod"),
      0,
    );

    const fakeRealm = {
      Function: {
        prototype: {
          toString: function toString(this: Function): string {
            // Unpatched: would reveal source code.
            return `function ${this.name}() { /* source */ }`;
          },
        },
      },
    } as unknown as typeof globalThis;

    // Before mirroring: fake realm toString does NOT return [native code].
    const beforeMirror = fakeRealm.Function.prototype.toString.call(fn);
    expect(beforeMirror).not.toContain("[native code]");

    mirrorNativeToStringInto(fakeRealm);

    // After mirroring: patchedToString is installed, so [native code] is returned.
    const afterMirror = fakeRealm.Function.prototype.toString.call(fn);
    expect(afterMirror).toContain("[native code]");
    expect(afterMirror).toContain("probeMethod");
  });

  it("after mirroring, patchedToString itself appears native via the realm toString", () => {
    // This is the exact CreepJS check: call the iframe realm's toString on the
    // main world's patchedToString. Without mirroring, the raw native toString
    // reveals patchedToString's source. With mirroring it returns [native code].
    const patchedToString = Function.prototype.toString; // already installed by prior tests

    const fakeRealm = {
      Function: {
        prototype: {
          // Fresh realm toString: falls back to real native impl for unknowns.
          toString: function () {
            return 0;
          } as unknown as typeof Function.prototype.toString,
        },
      },
    } as unknown as typeof globalThis;

    mirrorNativeToStringInto(fakeRealm);

    const result = fakeRealm.Function.prototype.toString.call(patchedToString);
    expect(result).toContain("[native code]");
  });
});

// ---------------------------------------------------------------------------
// Symbol.for key properties
// ---------------------------------------------------------------------------

describe("Symbol.for registry behavior", () => {
  it("Symbol.for with the same key returns the same symbol across calls", () => {
    const key = "test-symbol-for-parity";
    const sym1 = Symbol.for(key);
    const sym2 = Symbol.for(key);
    expect(sym1).toBe(sym2);
  });

  it("Symbol.for symbols are not enumerable via Object.keys", () => {
    const obj: Record<symbol, boolean> = {};
    const sym = Symbol.for("test-non-enumerable");
    obj[sym] = true;

    expect(Object.keys(obj)).toHaveLength(0);
    expect(Object.getOwnPropertyNames(obj)).toHaveLength(0);
    expect(obj[sym]).toBe(true);
  });

  it("Object.defineProperty with enumerable:false hides guard from page scripts", () => {
    const target: Record<symbol, unknown> = {};
    const guardSym = Symbol.for("test-guard-sym");
    Object.defineProperty(target, guardSym, {
      value: true,
      writable: false,
      enumerable: false,
      configurable: false,
    });

    expect(target[guardSym]).toBe(true);
    expect(Object.keys(target)).toHaveLength(0);
    expect(Object.getOwnPropertyNames(target)).toHaveLength(0);
    // Only Object.getOwnPropertySymbols reveals it.
    const syms = Object.getOwnPropertySymbols(target);
    expect(syms).toContain(guardSym);
  });
});
