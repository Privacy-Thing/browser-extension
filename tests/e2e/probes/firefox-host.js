/* global clearTimeout, document, navigator, screen, setTimeout */

globalThis.collectFirefoxRuntimeSnapshot = async () => {
  try {
    let dateFormatAccessError = null;
    try {
      void Intl.DateTimeFormat.prototype.format;
    } catch (error) {
      dateFormatAccessError = error instanceof Error ? error.name : String(error);
    }

    const snapshot = {
      geolocationGetCurrentPositionSource:
        navigator.geolocation.getCurrentPosition.toString(),
      geolocationGetCurrentPositionOwnNames: Object.getOwnPropertyNames(
        navigator.geolocation.getCurrentPosition,
      ).sort(),
      geolocationGetCurrentPositionHasPrototype:
        "prototype" in navigator.geolocation.getCurrentPosition,
      geolocationWatchPositionSource: navigator.geolocation.watchPosition.toString(),
      geolocationWatchPositionOwnNames: Object.getOwnPropertyNames(
        navigator.geolocation.watchPosition,
      ).sort(),
      geolocationWatchPositionHasPrototype:
        "prototype" in navigator.geolocation.watchPosition,
      geolocationClearWatchSource: navigator.geolocation.clearWatch.toString(),
      geolocationClearWatchOwnNames: Object.getOwnPropertyNames(
        navigator.geolocation.clearWatch,
      ).sort(),
      geolocationClearWatchHasPrototype:
        "prototype" in navigator.geolocation.clearWatch,
      dateGetTimezoneOffsetSource: Date.prototype.getTimezoneOffset.toString(),
      dateToStringSource: Date.prototype.toString.toString(),
      dateToDateStringSource: Date.prototype.toDateString.toString(),
      dateToTimeStringSource: Date.prototype.toTimeString.toString(),
      dateToLocaleStringSource: Date.prototype.toLocaleString.toString(),
      dateToLocaleDateStringSource: Date.prototype.toLocaleDateString.toString(),
      dateToLocaleTimeStringSource: Date.prototype.toLocaleTimeString.toString(),
      language: navigator.language,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor,
      appVersion: navigator.appVersion,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory:
        "deviceMemory" in navigator ? (navigator.deviceMemory ?? null) : null,
      screen:
        typeof screen === "undefined"
          ? null
          : {
              width: screen.width,
              height: screen.height,
              availWidth: screen.availWidth,
              availHeight: screen.availHeight,
              colorDepth: screen.colorDepth,
              pixelDepth: screen.pixelDepth,
              devicePixelRatio: globalThis.devicePixelRatio,
            },
      audio: null,
      runtimePresent: Boolean(globalThis.__PT_RUNTIME__),
      runtimeInstalled: Boolean(globalThis.__PT_RUNTIME_INSTALLED__),
      earlyRuntimeInstalled: Boolean(globalThis.__PT_RUNTIME_EARLY_INSTALLED__),
      runtimeConfigPresent: Boolean(
        document.querySelector("script[data-pt-runtime-config]"),
      ),
      runtimeScriptPresent: Boolean(document.querySelector("script[data-pt-runtime]")),
      dateConstructorSource: Date.toString(),
      dateConstructorOwnNames: Object.getOwnPropertyNames(Date).sort(),
      dateConstructorDescriptorKeys: Object.keys(
        Object.getOwnPropertyDescriptors(Date),
      ).sort(),
      datePrototypeConstructorMatches: Date.prototype.constructor === Date,
      dateTimeFormatConstructorSource: Intl.DateTimeFormat.toString(),
      dateTimeFormatConstructorOwnNames: Object.getOwnPropertyNames(
        Intl.DateTimeFormat,
      ).sort(),
      dateTimeFormatConstructorDescriptorKeys: Object.keys(
        Object.getOwnPropertyDescriptors(Intl.DateTimeFormat),
      ).sort(),
      dateTimeFormatPrototypeConstructorMatches:
        Intl.DateTimeFormat.prototype.constructor === Intl.DateTimeFormat,
      dateTimeFormatSupportedLocalesSource:
        Intl.DateTimeFormat.supportedLocalesOf.toString(),
      dateTimeFormatResolvedOptionsSource:
        Intl.DateTimeFormat.prototype.resolvedOptions.toString(),
      dateTimeFormatFormatToPartsSource:
        Intl.DateTimeFormat.prototype.formatToParts.toString(),
      dateTimeFormatFormatRangeSource:
        Intl.DateTimeFormat.prototype.formatRange.toString(),
      dateTimeFormatFormatRangeToPartsSource:
        Intl.DateTimeFormat.prototype.formatRangeToParts.toString(),
      dateTimeFormatFormatGetterSource:
        Object.getOwnPropertyDescriptor(
          Intl.DateTimeFormat.prototype,
          "format",
        )?.get?.toString() ?? null,
      dateTimeFormatFormatGetterName:
        Object.getOwnPropertyDescriptor(Intl.DateTimeFormat.prototype, "format")?.get
          ?.name ?? null,
      dateTimeFormatFormatPrototypeAccessError: dateFormatAccessError,
      permissions: {},
    };

    try {
      const geolocationPermission = await navigator.permissions.query({
        name: "geolocation",
      });
      snapshot.permissions.geolocation = geolocationPermission.state;
    } catch (error) {
      snapshot.permissionsError =
        error instanceof Error ? error.message : String(error);
    }

    try {
      if (typeof globalThis.OfflineAudioContext === "function") {
        const audioContext = new globalThis.OfflineAudioContext(1, 4096, 44100);
        const oscillator = audioContext.createOscillator();
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(10_000, audioContext.currentTime);
        const compressor = audioContext.createDynamicsCompressor();
        oscillator.connect(compressor);
        compressor.connect(audioContext.destination);
        oscillator.start(0);

        const renderedBuffer = await audioContext.startRendering();
        const channelData = renderedBuffer.getChannelData(0);
        snapshot.audio = {
          sampleRate: renderedBuffer.sampleRate,
          channelDataSample: Array.from(channelData.slice(0, 20)),
          channelDataLength: channelData.length,
        };
      }
    } catch (error) {
      snapshot.audio = {
        error: error instanceof Error ? error.message : String(error),
      };
    }

    try {
      snapshot.geo = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error("Timed out waiting for geolocation"));
        }, 1_500);

        navigator.geolocation.getCurrentPosition(
          (position) => {
            clearTimeout(timeoutId);
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              timestamp: position.timestamp,
            });
          },
          (error) => {
            clearTimeout(timeoutId);
            reject(new Error(error.message));
          },
        );
      });
    } catch (error) {
      snapshot.geoError = error instanceof Error ? error.message : String(error);
    }

    document.querySelector("#snapshot").textContent = JSON.stringify(snapshot);
    return snapshot;
  } catch (error) {
    const failure = {
      probeError: error instanceof Error ? error.message : String(error),
      probeStack: error instanceof Error ? (error.stack ?? null) : null,
      runtimePresent: Boolean(globalThis.__PT_RUNTIME__),
      runtimeInstalled: Boolean(globalThis.__PT_RUNTIME_INSTALLED__),
      earlyRuntimeInstalled: Boolean(globalThis.__PT_RUNTIME_EARLY_INSTALLED__),
      runtimeConfigPresent: Boolean(
        document.querySelector("script[data-pt-runtime-config]"),
      ),
      runtimeScriptPresent: Boolean(document.querySelector("script[data-pt-runtime]")),
    };

    document.querySelector("#snapshot").textContent = JSON.stringify(failure);
    return failure;
  }
};

document
  .querySelector("#collect")
  .addEventListener("click", () => void globalThis.collectFirefoxRuntimeSnapshot());
