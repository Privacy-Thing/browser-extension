export const WORKER_NAV_PATCH_SOURCE = `  const installNavigatorPatch = () => {
    const nav = globalThis.navigator;
    if (!nav) {
      return;
    }

    const logLocale = createWorkerLogger("Locale");
    const logLocaleOnce = createWorkerOnceLogger("Locale");
    const logNavigator = createWorkerLogger("Navigator");
    const logNavigatorOnce = createWorkerOnceLogger("Navigator");

    const target =
      typeof WorkerNavigator !== "undefined"
        ? WorkerNavigator.prototype
        : Object.getPrototypeOf(nav);
    if (!target) {
      return;
    }

    logNavigator("install", [], {
      hasFingerprint: !!snapshot.fingerprint
    });

    if (snapshot.timeLocaleEnabled !== false && snapshot.locale) {
      logLocale("install", [], {
        language: snapshot.locale.language,
        languages: cloneLocaleLanguages(snapshot.locale.languages)
      });
      installLocaleGetters(
        (property, getter) => defineGetter(target, property, () => {
          const value = getter();
          logLocaleOnce(\`get \${property}\`, [], value);
          return value;
        }),
        {
          language: () => snapshot.locale.language,
          languages: () => snapshot.locale.languages
        }
      );
    }

    const navigatorReaders = createNavigatorReaders(
      () => snapshot.fingerprint
    );
    installNavigatorGetters({
      readers: navigatorReaders,
      defineGetter: (property, getter) => defineGetter(target, property, () => {
        const value = getter();
        if (value !== undefined) {
          logNavigatorOnce(\`get \${property}\`, [], value);
        }
        return value;
      }),
      hasProperty: (property) => property in nav
    });
  };`;

export const WORKER_HINTS_SOURCE = `  const installClientHintsPatch = () => {
    if (!isFpSurfaceEnabled(snapshot.fingerprint, "clientHints")) {
      return;
    }

    const clientHints = snapshot.fingerprint?.clientHints;
    if (!clientHints || !("userAgentData" in navigator)) {
      return;
    }

    const userAgentData = navigator.userAgentData;
    if (!userAgentData) {
      return;
    }

    const logClientHints = createWorkerLogger("ClientHints");
    const logClientHintsOnce = createWorkerOnceLogger("ClientHints");
    logClientHints("install", [], {
      hasBrands: !!clientHints.brands?.length,
      hasMobile: typeof clientHints.mobile === "boolean",
      hasPlatform: !!clientHints.platform
    });

    const target = Object.getPrototypeOf(userAgentData) ?? userAgentData;
    if (clientHints.brands) {
      defineGetter(target, "brands", () => {
        const value = cloneClientHintBrands(clientHints.brands);
        logClientHintsOnce("get brands", [], value);
        return value;
      });
    }

    if (typeof clientHints.mobile === "boolean") {
      defineGetter(target, "mobile", () => {
        logClientHintsOnce("get mobile", [], clientHints.mobile);
        return clientHints.mobile;
      });
    }

    if (clientHints.platform) {
      defineGetter(target, "platform", () => {
        logClientHintsOnce("get platform", [], clientHints.platform);
        return clientHints.platform;
      });
    }

    if (userAgentData.toJSON) {
      Object.defineProperty(target, "toJSON", {
        configurable: true,
        value: maskAsNative({ toJSON() {
          const result = {
            ...(clientHints.brands
              ? { brands: cloneClientHintBrands(clientHints.brands) }
              : {}),
            ...(typeof clientHints.mobile === "boolean" ? { mobile: clientHints.mobile } : {}),
            ...(clientHints.platform ? { platform: clientHints.platform } : {})
          };
          logClientHintsOnce("toJSON", [], result);
          return result;
        } }.toJSON, createNativeSource("toJSON"))
      });
    }

    const nativeGetEntropyValues = userAgentData.getHighEntropyValues;
    if (!nativeGetEntropyValues) {
      return;
    }

    Object.defineProperty(target, "getHighEntropyValues", {
      configurable: true,
      value: maskAsNative({ async getHighEntropyValues(hints) {
        await Reflect.apply(nativeGetEntropyValues, this, [hints]);
        const result = {
          ...(clientHints.brands
            ? { brands: cloneClientHintBrands(clientHints.brands) }
            : {}),
          ...(typeof clientHints.mobile === "boolean" ? { mobile: clientHints.mobile } : {}),
          ...(clientHints.platform ? { platform: clientHints.platform } : {})
        };

        for (const hint of hints) {
          const getter = Object.hasOwn(HIGH_ENTROPY_GETTERS, hint)
            ? HIGH_ENTROPY_GETTERS[hint]
            : undefined;
          if (!getter) {
            continue;
          }

          const value = getter(clientHints);
          if (value !== undefined) {
            result[hint] = value;
          }
        }

        logClientHintsOnce("getHighEntropyValues", [hints], result);
        return result;
      } }.getHighEntropyValues, createNativeSource("getHighEntropyValues"))
    });
  };`;
