import { EXAMPLE_LOCATIONS } from "../../src/background/storage/locations";
import { findRuleMatches } from "../../src/shared/domain-match";
import {
  EXTENSION_COMMAND_TYPES,
  STORAGE_PRELOADED_STATE,
} from "../../src/shared/extension-contract";

import {
  assignDomainProfile,
  assignCurrentPageProfile,
  getProbeHostUrl,
  openPopupPage,
  readSettings,
  readNavigatorIdentity,
  saveLocationModel,
  saveSimpleSettings,
  readSharedWorkerSnapshot,
  readSnapshot,
  readWatchSnapshot,
  readWorkerSnapshot,
} from "./extension-test.helpers";
import { expect, test } from "./fixtures";

test("spoofs runtime values on a matched page", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  const nativeIdentity = await readNavigatorIdentity(page);

  await assignCurrentPageProfile(context, extensionId, "Warsaw", page);
  await page.locator("#collect").click();

  const values = await readSnapshot(page);

  expect(values.language).toBe("pl");
  expect(values.languages[0]).toBe("pl");
  expect(values.timeZone).toBe("Europe/Warsaw");
  expect(values.platform).toBe(nativeIdentity.platform);
  expect(values.vendor).toBe(nativeIdentity.vendor);
  expect(values.vendorSub).toBe(nativeIdentity.vendorSub);
  expect(values.productSub).toBe(nativeIdentity.productSub);
  expect(values.webdriver).toBe(false);
  expect(values.languageGetterSource).toContain("[native code]");
  expect(values.webdriverGetterSource).toContain("[native code]");
  expect(values.webdriverPrototypeAccessThrows).toBe(true);
  expect(values.webdriverCallThrows).toBe(true);
  expect(values.userAgentGetterSource).toContain("[native code]");
  expect(values.functionToStringHasPrototype).toBe(false);
  expect(values.functionToStringNewThrows).toBe(true);
  expect(values.userAgent).toBe(nativeIdentity.userAgent);
  expect(values.appVersion).toBe(nativeIdentity.appVersion);
  expect(values.userAgentData).toEqual(
    nativeIdentity.userAgentData
      ? expect.objectContaining({
          platform: nativeIdentity.userAgentData.platform,
          mobile: nativeIdentity.userAgentData.mobile,
          brands: nativeIdentity.userAgentData.brands,
        })
      : null,
  );
  expect(values.intl.dateTimeResolvedOptions.locale).toBe("pl");
  expect(values.intl.dateTimeResolvedOptions.timeZone).toBe("Europe/Warsaw");
  expect(values.intl.numberResolvedOptions.locale).toBe("pl");
  expect(values.intl.pluralRulesResolvedOptions.locale).toBe("pl");
  expect(
    values.intl.formattedNumberParts.find((part) => part.type === "decimal")?.value,
  ).toBe(",");
  expect(
    values.intl.formattedMonthParts.find((part) => part.type === "month")?.value,
  ).toContain("stycz");
  expect(values.intl.pluralCategory).toBe(new Intl.PluralRules("pl").select(2));
  expect(values.permissions.geolocation).toBe("granted");
  expect(values.permissions.geolocationTag).toBe("[object PermissionStatus]");
  expect(values.permissions.geolocationPrototypeName).toBe("PermissionStatus");
  expect(values.geo?.latitude).toBeCloseTo(52.2297, 2);
  expect(values.geo?.longitude).toBeCloseTo(21.0122, 2);
});

test("emits weighted Accept-Language on matched navigations", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  const hostname = new URL(serverUrl).hostname;
  const locationId = "berlin-weighted-header";

  await saveLocationModel(optionsPage, {
    locations: [
      {
        id: locationId,
        label: "Berlin weighted header",
        latitude: 52.52,
        longitude: 13.405,
        accuracy: 25,
        noiseRadius: 50,
        language: "de-DE",
        languages: ["de-DE", "en-US"],
        timeZone: "Europe/Berlin",
      },
    ],
    rules: [{ pattern: hostname, locationId, enabled: true }],
    containerAssignments: [],
  });
  await optionsPage.close();

  const page = await context.newPage();
  const response = await page.goto(`${serverUrl}/echo-accept-language`);

  expect(response).not.toBeNull();
  expect(await response?.text()).toBe("de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7");
});

test("watchPosition emits repeated spoofed updates", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  const currentSettings = await readSettings(optionsPage);
  await saveSimpleSettings(optionsPage, {
    themeMode: currentSettings.themeMode,
    debugMode: currentSettings.debugMode,
    watchPositionDelay: [1, 1],
  });
  await optionsPage.close();

  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await page.reload();
  await page.locator("#collect-watch").click();

  const values = await readWatchSnapshot(page);
  expect(values.updates).toHaveLength(2);
  for (const update of values.updates) {
    expect(update.latitude).toBeCloseTo(52.2297, 2);
    expect(update.longitude).toBeCloseTo(21.0122, 2);
  }
});

test("keeps spoofed values consistent inside same-origin iframes", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await page.reload();
  await expect
    .poll(() => page.frames().some((candidate) => /\/frame$/.test(candidate.url())))
    .toBe(true);
  const frame = page.frames().find((candidate) => /\/frame$/.test(candidate.url()));
  if (!frame) {
    throw new Error("Expected same-origin probe iframe.");
  }
  await frame.waitForLoadState("load");
  await frame.locator("#collect").click();

  const frameValues = await readSnapshot(frame);
  expect(frameValues.language).toBe("pl");
  expect(frameValues.timeZone).toBe("Europe/Warsaw");
  expect(frameValues.installMarkerPresent).toBe(false);
  expect(frameValues.earlyInstallMarkerPresent).toBe(false);
  expect(frameValues.iframeNavigatorMarkerPresent).toBe(false);
});

test("does not expose native iframe geolocation after deleting the navigator shadow", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  await context.setGeolocation({
    latitude: -33.8688,
    longitude: 151.2093,
    accuracy: 12,
  });
  await context.grantPermissions(["geolocation"], {
    origin: new URL(serverUrl).origin,
  });
  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await page.reload();

  const result = await page.evaluate(async () => {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    const childWindow = iframe.contentWindow;
    if (!childWindow) {
      throw new Error("Expected an about:blank child window");
    }

    const childNavigator = childWindow.navigator;
    const before = childNavigator.geolocation;
    const hadOwnShadow = Object.hasOwn(childNavigator, "geolocation");
    const removed = Reflect.deleteProperty(childNavigator, "geolocation");
    const after = childNavigator.geolocation;
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      after.getCurrentPosition(resolve, reject, {
        maximumAge: 0,
        timeout: 5_000,
      });
    });
    const watchPosition = await new Promise<GeolocationPosition>((resolve, reject) => {
      let watchId = 0;
      watchId = after.watchPosition(
        (nextPosition) => {
          after.clearWatch(watchId);
          resolve(nextPosition);
        },
        reject,
        { maximumAge: 0, timeout: 5_000 },
      );
    });
    const permissionState = await childNavigator.permissions
      .query({ name: "geolocation" })
      .then(({ state }) => state);

    const result = {
      afterUsesChildPrototype:
        Object.getPrototypeOf(after) === childWindow.Geolocation.prototype,
      beforeUsesChildPrototype:
        Object.getPrototypeOf(before) === childWindow.Geolocation.prototype,
      hadOwnShadow,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      parentObjectShared: after === navigator.geolocation,
      permissionState,
      watchLatitude: watchPosition.coords.latitude,
      watchLongitude: watchPosition.coords.longitude,
      removed,
    };
    iframe.remove();
    return result;
  });

  expect(result).toEqual({
    afterUsesChildPrototype: true,
    beforeUsesChildPrototype: true,
    hadOwnShadow: false,
    latitude: result.latitude,
    longitude: result.longitude,
    parentObjectShared: false,
    permissionState: "granted",
    watchLatitude: result.watchLatitude,
    watchLongitude: result.watchLongitude,
    removed: true,
  });
  expect(result.latitude).toBeCloseTo(52.2297, 2);
  expect(result.longitude).toBeCloseTo(21.0122, 2);
  expect(result.watchLatitude).toBeCloseTo(52.2297, 2);
  expect(result.watchLongitude).toBeCloseTo(21.0122, 2);
});

test("protects an explicitly navigated iframe's initial about:blank realm", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  await context.setGeolocation({
    latitude: -33.8688,
    longitude: 151.2093,
    accuracy: 12,
  });
  await context.grantPermissions(["geolocation"], {
    origin: new URL(serverUrl).origin,
  });
  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await page.reload();

  const result = await page.evaluate(async (pendingUrl) => {
    const hashBytes = (bytes: ArrayLike<number>): number => {
      let hash = 2166136261;
      for (let index = 0; index < bytes.length; index += 1) {
        hash = Math.imul(hash ^ (bytes[index] ?? 0), 16777619);
      }
      return hash >>> 0;
    };
    const readCanvas = (target: Window): { imageData: number; export: string } => {
      const canvas = target.document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 16;
      const context2d = canvas.getContext("2d");
      if (!context2d) {
        throw new Error("Expected 2D canvas support");
      }
      context2d.fillStyle = "#069";
      context2d.fillRect(1, 1, 24, 10);
      return {
        imageData: hashBytes(context2d.getImageData(0, 0, 32, 16).data),
        export: canvas.toDataURL(),
      };
    };
    const readWebGL = (target: Window): number | null => {
      const canvas = target.document.createElement("canvas");
      canvas.width = 4;
      canvas.height = 4;
      const gl = canvas.getContext("webgl");
      if (!gl) {
        return null;
      }
      gl.clearColor(0.25, 0.5, 0.75, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const pixels = new Uint8Array(4 * 4 * 4);
      gl.readPixels(0, 0, 4, 4, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return hashBytes(pixels);
    };

    const iframe = document.createElement("iframe");
    iframe.src = pendingUrl;
    document.body.append(iframe);
    const child = iframe.contentWindow;
    if (!child) {
      throw new Error("Expected initial iframe window");
    }

    const immediate = {
      canvas: readCanvas(child),
      devicePixelRatio: child.devicePixelRatio,
      href: child.location.href,
      language: child.navigator.language,
      parentCanvas: readCanvas(window),
      parentDevicePixelRatio: devicePixelRatio,
      parentScreen: {
        height: screen.height,
        width: screen.width,
      },
      parentWebGL: readWebGL(window),
      screen: {
        height: child.screen.height,
        width: child.screen.width,
      },
      webGL: readWebGL(child),
    };
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      child.navigator.geolocation.getCurrentPosition(resolve, reject, {
        maximumAge: 0,
        timeout: 5_000,
      });
    });
    const hrefAfterGeolocation = child.location.href;
    iframe.remove();

    return {
      ...immediate,
      hrefAfterGeolocation,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  }, `${serverUrl}/pending-frame`);

  expect(result.href).toBe("about:blank");
  expect(result.hrefAfterGeolocation).toBe("about:blank");
  expect(result.language).toBe("pl");
  expect(result.devicePixelRatio).toBe(result.parentDevicePixelRatio);
  expect(result.screen).toEqual(result.parentScreen);
  expect(result.canvas).toEqual(result.parentCanvas);
  expect(result.webGL).toBe(result.parentWebGL);
  expect(result.latitude).toBeCloseTo(52.2297, 2);
  expect(result.longitude).toBeCloseTo(21.0122, 2);

  await page.close();
});

test("does not report post-install child geolocation tampering as degradation", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await page.reload();
  const tamperResult = await page.evaluate(() => {
    const configurableFrame = document.createElement("iframe");
    document.body.append(configurableFrame);
    const configurableWindow = configurableFrame.contentWindow;
    if (!configurableWindow) {
      throw new Error("Expected a configurable-tamper child window");
    }
    const protectedGeolocation = configurableWindow.navigator.geolocation;
    const protectedMethod = protectedGeolocation.getCurrentPosition;
    const configurableDeleted = Reflect.deleteProperty(
      configurableWindow.Geolocation.prototype,
      "getCurrentPosition",
    );
    void configurableFrame.contentWindow;
    const nativeObjectIsProtected =
      protectedGeolocation.getCurrentPosition === protectedMethod;
    configurableFrame.remove();

    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    const childWindow = iframe.contentWindow;
    if (!childWindow) {
      throw new Error("Expected an about:blank child window");
    }

    const replacement = () => {
      throw new Error("hostile-child-geolocation");
    };
    Object.defineProperty(childWindow.Geolocation.prototype, "getCurrentPosition", {
      configurable: false,
      writable: false,
      value: replacement,
    });

    void iframe.contentWindow;
    return {
      configurableDeleted,
      nativeObjectRemainsProtected: nativeObjectIsProtected,
      replacementPreserved:
        childWindow.Geolocation.prototype.getCurrentPosition === replacement,
    };
  });
  expect(tamperResult).toEqual({
    configurableDeleted: true,
    nativeObjectRemainsProtected: true,
    replacementPreserved: true,
  });

  const popupPage = await openPopupPage(context, extensionId, page);
  const targetTabId = Number(new URL(popupPage.url()).searchParams.get("tabId"));
  expect(Number.isInteger(targetTabId)).toBe(true);
  const geolocationFailed = await popupPage.evaluate(
    async ({ commandType, tabId }) => {
      const response = (await chrome.runtime.sendMessage({
        type: commandType,
        tabId,
      })) as {
        failedCategories?: { geolocation?: boolean };
        ok?: boolean;
      };
      return Boolean(response.ok && response.failedCategories?.geolocation);
    },
    {
      commandType: EXTENSION_COMMAND_TYPES.getXRayState,
      tabId: targetTabId,
    },
  );
  expect(geolocationFailed).toBe(false);
  await popupPage.close();
});

test("keeps geolocation protected across same-origin iframe lifecycles", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  await context.setGeolocation({
    latitude: -33.8688,
    longitude: 151.2093,
    accuracy: 12,
  });
  await context.grantPermissions(["geolocation"], {
    origin: new URL(serverUrl).origin,
  });
  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await page.reload();
  const results = await page.evaluate(async (navigationUrl) => {
    type Result = {
      childPrototype: boolean;
      hadOwnShadow: boolean;
      latitude: number | null;
      longitude: number | null;
      permissionState: PermissionState | null;
      removed: boolean;
    };
    const probe = async (
      iframe: HTMLIFrameElement,
      options: { removeBeforeCall?: boolean } = {},
    ): Promise<Result> => {
      const childWindow = iframe.contentWindow;
      if (!childWindow) {
        throw new Error("Expected an iframe child window");
      }
      const childNavigator = childWindow.navigator;
      const geolocation = childNavigator.geolocation;
      const hadOwnShadow = Object.hasOwn(childNavigator, "geolocation");
      const removed = Reflect.deleteProperty(childNavigator, "geolocation");
      if (options.removeBeforeCall) {
        iframe.remove();
        return {
          childPrototype:
            Object.getPrototypeOf(geolocation) === childWindow.Geolocation.prototype,
          hadOwnShadow,
          latitude: null,
          longitude: null,
          permissionState: null,
          removed,
        };
      }
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        geolocation.getCurrentPosition(resolve, reject, {
          maximumAge: 0,
          timeout: 5_000,
        });
      });
      const permissionState = await childNavigator.permissions
        .query({ name: "geolocation" })
        .then(({ state }) => state);
      const result = {
        childPrototype:
          Object.getPrototypeOf(geolocation) === childWindow.Geolocation.prototype,
        hadOwnShadow,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        permissionState,
        removed,
      };
      iframe.remove();
      return result;
    };

    const detached = document.createElement("iframe");
    document.body.append(detached);
    detached.remove();
    document.body.append(detached);

    const outer = document.createElement("iframe");
    document.body.append(outer);
    const outerWindow = outer.contentWindow;
    if (!outerWindow) {
      throw new Error("Expected an outer iframe window");
    }
    const nested = outerWindow.document.createElement("iframe");
    outerWindow.document.body.append(nested);

    const navigated = document.createElement("iframe");
    document.body.append(navigated);
    const navigatedLoad = new Promise<void>((resolve) => {
      const handleLoad = (): void => {
        if (navigated.contentWindow?.location.href !== navigationUrl) {
          return;
        }
        navigated.removeEventListener("load", handleLoad);
        resolve();
      };
      navigated.addEventListener("load", handleLoad);
    });
    navigated.src = navigationUrl;
    await navigatedLoad;

    const removedFrame = document.createElement("iframe");
    document.body.append(removedFrame);

    const sandboxed = document.createElement("iframe");
    sandboxed.setAttribute("sandbox", "allow-same-origin allow-scripts");
    document.body.append(sandboxed);

    const innerHtmlContainer = document.createElement("div");
    document.body.append(innerHtmlContainer);
    innerHtmlContainer.innerHTML = "<iframe></iframe>";
    const innerHtml = innerHtmlContainer.querySelector("iframe");
    if (!innerHtml) {
      throw new Error("Expected an innerHTML iframe");
    }

    const adjacentContainer = document.createElement("div");
    document.body.append(adjacentContainer);
    adjacentContainer.insertAdjacentHTML("beforeend", "<iframe></iframe>");
    const adjacent = adjacentContainer.querySelector("iframe");
    if (!adjacent) {
      throw new Error("Expected an insertAdjacentHTML iframe");
    }

    const rangeFragment = document.createDocumentFragment();
    const rangeFrame = document.createElement("iframe");
    rangeFragment.append(rangeFrame);
    const range = document.createRange();
    range.selectNodeContents(document.body);
    range.collapse(false);
    range.insertNode(rangeFragment);

    const [
      detachedResult,
      nestedResult,
      navigatedResult,
      removedResult,
      sandboxedResult,
      innerHtmlResult,
      adjacentResult,
      rangeResult,
    ] = await Promise.all([
      probe(detached),
      probe(nested),
      probe(navigated),
      probe(removedFrame, { removeBeforeCall: true }),
      probe(sandboxed),
      probe(innerHtml),
      probe(adjacent),
      probe(rangeFrame),
    ]);
    const output = {
      detached: detachedResult,
      nested: nestedResult,
      navigated: navigatedResult,
      removed: removedResult,
      sandboxed: sandboxedResult,
      innerHTML: innerHtmlResult,
      insertAdjacentHTML: adjacentResult,
      range: rangeResult,
    };
    outer.remove();
    innerHtmlContainer.remove();
    adjacentContainer.remove();
    return output;
  }, `${serverUrl}/frame`);

  for (const [scenario, result] of Object.entries(results)) {
    expect(result).toMatchObject({
      childPrototype: true,
      hadOwnShadow: false,
      removed: true,
    });
    if (scenario === "removed") {
      expect(result).toMatchObject({
        latitude: null,
        longitude: null,
        permissionState: null,
      });
      continue;
    }
    expect(result.permissionState).toBe("granted");
    if (result.latitude === null || result.longitude === null) {
      throw new Error(`Expected spoofed coordinates for ${scenario}`);
    }
    expect(result.latitude).toBeCloseTo(52.2297, 2);
    expect(result.longitude).toBeCloseTo(21.0122, 2);
  }
});

test("brands TIMEOUT before first srcdoc scripts from every write path", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  await context.setGeolocation({
    latitude: -33.8688,
    longitude: 151.2093,
    accuracy: 12,
  });
  await context.grantPermissions(["geolocation"], {
    origin: new URL(serverUrl).origin,
  });
  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await page.reload();

  const results = await page.evaluate(async () => {
    const timeoutError = await new Promise<GeolocationPositionError>(
      (resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          () => reject(new Error("Expected a geolocation timeout")),
          resolve,
          { timeout: 0 },
        );
      },
    );
    type Result = {
      code: number | null;
      error: string | null;
      hadOwnShadow: boolean;
      latitude: number | null;
      longitude: number | null;
      permissionState: PermissionState | null;
      productSymbolPresent: boolean;
      removed: boolean;
    };
    type WriteMode = "property" | "attribute" | "attributeNS" | "csp";

    const navigate = (mode: WriteMode): Promise<Result> =>
      new Promise((resolve) => {
        const iframe = document.createElement("iframe");
        let loadCount = 0;
        const callbackKey = `__gwResolve${Math.random().toString(36).slice(2)}`;
        const errorKey = `__gwError${Math.random().toString(36).slice(2)}`;
        const parentGlobal = window as typeof window & Record<string, unknown>;
        parentGlobal[errorKey] = timeoutError;
        parentGlobal[callbackKey] = (value: Result) => {
          delete parentGlobal[callbackKey];
          delete parentGlobal[errorKey];
          iframe.remove();
          resolve(value);
        };
        iframe.addEventListener("load", () => {
          loadCount += 1;
          if (loadCount !== 1) return;
          const nonce = mode === "csp" ? "pt-probe" : "";
          const policy = nonce
            ? `<meta http-equiv="Content-Security-Policy" content="script-src 'nonce-${nonce}'">`
            : "";
          const source = `<!doctype html>${policy}<script${nonce ? ` nonce="${nonce}"` : ""}>
            (async () => {
              const getter = Object.getOwnPropertyDescriptor(
                GeolocationPositionError.prototype,
                "code"
              )?.get;
              const hadOwnShadow = Object.hasOwn(navigator, "geolocation");
              const removed = Reflect.deleteProperty(navigator, "geolocation");
              const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                  maximumAge: 0,
                  timeout: 5000
                });
              });
              const permissionState = await navigator.permissions
                .query({ name: "geolocation" })
                .then(({ state }) => state);
              parent[${JSON.stringify(callbackKey)}]({
                code: getter?.call(parent[${JSON.stringify(errorKey)}]) ?? null,
                error: null,
                hadOwnShadow,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                permissionState,
                productSymbolPresent: Object.hasOwn(
                  top,
                  Symbol.for("pt:native-sources")
                ),
                removed
              });
            })().catch((error) => {
              parent[${JSON.stringify(callbackKey)}]({
                code: null,
                error: String(error),
                hadOwnShadow: Object.hasOwn(navigator, "geolocation"),
                latitude: null,
                longitude: null,
                permissionState: null,
                productSymbolPresent: Object.hasOwn(
                  top,
                  Symbol.for("pt:native-sources")
                ),
                removed: false
              });
            });
          </script>`;

          if (mode === "property") iframe.srcdoc = source;
          else if (mode === "attributeNS")
            iframe.setAttributeNS(null, "srcdoc", source);
          else iframe.setAttribute("srcdoc", source);
        });
        document.body.append(iframe);
      });

    return {
      property: await navigate("property"),
      attribute: await navigate("attribute"),
      attributeNS: await navigate("attributeNS"),
      csp: await navigate("csp"),
    };
  });

  for (const result of Object.values(results)) {
    expect(result).toMatchObject({
      code: 3,
      error: null,
      hadOwnShadow: false,
      permissionState: "granted",
      productSymbolPresent: false,
      removed: true,
    });
    expect(result.latitude).toBeCloseTo(52.2297, 2);
    expect(result.longitude).toBeCloseTo(21.0122, 2);
  }
});

test("does not replace parent geolocation error getters from child realms", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const page = await context.newPage();
  await page.goto(new URL("/frame", serverUrl).toString());
  await page.reload();

  const result = await page.evaluate(async () => {
    const timeoutError = await new Promise<GeolocationPositionError>(
      (resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          () => reject(new Error("Expected a geolocation timeout")),
          resolve,
          { timeout: 0 },
        );
      },
    );
    const parentPrototype = GeolocationPositionError.prototype;
    const beforeCode = Object.getOwnPropertyDescriptor(parentPrototype, "code")?.get;
    const beforeMessage = Object.getOwnPropertyDescriptor(
      parentPrototype,
      "message",
    )?.get;
    const beforeGetCurrentPosition = navigator.geolocation.getCurrentPosition;
    let childReadsParentError = true;

    for (let index = 0; index < 20; index += 1) {
      const iframe = document.createElement("iframe");
      iframe.srcdoc = "<!doctype html>";
      const loaded = new Promise<void>((resolve) => {
        iframe.addEventListener("load", () => resolve(), { once: true });
      });
      document.body.append(iframe);
      await loaded;

      const childWindow = iframe.contentWindow;
      const childPrototype = childWindow?.GeolocationPositionError.prototype;
      const childCode = childPrototype
        ? Object.getOwnPropertyDescriptor(childPrototype, "code")?.get
        : undefined;
      const childMessage = childPrototype
        ? Object.getOwnPropertyDescriptor(childPrototype, "message")?.get
        : undefined;
      childReadsParentError &&=
        childCode?.call(timeoutError) === 3 &&
        childMessage?.call(timeoutError) === "Timeout expired";
      iframe.remove();
    }

    const injectedChild = document.createElement("iframe");
    injectedChild.src = new URL("/frame?getter-owner", location.href).toString();
    const injectedChildLoaded = new Promise<void>((resolve) => {
      injectedChild.addEventListener("load", () => resolve(), { once: true });
    });
    document.body.append(injectedChild);
    await injectedChildLoaded;
    const injectedChildPrototype =
      injectedChild.contentWindow?.GeolocationPositionError.prototype;
    const injectedChildCode = injectedChildPrototype
      ? Object.getOwnPropertyDescriptor(injectedChildPrototype, "code")?.get
      : undefined;
    const injectedChildMessage = injectedChildPrototype
      ? Object.getOwnPropertyDescriptor(injectedChildPrototype, "message")?.get
      : undefined;
    childReadsParentError &&=
      injectedChildCode?.call(timeoutError) === 3 &&
      injectedChildMessage?.call(timeoutError) === "Timeout expired";
    injectedChild.remove();

    const afterCode = Object.getOwnPropertyDescriptor(parentPrototype, "code")?.get;
    const afterMessage = Object.getOwnPropertyDescriptor(
      parentPrototype,
      "message",
    )?.get;
    return {
      childReadsParentError,
      codeIdentityStable: beforeCode === afterCode,
      messageIdentityStable: beforeMessage === afterMessage,
      codeRealmStable: Object.getPrototypeOf(afterCode) === Function.prototype,
      messageRealmStable: Object.getPrototypeOf(afterMessage) === Function.prototype,
      geolocationMethodIdentityStable:
        beforeGetCurrentPosition === navigator.geolocation.getCurrentPosition,
    };
  });

  expect(result).toEqual({
    childReadsParentError: true,
    codeIdentityStable: true,
    messageIdentityStable: true,
    codeRealmStable: true,
    messageRealmStable: true,
    geolocationMethodIdentityStable: true,
  });
});

test("keeps iframe geolocation native when disabled by policy", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  const settings = await readSettings(optionsPage);
  const hostname = new URL(serverUrl).hostname;
  const matchedRule = findRuleMatches(hostname, settings.rules).matchingRule;
  expect(matchedRule).toBeDefined();
  await saveLocationModel(optionsPage, {
    locations: settings.locations,
    rules: settings.rules.map((rule) =>
      rule.pattern === matchedRule?.pattern
        ? {
            ...rule,
            fingerprintSurfaceOverrides: {
              ...rule.fingerprintSurfaceOverrides,
              geolocation: false,
            },
          }
        : rule,
    ),
    containerAssignments: settings.containerAssignments ?? [],
  });
  await optionsPage.close();

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await page.reload();

  const result = await page.evaluate(async () => {
    type NativeGeoState = {
      codeGetter: (() => number) | undefined;
      geolocation: Geolocation;
      navigatorHasOwnGeolocation: boolean;
    };
    type ChildWindow = Window &
      typeof globalThis & {
        nativeGeoState?: NativeGeoState;
      };

    const iframe = document.createElement("iframe");
    iframe.srcdoc = `<!doctype html><script>
      window.nativeGeoState = {
        codeGetter: Object.getOwnPropertyDescriptor(
          GeolocationPositionError.prototype,
          "code"
        )?.get,
        geolocation: navigator.geolocation,
        navigatorHasOwnGeolocation: Object.hasOwn(navigator, "geolocation")
      };
    </script>`;
    const loaded = new Promise<void>((resolve) => {
      iframe.addEventListener("load", () => resolve(), { once: true });
    });
    document.body.append(iframe);
    await loaded;

    const childWindow = iframe.contentWindow as ChildWindow | null;
    const before = childWindow?.nativeGeoState;
    const afterGetter = childWindow
      ? Object.getOwnPropertyDescriptor(
          childWindow.GeolocationPositionError.prototype,
          "code",
        )?.get
      : undefined;
    const result = {
      getterUnchanged: !!before && before.codeGetter === afterGetter,
      geolocationUnchanged:
        !!before && before.geolocation === childWindow?.navigator.geolocation,
      ownPropertyStateUnchanged:
        !!before &&
        before.navigatorHasOwnGeolocation ===
          Object.hasOwn(childWindow?.navigator ?? {}, "geolocation"),
    };
    iframe.remove();
    return result;
  });

  expect(result).toEqual({
    getterUnchanged: true,
    geolocationUnchanged: true,
    ownPropertyStateUnchanged: true,
  });
});

test("preserves native srcdoc reflection and sandboxed or CSP-blocked content", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await page.reload();

  const reflection = await page.evaluate(() => {
    const iframe = document.createElement("iframe");
    const first = '<p id="native-reflection">first</p>';
    const second = '<p id="native-reflection">second</p>';
    iframe.srcdoc = first;
    const afterProperty = {
      property: iframe.srcdoc,
      attribute: iframe.getAttribute("srcdoc"),
      outerHTML: iframe.outerHTML,
    };
    iframe.setAttribute("srcdoc", second);
    const afterAttribute = {
      property: iframe.srcdoc,
      attribute: iframe.getAttribute("srcdoc"),
      outerHTML: iframe.outerHTML,
    };
    iframe.removeAttribute("srcdoc");
    const afterRemove = {
      property: iframe.srcdoc,
      attribute: iframe.getAttribute("srcdoc"),
      outerHTML: iframe.outerHTML,
    };
    return { afterProperty, afterAttribute, afterRemove };
  });

  expect(reflection.afterProperty.property).toBe('<p id="native-reflection">first</p>');
  expect(reflection.afterProperty.attribute).toBe(reflection.afterProperty.property);
  expect(reflection.afterProperty.outerHTML).toContain("native-reflection");
  expect(reflection.afterAttribute.property).toBe(
    '<p id="native-reflection">second</p>',
  );
  expect(reflection.afterAttribute.attribute).toBe(reflection.afterAttribute.property);
  expect(reflection.afterRemove).toEqual({
    property: "",
    attribute: null,
    outerHTML: "<iframe></iframe>",
  });
  for (const value of [
    reflection.afterProperty.outerHTML,
    reflection.afterAttribute.outerHTML,
  ]) {
    expect(value).not.toContain("pt:native-sources");
    expect(value).not.toContain("__pt");
  }

  await page.evaluate(() => {
    const sandboxed = document.createElement("iframe");
    sandboxed.id = "sandbox-srcdoc";
    sandboxed.setAttribute("sandbox", "");
    sandboxed.setAttribute("srcdoc", '<p id="native-visible">native-visible</p>');

    const cspBlocked = document.createElement("iframe");
    cspBlocked.id = "csp-srcdoc";
    cspBlocked.setAttribute(
      "srcdoc",
      '<meta http-equiv="Content-Security-Policy" content="script-src \'none\'">' +
        '<p id="csp-visible">csp-visible</p>',
    );
    document.body.append(sandboxed, cspBlocked);
  });

  await expect(
    page.frameLocator("#sandbox-srcdoc").locator("#native-visible"),
  ).toHaveText("native-visible");
  await expect(page.frameLocator("#csp-srcdoc").locator("#csp-visible")).toHaveText(
    "csp-visible",
  );
  for (const selector of ["#sandbox-srcdoc", "#csp-srcdoc"]) {
    const outerHTML = await page
      .locator(selector)
      .evaluate((element) => element.outerHTML);
    expect(outerHTML).not.toContain("pt:native-sources");
    expect(outerHTML).not.toContain("__pt");
  }
});

test("keeps the main-frame DNR rule after a hostless srcdoc background fallback", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  const settings = await readSettings(optionsPage);
  await saveSimpleSettings(optionsPage, { debugMode: true });

  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");
  const warsaw = EXAMPLE_LOCATIONS.find((location) => location.label === "Warsaw");
  if (!warsaw) throw new Error("Warsaw fixture is missing");
  await saveSimpleSettings(optionsPage, {
    globalFallbackRule: {
      enabled: true,
      locationId: warsaw.id,
    },
  });

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await page.reload();

  const serviceWorker =
    context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  const tabId = await serviceWorker.evaluate(async (targetUrl) => {
    const tabs = await chrome.tabs.query({});
    return tabs.find((tab) => tab.url === targetUrl)?.id ?? null;
  }, page.url());
  expect(tabId).not.toBeNull();

  const readTabSessionRules = async () =>
    serviceWorker.evaluate(async (targetTabId) => {
      const rules = await chrome.declarativeNetRequest.getSessionRules();
      return rules
        .filter((rule) => rule.condition.tabIds?.includes(targetTabId))
        .sort((left, right) => left.id - right.id);
    }, tabId as number);

  await expect
    .poll(async () => (await readTabSessionRules()).length)
    .toBeGreaterThan(0);
  const beforeRules = await readTabSessionRules();
  const hostname = new URL(serverUrl).hostname;
  expect(
    beforeRules.some((rule) => rule.condition.requestDomains?.includes(hostname)),
  ).toBe(true);

  await optionsPage.evaluate(
    async (commandType) => chrome.runtime.sendMessage({ type: commandType }),
    EXTENSION_COMMAND_TYPES.clearLogs,
  );
  await serviceWorker.evaluate(
    async (storageKey) => chrome.storage.session.remove(storageKey),
    STORAGE_PRELOADED_STATE,
  );

  await page.evaluate(() => {
    for (const key of Object.getOwnPropertyNames(window)) {
      let value: unknown;
      try {
        value = Reflect.get(window, key);
      } catch {
        continue;
      }
      if (!value || typeof value !== "object") continue;
      const candidate = value as Record<string, unknown>;
      if (
        candidate.geo &&
        candidate.locale &&
        candidate.date &&
        typeof candidate.debugMode === "boolean" &&
        Array.isArray(candidate.watchPositionDelay)
      ) {
        Reflect.deleteProperty(window, key);
      }
    }
  });

  await page.evaluate(() => {
    const iframe = document.createElement("iframe");
    iframe.id = "hostless-background-fallback";
    iframe.srcdoc = "<!doctype html><html><body>hostless fallback</body></html>";
    document.body.append(iframe);
  });

  await expect
    .poll(() =>
      page
        .frameLocator("#hostless-background-fallback")
        .locator("html")
        .evaluate(() => navigator.language),
    )
    .toBe("pl");
  await expect
    .poll(() =>
      optionsPage.evaluate(
        async ({ commandType, expectedTabId }) => {
          const response = (await chrome.runtime.sendMessage({
            type: commandType,
          })) as {
            logs?: Array<{
              event?: string;
              tabId?: number;
              details?: Record<string, unknown> | unknown[];
            }>;
          };
          return (
            response.logs
              ?.filter(
                (entry) =>
                  entry.event === "Bootstrap.channel-used" &&
                  entry.tabId === expectedTabId &&
                  !Array.isArray(entry.details),
              )
              .map((entry) => entry.details?.channel) ?? []
          );
        },
        {
          commandType: EXTENSION_COMMAND_TYPES.getLogs,
          expectedTabId: tabId as number,
        },
      ),
    )
    .toContain("background-message");

  // This no-op preference write queues a full header resync behind any update
  // started by the fallback, providing an observable completion barrier.
  await saveSimpleSettings(optionsPage, {
    browserFingerprintSpoofingEnabled: settings.browserFingerprintSpoofingEnabled,
  });

  expect(await readTabSessionRules()).toEqual(beforeRules);
  await optionsPage.close();
});
test("does not expose installation markers after reload in the top window", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await page.reload();
  await page.locator("#collect").click();

  const values = await readSnapshot(page);
  expect(values.language).toBe("pl");
  expect(values.timeZone).toBe("Europe/Warsaw");
  expect(values.installMarkerPresent).toBe(false);
  expect(values.earlyInstallMarkerPresent).toBe(false);
  expect(values.iframeNavigatorMarkerPresent).toBe(false);
});

test("keeps runtime control-plane, snapshots, and native registries off page globals", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await page.reload();

  const exposure = await page.evaluate(() => {
    const readOwnValue = (key: PropertyKey): unknown => {
      try {
        return Reflect.get(globalThis, key);
      } catch {
        return undefined;
      }
    };
    const isRecord = (value: unknown): value is Record<PropertyKey, unknown> =>
      typeof value === "object" && value !== null;
    const isRuntimeState = (value: unknown): boolean => {
      if (!isRecord(value)) return false;
      const native = isRecord(value.native) ? value.native : null;
      const snapshot = isRecord(value.snapshot) ? value.snapshot : null;
      return (
        value.modules instanceof Set ||
        Array.isArray(value.pendingInstallers) ||
        typeof native?.Date === "function" ||
        isRecord(snapshot?.fingerprint)
      );
    };
    const isFullSnapshot = (value: unknown): boolean =>
      isRecord(value) &&
      typeof value.authKey === "string" &&
      isRecord(value.fingerprint) &&
      isRecord(value.locale) &&
      isRecord(value.date);
    const label = (key: PropertyKey): string =>
      typeof key === "symbol"
        ? (Symbol.keyFor(key) ?? key.description ?? "<symbol>")
        : key;
    const symbols = Object.getOwnPropertySymbols(globalThis);
    const wrappedFunctions = [
      Function.prototype.toString,
      navigator.geolocation.getCurrentPosition,
    ];

    return {
      nativeRegistrySymbols: symbols
        .filter((key) => {
          const value = readOwnValue(key);
          return (
            value instanceof WeakMap && wrappedFunctions.some((fn) => value.has(fn))
          );
        })
        .map(label),
      runtimeStateSymbols: symbols
        .filter((key) => isRuntimeState(readOwnValue(key)))
        .map(label),
      suspiciousGlobals: Reflect.ownKeys(globalThis)
        .filter((key) => {
          const value = readOwnValue(key);
          return isRuntimeState(value) || isFullSnapshot(value);
        })
        .map(label),
    };
  });

  expect(exposure).toEqual({
    nativeRegistrySymbols: [],
    runtimeStateSymbols: [],
    suspiciousGlobals: [],
  });
});

test("keeps spoofed values consistent inside workers", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  test.slow();

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await page.locator("#collect-worker").click();
  const nativeWorkerValues = await readWorkerSnapshot(page);
  await assignCurrentPageProfile(context, extensionId, "Warsaw", page);
  await page.locator("#collect-worker").click();

  const values = await readWorkerSnapshot(page);
  expect(values.language).toBe("pl");
  expect(values.languages).toEqual(["pl"]);
  expect(values.locale).toBe("pl");
  expect(values.timeZone).toBe("Europe/Warsaw");
  expect(values.platform).toBe(nativeWorkerValues.platform);
  expect(values.vendor).toBe(nativeWorkerValues.vendor);
  expect(values.userAgent).toBe(nativeWorkerValues.userAgent);
  expect(values.appVersion).toBe(nativeWorkerValues.appVersion);
  expect(values.userAgentData).toEqual(nativeWorkerValues.userAgentData);
  expect(values.formattedMonthParts.some((part) => part.type === "month")).toBe(true);
});

test("keeps the worker native-mask registry off public symbols", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await page.reload();

  const value = await page.evaluate(async () => {
    const workerUrl = URL.createObjectURL(
      new Blob(
        [
          `postMessage({
            knownMarkerPresent: Object.hasOwn(
              globalThis,
              Symbol.for("native-sources")
            ),
            language: navigator.language
          });`,
        ],
        { type: "text/javascript" },
      ),
    );
    const worker = new Worker(workerUrl);

    try {
      return await new Promise<{
        knownMarkerPresent: boolean;
        language: string;
      }>((resolve, reject) => {
        worker.addEventListener("message", (event) => resolve(event.data), {
          once: true,
        });
        worker.addEventListener("error", (event) => reject(new Error(event.message)), {
          once: true,
        });
      });
    } finally {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    }
  });

  expect(value).toEqual({
    knownMarkerPresent: false,
    language: "pl",
  });
});

test("keeps worker bootstrap decoding independent from page-controlled intrinsics", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await page.reload();

  const value = await page.evaluate(async () => {
    const workerUrl = URL.createObjectURL(
      new Blob(["postMessage(42)"], { type: "text/javascript" }),
    );
    const atobDescriptor = Object.getOwnPropertyDescriptor(window, "atob");
    const fromDescriptor = Object.getOwnPropertyDescriptor(Uint8Array, "from");
    const pushDescriptor = Object.getOwnPropertyDescriptor(Array.prototype, "push");
    const decoderDescriptor = Object.getOwnPropertyDescriptor(window, "TextDecoder");
    if (!pushDescriptor) {
      throw new Error("Expected Array.prototype.push to have an own descriptor");
    }

    let worker: Worker;
    try {
      Object.defineProperty(window, "atob", {
        configurable: true,
        writable: true,
        value: () => {
          throw new Error("page-controlled atob");
        },
      });
      Object.defineProperty(Uint8Array, "from", {
        configurable: true,
        writable: true,
        value: () => {
          throw new Error("page-controlled Uint8Array.from");
        },
      });
      Object.defineProperty(Array.prototype, "push", {
        ...pushDescriptor,
        value: () => {
          throw new Error("page-controlled Array.prototype.push");
        },
      });
      Object.defineProperty(window, "TextDecoder", {
        configurable: true,
        writable: true,
        value: class PageTextDecoder {
          constructor() {
            throw new Error("page-controlled TextDecoder");
          }
        },
      });
      worker = new Worker(workerUrl);
    } finally {
      Object.defineProperty(Array.prototype, "push", pushDescriptor);
      if (atobDescriptor) {
        Object.defineProperty(window, "atob", atobDescriptor);
      } else {
        delete window.atob;
      }
      if (fromDescriptor) {
        Object.defineProperty(Uint8Array, "from", fromDescriptor);
      } else {
        delete Uint8Array.from;
      }
      if (decoderDescriptor) {
        Object.defineProperty(window, "TextDecoder", decoderDescriptor);
      } else {
        delete window.TextDecoder;
      }
    }

    try {
      return await new Promise<number>((resolve, reject) => {
        worker.addEventListener("message", (event) => resolve(event.data as number), {
          once: true,
        });
        worker.addEventListener("error", (event) => reject(new Error(event.message)), {
          once: true,
        });
      });
    } finally {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    }
  });

  expect(value).toBe(42);
});

test("keeps trusted sites free of runtime side effects, including workers", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  const nativePageValues = await page.evaluate(() => ({
    language: navigator.language,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }));
  await page.locator("#collect-worker").click();
  const nativeWorkerValues = await readWorkerSnapshot(page);

  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  const settings = await readSettings(optionsPage);
  const hostname = new URL(serverUrl).hostname;
  await saveSimpleSettings(optionsPage, {
    trustedSites: [
      ...settings.trustedSites.filter((site) => site.pattern !== hostname),
      { pattern: hostname, enabled: true },
    ],
  });
  await optionsPage.close();

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#collect").click();
  const pageValues = await readSnapshot(page);
  expect(pageValues.language).toBe(nativePageValues.language);
  expect(pageValues.timeZone).toBe(nativePageValues.timeZone);
  expect(pageValues.runtimePresent).toBe(false);
  expect(pageValues.installMarkerPresent).toBe(false);
  expect(pageValues.earlyInstallMarkerPresent).toBe(false);

  await page.locator("#worker-snapshot").evaluate((node) => {
    node.textContent = "pending";
  });
  await page.locator("#collect-worker").click();
  const workerValues = await readWorkerSnapshot(page);
  expect(workerValues.language).toBe(nativeWorkerValues.language);
  expect(workerValues.timeZone).toBe(nativeWorkerValues.timeZone);
});

test("leaves shared workers native (not spoofed) for cross-tab compatibility", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  test.slow();

  // Native mode is the explicit compatibility contract: it preserves the
  // (scriptURL, name) dedup that cross-tab applications rely on.
  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  await saveSimpleSettings(optionsPage, {
    sharedWorkerHandlingMode: "native",
  });
  await optionsPage.close();

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await page.locator("#collect-shared-worker").click();
  const nativeWorkerValues = await readSharedWorkerSnapshot(page);
  await assignCurrentPageProfile(context, extensionId, "Warsaw", page);
  await page.locator("#collect-shared-worker").click();

  const values = await readSharedWorkerSnapshot(page);
  expect(values.language).toBe(nativeWorkerValues.language);
  expect(values.languages).toEqual(nativeWorkerValues.languages);
  expect(values.locale).toBe(nativeWorkerValues.locale);
  expect(values.timeZone).toBe(nativeWorkerValues.timeZone);
  expect(values.platform).toBe(nativeWorkerValues.platform);
  expect(values.vendor).toBe(nativeWorkerValues.vendor);
  expect(values.userAgent).toBe(nativeWorkerValues.userAgent);
  expect(values.appVersion).toBe(nativeWorkerValues.appVersion);
  expect(values.formattedMonthParts.some((part) => part.type === "month")).toBe(true);
});

test("spoofs shared workers when compatibility mode is disabled", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  test.slow();

  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  await saveSimpleSettings(optionsPage, {
    sharedWorkerCompatibilityMode: false,
  });
  await optionsPage.close();

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await assignCurrentPageProfile(context, extensionId, "Warsaw", page);
  await page.locator("#collect-shared-worker").click();

  const values = await readSharedWorkerSnapshot(page);
  expect(values.language).toBe("pl");
  expect(values.languages).toEqual(["pl"]);
  expect(values.locale).toBe("pl");
  expect(values.timeZone).toBe("Europe/Warsaw");
});

test("blocks matched-page service worker registration when configured", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);

  let currentSettings = await readSettings(optionsPage);
  if (currentSettings.locations.length === 0) {
    await saveLocationModel(optionsPage, {
      locations: EXAMPLE_LOCATIONS,
      rules: currentSettings.rules,
      containerAssignments: currentSettings.containerAssignments,
    });
    currentSettings = await readSettings(optionsPage);
  }

  const warsawId = currentSettings.locations.find(
    (location) => location.label === "Warsaw",
  )?.id;
  if (!warsawId) {
    throw new Error('Expected default "Warsaw" location to exist.');
  }

  const hostname = new URL(serverUrl).hostname;
  await saveLocationModel(optionsPage, {
    locations: currentSettings.locations,
    rules: [
      ...currentSettings.rules.filter((rule) => rule.pattern !== hostname),
      {
        pattern: hostname,
        locationId: warsawId,
        enabled: true,
        blockServiceWorkerRegistration: true,
      },
    ],
    containerAssignments: currentSettings.containerAssignments,
  });
  await optionsPage.close();

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));

  await expect
    .poll(
      async () =>
        page.evaluate(() => ({
          language: navigator.language,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })),
      {
        timeout: 15_000,
        intervals: [100, 250, 500],
      },
    )
    .toEqual({
      language: "pl",
      timeZone: "Europe/Warsaw",
    });

  const snapshot = await page.evaluate(async () => {
    const registrationsBefore = await navigator.serviceWorker.getRegistrations();
    let result: { name: string; message: string } | "allowed";

    try {
      const registration = await navigator.serviceWorker.register(
        "/service-worker-probe.js",
        {
          scope: "/",
        },
      );
      await registration.unregister();
      result = "allowed";
    } catch (error) {
      result = {
        name: error instanceof DOMException ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
      };
    }

    const registrationsAfter = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrationsAfter.map((registration) => registration.unregister()),
    );

    return {
      registrationsBefore: registrationsBefore.map(
        (registration) => registration.scope,
      ),
      registrationsAfter: registrationsAfter.map((registration) => registration.scope),
      result,
    };
  });

  expect(snapshot.registrationsBefore).toEqual([]);
  expect(snapshot.registrationsAfter).toEqual([]);
  expect(snapshot.result).toMatchObject({
    name: "SecurityError",
  });
});

test("keeps intl formatting coherent after changing locale profile", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  // Seed EXAMPLE_LOCATIONS first (defaults are empty post-e559005) so mutating
  // index 0 (Warsaw) to fr-FR / Europe/Paris actually takes effect.
  await saveLocationModel(optionsPage, {
    locations: EXAMPLE_LOCATIONS,
    rules: [],
    containerAssignments: [],
  });
  const currentSettings = await readSettings(optionsPage);
  const nextProfiles = currentSettings.locations.map((profile) =>
    profile.label === "Warsaw"
      ? {
          ...profile,
          language: "fr-FR",
          languages: ["fr-FR", "fr"],
          timeZone: "Europe/Paris",
        }
      : profile,
  );
  await saveLocationModel(optionsPage, {
    locations: nextProfiles,
    rules: currentSettings.rules,
    containerAssignments: currentSettings.containerAssignments,
  });
  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await page.reload();
  await page.locator("#collect").click();

  const values = await readSnapshot(page);
  expect(values.intl.dateTimeResolvedOptions.locale).toBe("fr-FR");
  expect(values.intl.dateTimeResolvedOptions.timeZone).toBe("Europe/Paris");
  expect(values.intl.numberResolvedOptions.locale).toBe("fr-FR");
  expect(values.intl.pluralRulesResolvedOptions.locale).toBe("fr-FR");
  expect(
    values.intl.formattedNumberParts.find((part) => part.type === "decimal")?.value,
  ).toBe(",");
  expect(
    values.intl.formattedMonthParts.find((part) => part.type === "month")?.value,
  ).toContain("janv");
  expect(values.intl.pluralCategory).toBe(new Intl.PluralRules("fr-FR").select(2));
});

// Verify that iframes inserted via DocumentFragment bypass are patched before
// the caller can access their window via self[n]. This is the pattern used by
// CreepJS's getPhantomIframe() which triggered hasToStringProxy detection.
test("patches Function.prototype.toString in iframes inserted via DocumentFragment", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await page.reload();

  const result = await page.evaluate(() => {
    const previousCount = window.length;
    const fragment = document.createDocumentFragment();
    const iframe = document.createElement("iframe");
    fragment.appendChild(iframe);
    document.body.appendChild(fragment);
    const iframeWin = window[previousCount] as Window | undefined;
    if (!iframeWin) {
      return { patched: false, reason: "no iframe window at index" };
    }
    const source = iframeWin.Function.prototype.toString.call(
      iframeWin.Function.prototype.toString,
    );
    return { patched: source.includes("[native code]"), source };
  });

  expect(result.patched).toBe(true);
});

// Verify that accessing an iframe window via contentDocument.defaultView
// triggers patching before the caller can observe a fresh realm toString.
test("patches Function.prototype.toString when iframe window accessed via contentDocument.defaultView", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await page.reload();

  const result = await page.evaluate(() => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    const iframeWin = doc?.defaultView;
    if (!iframeWin) {
      return { patched: false, reason: "no defaultView" };
    }
    const source = iframeWin.Function.prototype.toString.call(
      iframeWin.Function.prototype.toString,
    );
    return { patched: source.includes("[native code]"), source };
  });

  expect(result.patched).toBe(true);
});

// Verify that iframes inserted via innerHTML are eventually patched via the
// MutationObserver hook. The observer fires as a microtask, so the test yields
// before checking.
test("patches Function.prototype.toString in iframes inserted via innerHTML", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await page.reload();

  const result = await page.evaluate(async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    container.innerHTML = "<iframe></iframe>";
    // Yield so the MutationObserver microtask can fire.
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    const iframe = container.querySelector("iframe") as HTMLIFrameElement | null;
    const iframeWin = iframe?.contentWindow;
    if (!iframeWin) {
      return { patched: false, reason: "no contentWindow" };
    }
    const source = iframeWin.Function.prototype.toString.call(
      iframeWin.Function.prototype.toString,
    );
    return { patched: source.includes("[native code]"), source };
  });

  expect(result.patched).toBe(true);
});

// Verify that iframes inserted via Range.insertNode with a DocumentFragment
// are patched before the caller can access their window.
test("patches Function.prototype.toString in iframes inserted via Range.insertNode", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  await assignDomainProfile(context, extensionId, serverUrl, "Warsaw");

  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));
  await page.reload();

  const result = await page.evaluate(() => {
    const previousCount = window.length;
    const fragment = document.createDocumentFragment();
    const iframe = document.createElement("iframe");
    fragment.appendChild(iframe);
    const range = document.createRange();
    range.selectNodeContents(document.body);
    range.collapse(false);
    range.insertNode(fragment);
    const iframeWin = window[previousCount] as Window | undefined;
    if (!iframeWin) {
      return { patched: false, reason: "no iframe window at index" };
    }
    const source = iframeWin.Function.prototype.toString.call(
      iframeWin.Function.prototype.toString,
    );
    return { patched: source.includes("[native code]"), source };
  });

  expect(result.patched).toBe(true);
});
