import {
  CHROME_TEST_LOCAL_KEY,
  CHROME_TEST_SESSION_KEY,
  TEST_COOKIE_FRAGMENT,
} from "./probe-state";

export const CHROMIUM_PAGE_SCRIPT = String.raw`
  const serializeIntoElement = (selector, value) => {
    const target = document.querySelector(selector);
    if (target) {
      target.textContent = JSON.stringify(value);
    }
    return value;
  };

  const serializeError = (error) => ({
    error: error instanceof Error ? error.message : String(error)
  });

  const readHighEntropyClientHints = async () => {
    if (!navigator.userAgentData) {
      return null;
    }

    return {
      platform: navigator.userAgentData.platform,
      mobile: navigator.userAgentData.mobile,
      brands: navigator.userAgentData.brands,
      highEntropyValues: await navigator.userAgentData.getHighEntropyValues([
        "architecture",
        "bitness",
        "wow64",
        "formFactors",
        "platformVersion",
        "uaFullVersion",
        "fullVersionList"
      ])
    };
  };

  const WATCH_TIMEOUT_MS = 5000;

  const readGeolocationPermission = async () => {
    if (!("permissions" in navigator) || typeof navigator.permissions?.query !== "function") {
      return {
        geolocation: "missing",
        geolocationTag: null,
        geolocationPrototypeName: null
      };
    }

    const geolocationPermission = await navigator.permissions.query({
      name: "geolocation"
    });

    return {
      geolocation: geolocationPermission.state,
      geolocationTag: Object.prototype.toString.call(geolocationPermission),
      geolocationPrototypeName:
        Object.getPrototypeOf(geolocationPermission)?.constructor?.name ?? null
    };
  };

  const readNavigatorSnapshot = async () => {
    const sampleDate = new Date(Date.UTC(2020, 0, 15, 12, 0, 0));
    const dateNowEpochMs = Date.now();
    const now = new Date(dateNowEpochMs);
    const numberFormat = new Intl.NumberFormat();
    const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
      month: "long",
      timeZoneName: "short"
    });
    const pluralRules = new Intl.PluralRules();
    const webdriverGetter = Object.getOwnPropertyDescriptor(
      Navigator.prototype,
      "webdriver"
    )?.get;
    const functionToString = Function.prototype.toString;

    return {
      language: navigator.language,
      languages: navigator.languages,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      platform: navigator.platform,
      vendor: navigator.vendor,
      vendorSub: "vendorSub" in navigator ? navigator.vendorSub : null,
      productSub: "productSub" in navigator ? navigator.productSub : null,
      webdriver: navigator.webdriver,
      userAgent: navigator.userAgent,
      appVersion: navigator.appVersion,
      permissions: await readGeolocationPermission(),
      userAgentData: await readHighEntropyClientHints().catch(() => null),
      installMarkerPresent: "__PT_RUNTIME_INSTALLED__" in globalThis,
      earlyInstallMarkerPresent: "__PT_RUNTIME_EARLY_INSTALLED__" in globalThis,
      iframeNavigatorMarkerPresent: Object.getOwnPropertyNames(navigator).includes(
        "__pt_patched"
      ),
      runtimeLanguage: globalThis.__PT_RUNTIME__?.locale?.language ?? null,
      serverEpochMs: globalThis.__TEST_SERVER_EPOCH_MS__ ?? null,
      dateNowEpochMs,
      constructedNowEpochMs: now.getTime(),
      performanceEpochMs: performance.timeOrigin + performance.now(),
      runtimePresent: Boolean(globalThis.__PT_RUNTIME__),
      languageGetterSource:
        Object.getOwnPropertyDescriptor(Navigator.prototype, "language")?.get?.toString() ?? null,
      webdriverGetterSource: webdriverGetter?.toString() ?? null,
      webdriverPrototypeAccessThrows: (() => {
        try {
          return Navigator.prototype.webdriver;
        } catch (error) {
          return error instanceof TypeError;
        }
      })(),
      webdriverCallThrows: (() => {
        try {
          return webdriverGetter ? webdriverGetter.call(Navigator.prototype) : false;
        } catch (error) {
          return error instanceof TypeError;
        }
      })(),
      userAgentGetterSource:
        Object.getOwnPropertyDescriptor(Navigator.prototype, "userAgent")?.get?.toString() ??
        null,
      functionToStringHasPrototype: "prototype" in functionToString,
      functionToStringNewThrows: (() => {
        try {
          new functionToString();
          return false;
        } catch (error) {
          return error instanceof TypeError;
        }
      })(),
      intl: {
        dateTimeResolvedOptions: Intl.DateTimeFormat().resolvedOptions(),
        numberResolvedOptions: numberFormat.resolvedOptions(),
        pluralRulesResolvedOptions: pluralRules.resolvedOptions(),
        formattedNumber: numberFormat.format(1234.5),
        formattedNumberParts: numberFormat.formatToParts(1234.5),
        sampleDateEpochMs: sampleDate.getTime(),
        sampleDateLocaleString: sampleDate.toLocaleString(),
        sampleDateLocaleDateString: sampleDate.toLocaleDateString(),
        sampleDateLocaleTimeString: sampleDate.toLocaleTimeString(),
        liveDateLocaleString: now.toLocaleString(),
        liveDateLocaleDateString: now.toLocaleDateString(),
        liveDateLocaleTimeString: now.toLocaleTimeString(),
        formattedMonthParts: dateTimeFormat.formatToParts(sampleDate),
        pluralCategory: pluralRules.select(2)
      }
    };
  };

  const readCurrentPosition = async () => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          }),
        (error) => reject(new Error(error.message))
      );
    });
  };

  const hashBytes = (bytes) => {
    let hash = 2166136261;
    for (let index = 0; index < bytes.length; index += 1) {
      hash = Math.imul(hash ^ bytes[index], 16777619);
    }
    return hash >>> 0;
  };

  const hashText = (value) => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
    }
    return hash >>> 0;
  };

  const readCanvasFingerprint = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }

    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("Privacy Thing E2E", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("fingerprint test", 4, 35);
    const fullReadback = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    const toDataURL = canvas.toDataURL();

    return {
      toDataURL,
      toDataURLHash: hashText(toDataURL),
      imageDataHash: hashBytes(fullReadback),
      imageDataSample: Array.from(fullReadback.slice(0, 10 * 10 * 4))
    };
  };

  const readWebGLFingerprint = () => {
    const glCanvas = document.createElement("canvas");
    glCanvas.width = 4;
    glCanvas.height = 4;
    const gl = glCanvas.getContext("webgl");
    if (!gl) {
      return null;
    }

    gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    gl.clearColor(0.25, 0.5, 0.75, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    const readPixels = new Uint8Array(glCanvas.width * glCanvas.height * 4);
    gl.readPixels(0, 0, glCanvas.width, glCanvas.height, gl.RGBA, gl.UNSIGNED_BYTE, readPixels);

    return {
      debugExtensionAvailable: debugInfo !== null,
      renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : null,
      vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : null,
      supportedExtensions: gl.getSupportedExtensions(),
      readPixelsHash: hashBytes(readPixels),
      readPixelsSample: Array.from(readPixels)
    };
  };

  const readAudioFingerprint = async () => {
    const audioCtx = new OfflineAudioContext(1, 4096, 44100);
    const oscillator = audioCtx.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(10000, audioCtx.currentTime);
    const compressor = audioCtx.createDynamicsCompressor();
    oscillator.connect(compressor);
    compressor.connect(audioCtx.destination);
    oscillator.start(0);

    const renderedBuffer = await audioCtx.startRendering();
    const channelData = renderedBuffer.getChannelData(0);

    return {
      sampleRate: renderedBuffer.sampleRate,
      channelDataSample: Array.from(channelData.slice(0, 20)),
      channelDataLength: channelData.length,
      channelDataHash: hashBytes(new Uint8Array(channelData.buffer))
    };
  };

  const readWebRTCFingerprint = async () => {
    if (typeof RTCPeerConnection === "undefined") {
      return null;
    }

    const pc = new RTCPeerConnection({ iceServers: [] });
    try {
      const webRTC = {
        iceTransportPolicy: pc.getConfiguration().iceTransportPolicy
      };

      try {
        pc.createDataChannel("test");
        const offer = await pc.createOffer();
        webRTC.sdpOffer = offer.sdp ?? null;
      } catch (error) {
        webRTC.sdpError = error instanceof Error ? error.message : String(error);
      }

      return webRTC;
    } finally {
      pc.close();
    }
  };

  const readClientHintsFingerprint = async () => {
    if (!navigator.userAgentData) {
      return null;
    }

    const highEntropyValues = await navigator.userAgentData.getHighEntropyValues([
      "architecture",
      "bitness",
      "platformVersion",
      "model",
      "formFactors",
      "wow64",
      "fullVersionList",
      "uaFullVersion",
      "mobile",
      "platform"
    ]);

    return {
      brands: navigator.userAgentData.brands,
      mobile: navigator.userAgentData.mobile,
      platform: navigator.userAgentData.platform,
      highEntropyValues
    };
  };

  globalThis.collectRuntimeSnapshot = async () => {
    try {
      const snapshot = await readNavigatorSnapshot();

      try {
        snapshot.geo = await readCurrentPosition();
      } catch (error) {
        snapshot.geoError = error instanceof Error ? error.message : String(error);
      }

      return serializeIntoElement("#snapshot", snapshot);
    } catch (error) {
      return serializeIntoElement("#snapshot", serializeError(error));
    }
  };

  globalThis.collectRuntimeWatchSnapshot = async () => {
    try {
      const updates = [];
      let watchId = 0;

      const status = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          navigator.geolocation.clearWatch(watchId);
          resolve("timeout");
        }, WATCH_TIMEOUT_MS);
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            updates.push({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp
            });

            if (updates.length >= 2) {
              clearTimeout(timeoutId);
              navigator.geolocation.clearWatch(watchId);
              resolve("completed");
            }
          },
          (error) => {
            clearTimeout(timeoutId);
            navigator.geolocation.clearWatch(watchId);
            reject(new Error(error.message));
          }
        );
      });

      return serializeIntoElement("#watch-snapshot", {
        updates,
        status,
        timeoutMs: WATCH_TIMEOUT_MS
      });
    } catch (error) {
      return serializeIntoElement("#watch-snapshot", {
        updates: [],
        status: "error",
        timeoutMs: WATCH_TIMEOUT_MS,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };

  globalThis.collectRuntimeWorkerSnapshot = async () => {
    const worker = new Worker("/worker-probe.js");

    try {
      const snapshot = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error("Timed out waiting for worker snapshot"));
        }, 2000);

        worker.addEventListener(
          "message",
          (event) => {
            clearTimeout(timeoutId);
            resolve(event.data);
          },
          { once: true }
        );

        worker.addEventListener(
          "error",
          (event) => {
            clearTimeout(timeoutId);
            reject(
              new Error(
                "WORKER_ERROR_EVENT | type: " +
                  event.type +
                  " | message: " +
                  (event.message || "undefined") +
                  " | isErrorEvent: " +
                  (event instanceof ErrorEvent)
              )
            );
          },
          { once: true }
        );

        worker.addEventListener(
          "messageerror",
          () => {
            clearTimeout(timeoutId);
            reject(new Error("Worker messageerror fired"));
          },
          { once: true }
        );

        worker.postMessage({ serverEpochMs: globalThis.__TEST_SERVER_EPOCH_MS__ ?? null });
      });

      return serializeIntoElement("#worker-snapshot", snapshot);
    } catch (error) {
      return serializeIntoElement("#worker-snapshot", serializeError(error));
    } finally {
      worker.terminate();
    }
  };

  globalThis.collectRuntimeSharedWorkerSnapshot = async () => {
    if (typeof SharedWorker === "undefined") {
      return serializeIntoElement("#shared-worker-snapshot", {
        unsupported: true
      });
    }

    const worker = new SharedWorker("/shared-worker-probe.js");
    const port = worker.port;

    try {
      const snapshot = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error("Timed out waiting for shared worker snapshot"));
        }, 2000);

        port.addEventListener(
          "message",
          (event) => {
            clearTimeout(timeoutId);
            resolve(event.data);
          },
          { once: true }
        );

        port.addEventListener(
          "messageerror",
          () => {
            clearTimeout(timeoutId);
            reject(new Error("Shared worker messageerror fired"));
          },
          { once: true }
        );

        port.start();
        port.postMessage("collect");
      });

      return serializeIntoElement("#shared-worker-snapshot", snapshot);
    } catch (error) {
      return serializeIntoElement("#shared-worker-snapshot", serializeError(error));
    } finally {
      port.close();
    }
  };

  globalThis.collectRuntimeServiceWorkerSnapshot = async () => {
    if (!("serviceWorker" in navigator) || !navigator.serviceWorker) {
      return serializeIntoElement("#service-worker-snapshot", {
        unsupported: true
      });
    }

    try {
      const registration = await navigator.serviceWorker.register("/service-worker-probe.js", {
        scope: "/"
      });
      await navigator.serviceWorker.ready;

      const worker =
        navigator.serviceWorker.controller ??
        registration.active ??
        registration.waiting ??
        registration.installing;
      if (!worker) {
        throw new Error("No active service worker after registration");
      }

      const channel = new MessageChannel();
      const snapshot = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error("Timed out waiting for service worker snapshot"));
        }, 2500);

        channel.port1.addEventListener(
          "message",
          (event) => {
            clearTimeout(timeoutId);
            resolve(event.data);
          },
          { once: true }
        );
        channel.port1.addEventListener(
          "messageerror",
          () => {
            clearTimeout(timeoutId);
            reject(new Error("Service worker messageerror fired"));
          },
          { once: true }
        );
        channel.port1.start();
        worker.postMessage("collect", [channel.port2]);
      });

      return serializeIntoElement("#service-worker-snapshot", snapshot);
    } catch (error) {
      return serializeIntoElement("#service-worker-snapshot", serializeError(error));
    }
  };

  globalThis.seedHostState = () => {
    document.cookie = ${JSON.stringify(`${TEST_COOKIE_FRAGMENT}; path=/`)};
    localStorage.setItem(${JSON.stringify(CHROME_TEST_LOCAL_KEY)}, "present");
    sessionStorage.setItem(${JSON.stringify(CHROME_TEST_SESSION_KEY)}, "present");

    return serializeIntoElement("#host-state", {
      cookie: document.cookie,
      localStorage: localStorage.getItem(${JSON.stringify(CHROME_TEST_LOCAL_KEY)}),
      sessionStorage: sessionStorage.getItem(${JSON.stringify(CHROME_TEST_SESSION_KEY)})
    });
  };

  globalThis.collectHostState = () => {
    return serializeIntoElement("#host-state", {
      cookie: document.cookie,
      localStorage: localStorage.getItem(${JSON.stringify(CHROME_TEST_LOCAL_KEY)}),
      sessionStorage: sessionStorage.getItem(${JSON.stringify(CHROME_TEST_SESSION_KEY)})
    });
  };

  globalThis.collectFingerprintSnapshot = async () => {
    try {
      const snapshot = {
        screen: {
          width: screen.width,
          height: screen.height,
          availWidth: screen.availWidth,
          availHeight: screen.availHeight,
          colorDepth: screen.colorDepth,
          pixelDepth: screen.pixelDepth,
          devicePixelRatio: window.devicePixelRatio
        },
        navigator: {
          hardwareConcurrency: navigator.hardwareConcurrency,
          deviceMemory: "deviceMemory" in navigator ? navigator.deviceMemory : null,
          platform: navigator.platform,
          userAgent: navigator.userAgent,
          vendor: navigator.vendor,
          appVersion: navigator.appVersion
        }
      };

      try {
        snapshot.canvas = readCanvasFingerprint();
      } catch (error) {
        snapshot.canvas = serializeError(error);
      }

      try {
        snapshot.webGL = readWebGLFingerprint();
      } catch (error) {
        snapshot.webGL = serializeError(error);
      }

      try {
        snapshot.audio = await readAudioFingerprint();
      } catch (error) {
        snapshot.audio = serializeError(error);
      }

      try {
        snapshot.webRTC = await readWebRTCFingerprint();
      } catch (error) {
        snapshot.webRTC = serializeError(error);
      }

      try {
        snapshot.clientHints = await readClientHintsFingerprint();
      } catch (error) {
        snapshot.clientHints = serializeError(error);
      }

      return serializeIntoElement("#fingerprint-snapshot", snapshot);
    } catch (error) {
      return serializeIntoElement("#fingerprint-snapshot", serializeError(error));
    }
  };

  const bindButton = (selector, action) => {
    const button = document.querySelector(selector);
    if (!button) {
      return;
    }
    button.addEventListener("click", () => void action());
  };

  bindButton("#collect", globalThis.collectRuntimeSnapshot);
  bindButton("#collect-watch", globalThis.collectRuntimeWatchSnapshot);
  bindButton("#collect-worker", globalThis.collectRuntimeWorkerSnapshot);
  bindButton("#collect-shared-worker", globalThis.collectRuntimeSharedWorkerSnapshot);
  bindButton("#collect-service-worker", globalThis.collectRuntimeServiceWorkerSnapshot);
  bindButton("#seed-state", globalThis.seedHostState);
  bindButton("#read-state", globalThis.collectHostState);
  bindButton("#collect-fingerprint", globalThis.collectFingerprintSnapshot);
`;
