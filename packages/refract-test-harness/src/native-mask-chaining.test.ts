import { afterEach, describe, expect, it, vi } from "vitest";

const nativeToStringDescriptor = Object.getOwnPropertyDescriptor(
  Function.prototype,
  "toString",
)!;

describe("bundle-local native masking", () => {
  afterEach(() => {
    Object.defineProperty(Function.prototype, "toString", nativeToStringDescriptor);
    vi.resetModules();
  });

  it("keeps early wrappers masked after a later bundle installs its own registry", async () => {
    const symbolsBefore = new Set(Object.getOwnPropertySymbols(globalThis));
    vi.resetModules();
    const earlyMask = await import("@privacy-brand/refract-core/native/native-mask");
    const earlyFunction = earlyMask.maskAsNative(function earlyFunction(): void {});

    vi.resetModules();
    const mainMask = await import("@privacy-brand/refract-core/native/native-mask");
    const mainFunction = mainMask.maskAsNative(function mainFunction(): void {});
    const pageFunction = function pageFunction(): void {};

    expect(Function.prototype.toString.call(earlyFunction)).toBe(
      "function earlyFunction() { [native code] }",
    );
    expect(Function.prototype.toString.call(mainFunction)).toBe(
      "function mainFunction() { [native code] }",
    );
    expect(Function.prototype.toString.call(pageFunction)).toContain(
      "function pageFunction",
    );
    expect(
      Object.getOwnPropertySymbols(globalThis)
        .filter((symbol) => !symbolsBefore.has(symbol))
        .map((symbol) => Reflect.get(globalThis, symbol))
        .filter((value) => value instanceof WeakMap),
    ).toEqual([]);
  });

  it("chains a bundle imported before the earlier bundle installs its wrapper", async () => {
    vi.resetModules();
    const delayedMainMask =
      await import("@privacy-brand/refract-core/native/native-mask");

    vi.resetModules();
    const earlyMask = await import("@privacy-brand/refract-core/native/native-mask");
    const earlyFunction = earlyMask.maskAsNative(function earlyFunction(): void {});
    const mainFunction = delayedMainMask.maskAsNative(function mainFunction(): void {});

    expect(Function.prototype.toString.call(earlyFunction)).toContain("[native code]");
    expect(Function.prototype.toString.call(mainFunction)).toContain("[native code]");
  });

  it("keeps each wrapper's delegate immutable across interleaved reinstalls", async () => {
    vi.resetModules();
    const earlyMask = await import("@privacy-brand/refract-core/native/native-mask");
    earlyMask.maskAsNative(function earlyFunction(): void {});

    vi.resetModules();
    const mainMask = await import("@privacy-brand/refract-core/native/native-mask");
    mainMask.maskAsNative(function mainFunction(): void {});
    const mainToString = Function.prototype.toString;

    earlyMask.maskAsNative(function laterEarlyFunction(): void {});
    const pageFunction = function pageFunction(): void {};

    expect(Reflect.apply(mainToString, pageFunction, [])).toContain(
      "function pageFunction",
    );
  });

  it("does not inspect callable Proxy prototypes before native delegation", async () => {
    const nativeToString =
      nativeToStringDescriptor.value as typeof Function.prototype.toString;
    vi.resetModules();
    const mask = await import("@privacy-brand/refract-core/native/native-mask");
    mask.maskAsNative(function installMask(): void {});
    let getPrototypeOfCalls = 0;
    const callable = new Proxy(function pageCallable(): void {}, {
      getPrototypeOf(target) {
        getPrototypeOfCalls += 1;
        return Reflect.getPrototypeOf(target);
      },
    });
    const expected = Reflect.apply(nativeToString, callable, []);

    const actual = Function.prototype.toString.call(callable);

    expect(actual).toBe(expected);
    expect(getPrototypeOfCalls).toBe(0);
  });

  it("preserves the native invalid-receiver error for primitive receivers", async () => {
    const nativeToString =
      nativeToStringDescriptor.value as typeof Function.prototype.toString;
    const expectedError = (() => {
      try {
        Reflect.apply(nativeToString, 1, []);
      } catch (error) {
        return error;
      }
    })();
    vi.resetModules();
    const mask = await import("@privacy-brand/refract-core/native/native-mask");
    mask.maskAsNative(function installMask(): void {});

    let actualError: unknown;
    try {
      Reflect.apply(Function.prototype.toString, 1, []);
    } catch (error) {
      actualError = error;
    }

    expect(actualError).toBeInstanceOf(TypeError);
    expect((actualError as Error).message).toBe((expectedError as Error).message);
  });
});
