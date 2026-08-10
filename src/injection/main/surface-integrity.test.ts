import { createIntegrityRegistry } from "@privacy-brand/refract-core/integrity/surface-integrity-registry";
import { describe, expect, it } from "vitest";

import {
  captureFpReceivers,
  registerBatteryIntegrity,
  registerGeoIntegrity,
  registerFpIntegrity,
  registerPermIntegrity,
  registerServiceIntegrity,
  registerWorkerIntegrity,
} from "@/injection/main/surface-integrity";
import type { SpoofingSurfaceKey } from "@/shared/spoofing-surfaces";
import type { SpoofingSurfaceMethodId } from "@/shared/types";

const defineMethod = (target: object, key: PropertyKey, value: Function): void => {
  Object.defineProperty(target, key, {
    configurable: true,
    writable: true,
    value,
  });
};

describe("runtime surface integrity integrations", () => {
  it("repairs getBattery and all BatteryManager getters", () => {
    const navigatorPrototype = {};
    const navigatorObject = Object.create(navigatorPrototype) as object;
    const managerPrototype = {};
    const managerObject = Object.create(managerPrototype) as object;
    const canonicalGetBattery = () => Promise.resolve({});
    defineMethod(navigatorPrototype, "getBattery", canonicalGetBattery);
    const getterAnchors = ["charging", "chargingTime", "dischargingTime", "level"].map(
      (key) => {
        const get = () => key;
        const descriptor = {
          configurable: true,
          enumerable: true,
          get,
        } satisfies PropertyDescriptor;
        Object.defineProperty(managerPrototype, key, descriptor);
        return { target: managerPrototype, key, descriptor };
      },
    );
    const getBatteryDescriptor = Object.getOwnPropertyDescriptor(
      navigatorPrototype,
      "getBattery",
    )!;
    const registry = createIntegrityRegistry<
      SpoofingSurfaceKey,
      SpoofingSurfaceMethodId
    >({ now: () => 1 });

    registerBatteryIntegrity(
      { registrar: registry, realmId: "document" },
      {
        status: "installed",
        getBatteryAnchor: {
          target: navigatorPrototype,
          key: "getBattery",
          descriptor: getBatteryDescriptor,
        },
        getManager: () => managerObject,
        getManagerGetterAnchors: () => getterAnchors,
        onManagerReady(callback) {
          callback(managerObject);
        },
      },
      navigatorObject,
    );
    defineMethod(navigatorPrototype, "getBattery", () => Promise.reject());
    for (const key of ["charging", "chargingTime", "dischargingTime", "level"]) {
      Object.defineProperty(managerPrototype, key, {
        configurable: true,
        get: () => false,
      });
    }

    const results = registry.ensureAll();
    expect(results).toHaveLength(5);
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "repaired",
          surfaceId: "battery",
          methodId: "battery.getBattery",
        }),
        ...Array.from({ length: 4 }, () =>
          expect.objectContaining({
            status: "repaired",
            surfaceId: "battery",
          }),
        ),
      ]),
    );
    expect(
      Object.getOwnPropertyDescriptor(navigatorPrototype, "getBattery")?.value,
    ).toBe(canonicalGetBattery);
    for (const anchor of getterAnchors) {
      expect(Object.getOwnPropertyDescriptor(managerPrototype, anchor.key)?.get).toBe(
        anchor.descriptor.get,
      );
    }
  });

  it("repairs geolocation methods and the permissions query method", () => {
    const geolocationPrototype = {};
    const geolocation = Object.create(geolocationPrototype) as object;
    const permissionsPrototype = {};
    const permissions = Object.create(permissionsPrototype) as object;
    const canonicalGetPosition = () => undefined;
    const canonicalWatchPosition = () => 1;
    const canonicalClearWatch = () => undefined;
    const canonicalQuery = () => Promise.resolve({ state: "granted" });
    defineMethod(geolocationPrototype, "getCurrentPosition", canonicalGetPosition);
    defineMethod(geolocationPrototype, "watchPosition", canonicalWatchPosition);
    defineMethod(geolocationPrototype, "clearWatch", canonicalClearWatch);
    defineMethod(geolocation, "getCurrentPosition", canonicalGetPosition);
    defineMethod(geolocation, "watchPosition", canonicalWatchPosition);
    defineMethod(geolocation, "clearWatch", canonicalClearWatch);
    defineMethod(permissionsPrototype, "query", canonicalQuery);
    const targetGlobal = {
      Geolocation: { prototype: geolocationPrototype },
      Permissions: { prototype: permissionsPrototype },
      navigator: { geolocation, permissions },
    } as unknown as typeof globalThis;
    const registry = createIntegrityRegistry<
      SpoofingSurfaceKey,
      SpoofingSurfaceMethodId
    >({ now: () => 1 });
    const integrity = { registrar: registry, realmId: "document" };
    registerGeoIntegrity(integrity, targetGlobal);
    registerPermIntegrity(integrity, targetGlobal);

    expect(registry.ensureAll()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "intact",
          methodId: "geolocation.getCurrentPosition",
        }),
        expect.objectContaining({
          status: "intact",
          methodId: "geolocation.watchPosition",
        }),
        expect.objectContaining({
          status: "intact",
          methodId: "geolocation.clearWatch",
        }),
      ]),
    );
    expect(registry.getIncidentHistory()).toEqual([]);

    Reflect.deleteProperty(geolocationPrototype, "getCurrentPosition");
    defineMethod(permissionsPrototype, "query", () => Promise.reject());
    const results = registry.ensureAll();

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "repaired",
          methodId: "geolocation.getCurrentPosition",
        }),
        expect.objectContaining({
          status: "repaired",
          methodId: "geolocation.permissionsQuery",
        }),
      ]),
    );
    expect(
      Object.getOwnPropertyDescriptor(geolocationPrototype, "getCurrentPosition")
        ?.value,
    ).toBe(canonicalGetPosition);
    expect(Object.getOwnPropertyDescriptor(permissionsPrototype, "query")?.value).toBe(
      canonicalQuery,
    );
  });

  it("repairs configurable navigator object shadows and rejects fixed ones", () => {
    const geolocation = {};
    const permissions = {};
    const navigatorPrototype = {};
    Object.defineProperties(navigatorPrototype, {
      geolocation: { configurable: true, get: () => geolocation },
      permissions: { configurable: true, get: () => permissions },
    });
    const navigatorObject = Object.create(navigatorPrototype) as object;
    const targetGlobal = {
      navigator: navigatorObject,
    } as unknown as typeof globalThis;
    const registry = createIntegrityRegistry<
      SpoofingSurfaceKey,
      SpoofingSurfaceMethodId
    >({ now: () => 1 });
    const integrity = { registrar: registry, realmId: "document" };
    registerGeoIntegrity(integrity, targetGlobal);
    registerPermIntegrity(integrity, targetGlobal);

    Object.defineProperty(navigatorObject, "geolocation", {
      configurable: true,
      value: {},
    });
    Object.defineProperty(navigatorObject, "permissions", {
      configurable: false,
      value: {},
    });
    const results = registry.ensureAll();

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "repaired",
          surfaceId: "geolocation",
          reason: "prototype-chain-changed",
        }),
        expect.objectContaining({
          status: "unrecoverable",
          surfaceId: "geolocation",
          reason: "hostile-non-configurable",
        }),
      ]),
    );
    expect((navigatorObject as { geolocation: object }).geolocation).toBe(geolocation);
    expect((navigatorObject as { permissions: object }).permissions).not.toBe(
      permissions,
    );
  });

  it("repairs navigator descriptor drift and an object shadow in one pass", () => {
    const geolocation = {};
    const navigatorPrototype = {};
    Object.defineProperty(navigatorPrototype, "geolocation", {
      configurable: true,
      get: () => geolocation,
    });
    const navigatorObject = Object.create(navigatorPrototype) as object;
    const targetGlobal = {
      navigator: navigatorObject,
    } as unknown as typeof globalThis;
    const registry = createIntegrityRegistry<
      SpoofingSurfaceKey,
      SpoofingSurfaceMethodId
    >({ now: () => 1 });
    registerGeoIntegrity({ registrar: registry, realmId: "document" }, targetGlobal);
    Object.defineProperty(navigatorPrototype, "geolocation", {
      configurable: true,
      get: () => ({}),
    });
    Object.defineProperty(navigatorObject, "geolocation", {
      configurable: true,
      value: {},
    });

    expect(registry.ensureAll()).toEqual([
      expect.objectContaining({ status: "repaired", surfaceId: "geolocation" }),
    ]);
    expect(Object.hasOwn(navigatorObject, "geolocation")).toBe(false);
    expect((navigatorObject as { geolocation: object }).geolocation).toBe(geolocation);
  });

  it("repairs worker constructors and ServiceWorker.register", () => {
    const canonicalWorker = function Worker() {};
    const canonicalSharedWorker = function SharedWorker() {};
    const canonicalRegister = () => Promise.resolve({});
    const serviceWorkerPrototype = {};
    const serviceWorker = Object.create(serviceWorkerPrototype) as object;
    defineMethod(serviceWorkerPrototype, "register", canonicalRegister);
    const targetGlobal = {
      Worker: canonicalWorker,
      SharedWorker: canonicalSharedWorker,
      ServiceWorkerContainer: { prototype: serviceWorkerPrototype },
      navigator: { serviceWorker },
    } as unknown as typeof globalThis;
    const registry = createIntegrityRegistry<
      SpoofingSurfaceKey,
      SpoofingSurfaceMethodId
    >({ now: () => 1 });
    const integrity = { registrar: registry, realmId: "document" };
    registerWorkerIntegrity(integrity, targetGlobal, {
      worker: true,
      sharedWorker: true,
    });
    registerServiceIntegrity(integrity, targetGlobal);

    Reflect.deleteProperty(targetGlobal, "Worker");
    Object.defineProperty(targetGlobal, "SharedWorker", {
      configurable: true,
      value: function AttackerSharedWorker() {},
    });
    Reflect.deleteProperty(serviceWorkerPrototype, "register");
    const results = registry.ensureAll();

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "repaired",
          methodId: "worker.constructor",
        }),
        expect.objectContaining({
          status: "repaired",
          methodId: "sharedWorker.constructor",
        }),
        expect.objectContaining({
          status: "repaired",
          methodId: "serviceWorker.register",
        }),
      ]),
    );
    expect((targetGlobal as unknown as { Worker: Function }).Worker).toBe(
      canonicalWorker,
    );
    expect((targetGlobal as unknown as { SharedWorker: Function }).SharedWorker).toBe(
      canonicalSharedWorker,
    );
    expect(
      Object.getOwnPropertyDescriptor(serviceWorkerPrototype, "register")?.value,
    ).toBe(canonicalRegister);
  });

  it("repairs configurable serviceWorker shadows and reports fixed shadows", () => {
    const serviceWorkerPrototype = {};
    const serviceWorker = Object.create(serviceWorkerPrototype) as object;
    defineMethod(serviceWorkerPrototype, "register", () => Promise.resolve({}));
    const navigatorPrototype = {};
    Object.defineProperty(navigatorPrototype, "serviceWorker", {
      configurable: true,
      get: () => serviceWorker,
    });
    const navigatorObject = Object.create(navigatorPrototype) as object;
    const targetGlobal = {
      ServiceWorkerContainer: { prototype: serviceWorkerPrototype },
      navigator: navigatorObject,
    } as unknown as typeof globalThis;
    const registry = createIntegrityRegistry<
      SpoofingSurfaceKey,
      SpoofingSurfaceMethodId
    >({ now: () => 1 });
    const integrity = { registrar: registry, realmId: "document" };
    registerServiceIntegrity(integrity, targetGlobal);

    Object.defineProperty(navigatorObject, "serviceWorker", {
      configurable: true,
      value: {},
    });
    expect(registry.ensureAll()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "repaired",
          surfaceId: "serviceWorker",
          reason: "prototype-chain-changed",
        }),
      ]),
    );
    expect((navigatorObject as { serviceWorker: object }).serviceWorker).toBe(
      serviceWorker,
    );

    Object.defineProperty(navigatorObject, "serviceWorker", {
      configurable: false,
      value: {},
    });
    expect(registry.ensureAll()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "unrecoverable",
          surfaceId: "serviceWorker",
          reason: "hostile-non-configurable",
        }),
      ]),
    );
  });

  it("repairs enabled Canvas and WebGL entry points", () => {
    const canvasPrototype = {};
    const canvasContextPrototype = {};
    const webGLPrototype = {};
    const canvas = Object.create(canvasPrototype) as object;
    const canvasContext = Object.create(canvasContextPrototype) as object;
    const webGL = Object.create(webGLPrototype) as object;
    const canonicalToDataURL = () => "data:image/png";
    const canonicalGetImageData = () => ({ data: [] });
    const canonicalReadPixels = () => undefined;
    defineMethod(canvasPrototype, "toDataURL", canonicalToDataURL);
    defineMethod(canvasContextPrototype, "getImageData", canonicalGetImageData);
    defineMethod(webGLPrototype, "readPixels", canonicalReadPixels);
    const targetGlobal = {
      CanvasRenderingContext2D: { prototype: canvasContextPrototype },
      HTMLCanvasElement: { prototype: canvasPrototype },
      WebGLRenderingContext: { prototype: webGLPrototype },
    } as unknown as typeof globalThis;
    const registry = createIntegrityRegistry<
      SpoofingSurfaceKey,
      SpoofingSurfaceMethodId
    >({ now: () => 1 });
    const integrity = { registrar: registry, realmId: "document" };
    registerFpIntegrity(
      integrity,
      targetGlobal,
      {
        surfaceId: "canvas",
        ownership: {
          htmlCanvas: true,
          context2D: true,
          offscreenCanvas: false,
          offscreenContext2D: false,
        },
      },
      { htmlCanvas: () => canvas, canvas2D: () => canvasContext },
    );
    registerFpIntegrity(
      integrity,
      targetGlobal,
      {
        surfaceId: "webGL",
        ownership: {
          webGL1Common: false,
          webGL1ReadPixels: true,
          webGL2Common: false,
          webGL2ReadPixels: false,
        },
      },
      { webGL: () => webGL },
    );

    Reflect.deleteProperty(canvasPrototype, "toDataURL");
    Reflect.deleteProperty(canvasContextPrototype, "getImageData");
    Reflect.deleteProperty(webGLPrototype, "readPixels");
    const results = registry.ensureAll();

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "repaired",
          methodId: "canvas.toDataURL",
        }),
        expect.objectContaining({
          status: "repaired",
          methodId: "canvas.getImageData",
        }),
        expect.objectContaining({
          status: "repaired",
          methodId: "webGL.readPixels",
        }),
      ]),
    );
  });

  it("detects detached Canvas, WebGL, and Audio receiver chains", () => {
    const canvasPrototype = {};
    const webGLPrototype = {};
    const audioBufferPrototype = {};
    defineMethod(canvasPrototype, "toDataURL", () => "data:image/png");
    defineMethod(webGLPrototype, "readPixels", () => undefined);
    defineMethod(audioBufferPrototype, "getChannelData", () => new Float32Array());
    const canvas = Object.create(canvasPrototype) as object;
    const webGL = Object.create(webGLPrototype) as object;
    const audioBuffer = Object.create(audioBufferPrototype) as object;
    const targetGlobal = {
      AudioBuffer: { prototype: audioBufferPrototype },
      HTMLCanvasElement: { prototype: canvasPrototype },
      WebGLRenderingContext: { prototype: webGLPrototype },
    } as unknown as typeof globalThis;
    const registry = createIntegrityRegistry<
      SpoofingSurfaceKey,
      SpoofingSurfaceMethodId
    >({ now: () => 1 });
    const integrity = { registrar: registry, realmId: "document" };
    registerFpIntegrity(
      integrity,
      targetGlobal,
      {
        surfaceId: "canvas",
        ownership: {
          htmlCanvas: true,
          context2D: false,
          offscreenCanvas: false,
          offscreenContext2D: false,
        },
      },
      { htmlCanvas: () => canvas },
    );
    registerFpIntegrity(
      integrity,
      targetGlobal,
      {
        surfaceId: "webGL",
        ownership: {
          webGL1Common: false,
          webGL1ReadPixels: true,
          webGL2Common: false,
          webGL2ReadPixels: false,
        },
      },
      { webGL: () => webGL },
    );
    registerFpIntegrity(
      integrity,
      targetGlobal,
      {
        surfaceId: "audio",
        ownership: { analyserNode: false, audioBuffer: true },
      },
      { audioBuffer: () => audioBuffer },
    );

    Object.setPrototypeOf(canvas, {});
    Object.setPrototypeOf(webGL, {});
    Object.setPrototypeOf(audioBuffer, {});

    expect(registry.ensureAll()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "unrecoverable",
          surfaceId: "canvas",
          reason: "prototype-chain-changed",
        }),
        expect.objectContaining({
          status: "unrecoverable",
          surfaceId: "webGL",
          reason: "prototype-chain-changed",
        }),
        expect.objectContaining({
          status: "unrecoverable",
          surfaceId: "audio",
          reason: "prototype-chain-changed",
        }),
      ]),
    );
  });

  it("keeps WebGL descriptor coverage while retrying a not-ready receiver", () => {
    const FakeWebGLContext = function WebGLRenderingContext() {};
    const webGLPrototype = FakeWebGLContext.prototype;
    defineMethod(webGLPrototype, "readPixels", () => undefined);
    const webGL = Object.create(webGLPrototype) as object;
    let contextAttempts = 0;
    const canvasPrototype = {
      getContext() {
        contextAttempts += 1;
        return contextAttempts === 1 ? null : webGL;
      },
    };
    const targetGlobal = {
      document: {
        createElement: () => Object.create(canvasPrototype) as object,
      },
      HTMLCanvasElement: { prototype: canvasPrototype },
      WebGLRenderingContext: FakeWebGLContext,
    } as unknown as typeof globalThis;
    const receivers = captureFpReceivers(targetGlobal, "webGL");
    const registry = createIntegrityRegistry<
      SpoofingSurfaceKey,
      SpoofingSurfaceMethodId
    >({ now: () => 1 });
    registerFpIntegrity(
      { registrar: registry, realmId: "document" },
      targetGlobal,
      {
        surfaceId: "webGL",
        ownership: {
          webGL1Common: false,
          webGL1ReadPixels: true,
          webGL2Common: false,
          webGL2ReadPixels: false,
        },
      },
      receivers,
    );

    expect(registry.ensureSurface("webGL")).toEqual([
      expect.objectContaining({
        status: "unconfirmed",
        reason: "target-not-ready",
        methodId: "webGL.readPixels",
      }),
    ]);
    expect(registry.ensureSurface("webGL")).toEqual([
      expect.objectContaining({
        status: "intact",
        methodId: "webGL.readPixels",
      }),
    ]);
  });

  it("does not register native fingerprint surfaces without installer ownership", () => {
    const nativeReadPixels = () => undefined;
    const webGLPrototype = {};
    defineMethod(webGLPrototype, "readPixels", nativeReadPixels);
    const targetGlobal = {
      WebGLRenderingContext: { prototype: webGLPrototype },
    } as unknown as typeof globalThis;
    const registry = createIntegrityRegistry<
      SpoofingSurfaceKey,
      SpoofingSurfaceMethodId
    >({ now: () => 1 });

    registerFpIntegrity({ registrar: registry, realmId: "document" }, targetGlobal, {
      surfaceId: "webGL",
      ownership: {
        webGL1Common: false,
        webGL1ReadPixels: false,
        webGL2Common: false,
        webGL2ReadPixels: false,
      },
    });

    expect(registry.ensureSurface("webGL")).toEqual([]);
  });

  it("registers WebGL common methods without claiming native readPixels", () => {
    const webGLPrototype = {};
    for (const key of [
      "getError",
      "getExtension",
      "getSupportedExtensions",
      "getParameter",
      "readPixels",
    ]) {
      defineMethod(webGLPrototype, key, () => undefined);
    }
    const webGL = Object.create(webGLPrototype) as object;
    const targetGlobal = {
      WebGLRenderingContext: { prototype: webGLPrototype },
    } as unknown as typeof globalThis;
    const registry = createIntegrityRegistry<
      SpoofingSurfaceKey,
      SpoofingSurfaceMethodId
    >({ now: () => 1 });
    registerFpIntegrity(
      { registrar: registry, realmId: "document" },
      targetGlobal,
      {
        surfaceId: "webGL",
        ownership: {
          webGL1Common: true,
          webGL1ReadPixels: false,
          webGL2Common: false,
          webGL2ReadPixels: false,
        },
      },
      { webGL: () => webGL },
    );

    const methodIds = registry
      .ensureSurface("webGL")
      .flatMap((result) => (result.methodId ? [result.methodId] : []));
    expect(methodIds).toContain("webGL.getParameter");
    expect(methodIds).not.toContain("webGL.readPixels");
  });

  it("scopes iframe realm anchors independently and releases them on unregisterRealm", () => {
    const createGeolocationGlobal = (): {
      targetGlobal: typeof globalThis;
      geolocationPrototype: object;
      canonicalGetPosition: () => undefined;
    } => {
      const geolocationPrototype = {};
      const geolocation = Object.create(geolocationPrototype) as object;
      const canonicalGetPosition = () => undefined;
      defineMethod(geolocationPrototype, "getCurrentPosition", canonicalGetPosition);
      defineMethod(geolocationPrototype, "watchPosition", () => 1);
      defineMethod(geolocationPrototype, "clearWatch", () => undefined);
      const targetGlobal = {
        Geolocation: { prototype: geolocationPrototype },
        navigator: { geolocation },
      } as unknown as typeof globalThis;
      return { targetGlobal, geolocationPrototype, canonicalGetPosition };
    };

    const parentRealm = createGeolocationGlobal();
    const iframeRealmOne = createGeolocationGlobal();
    const iframeRealmTwo = createGeolocationGlobal();
    const registry = createIntegrityRegistry<
      SpoofingSurfaceKey,
      SpoofingSurfaceMethodId
    >({ now: () => 1 });

    registerGeoIntegrity(
      { registrar: registry, realmId: "document" },
      parentRealm.targetGlobal,
    );
    registerGeoIntegrity(
      { registrar: registry, realmId: "iframe-1" },
      iframeRealmOne.targetGlobal,
    );
    registerGeoIntegrity(
      { registrar: registry, realmId: "iframe-2" },
      iframeRealmTwo.targetGlobal,
    );

    // Tamper with only one child realm; the parent and the sibling realm must
    // stay unaffected, matching the "manipulation of one realm must not
    // disable or poison protection in another realm" invariant from #109/#112.
    Reflect.deleteProperty(iframeRealmOne.geolocationPrototype, "getCurrentPosition");
    const results = registry.ensureAll();

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "repaired",
          methodId: "geolocation.getCurrentPosition",
          realmId: "iframe-1",
        }),
        expect.objectContaining({
          status: "intact",
          methodId: "geolocation.getCurrentPosition",
          realmId: "document",
        }),
        expect.objectContaining({
          status: "intact",
          methodId: "geolocation.getCurrentPosition",
          realmId: "iframe-2",
        }),
      ]),
    );
    expect(
      Object.getOwnPropertyDescriptor(
        iframeRealmOne.geolocationPrototype,
        "getCurrentPosition",
      )?.value,
    ).toBe(iframeRealmOne.canonicalGetPosition);
    expect(
      Object.getOwnPropertyDescriptor(
        parentRealm.geolocationPrototype,
        "getCurrentPosition",
      )?.value,
    ).toBe(parentRealm.canonicalGetPosition);
    expect(
      Object.getOwnPropertyDescriptor(
        iframeRealmTwo.geolocationPrototype,
        "getCurrentPosition",
      )?.value,
    ).toBe(iframeRealmTwo.canonicalGetPosition);

    // Destroy iframe-1's realm (its Window navigated away) — its anchors must
    // be released so a genuinely gone realm cannot leak into future audits or
    // retain a strong reference to its (now discarded) objects.
    registry.unregisterRealm("iframe-1");
    Reflect.deleteProperty(iframeRealmOne.geolocationPrototype, "watchPosition");
    const resultsAfterUnregister = registry.ensureAll();

    expect(resultsAfterUnregister).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ realmId: "iframe-1" })]),
    );
    expect(resultsAfterUnregister).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ realmId: "iframe-2", status: "intact" }),
        expect.objectContaining({ realmId: "document", status: "intact" }),
      ]),
    );
  });

  it("does not own SharedWorker when the active runtime leaves it native", () => {
    const canonicalWorker = function Worker() {};
    const nativeSharedWorker = function SharedWorker() {};
    const targetGlobal = {
      Worker: canonicalWorker,
      SharedWorker: nativeSharedWorker,
    } as unknown as typeof globalThis;
    const registry = createIntegrityRegistry<
      SpoofingSurfaceKey,
      SpoofingSurfaceMethodId
    >({ now: () => 1 });
    registerWorkerIntegrity(
      { registrar: registry, realmId: "document" },
      targetGlobal,
      { worker: true, sharedWorker: false },
    );
    const pageSharedWorker = function SharedWorker() {};
    Object.defineProperty(targetGlobal, "SharedWorker", {
      configurable: true,
      value: pageSharedWorker,
    });

    expect(registry.ensureAll()).toEqual([
      expect.objectContaining({ status: "intact", surfaceId: "worker" }),
    ]);
    expect((targetGlobal as unknown as { SharedWorker: Function }).SharedWorker).toBe(
      pageSharedWorker,
    );
  });
});
