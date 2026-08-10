import type {
  FirefoxShimState,
  FirefoxWindowSeedState,
} from "@privacy-brand/refract-browser/common/firefox-shim-state";

import type { RuntimeSnapshot } from "@/shared/types";

type MainWorldSnapshotInput = {
  snapshot: RuntimeSnapshot | null;
  readyEvent: string;
  markerAttr: string;
  payloadAttr: string;
  offAttr: string;
  disabled?: boolean;
};

export const setMainWorldSnapshot = ({
  snapshot,
  readyEvent,
  markerAttr,
  payloadAttr,
  offAttr,
  disabled = false,
}: MainWorldSnapshotInput): void => {
  const runtimeConfigSelector = `script[type="application/json"][data-${markerAttr}]`;

  const findExisting = (): HTMLScriptElement | null => {
    return document.querySelector<HTMLScriptElement>(runtimeConfigSelector);
  };

  const existing = findExisting();

  if (disabled) {
    existing?.remove();
    document.documentElement?.setAttribute(offAttr, "");
    return;
  }

  document.documentElement?.removeAttribute(offAttr);

  const syncDomSnapshot = (): void => {
    if (!snapshot) {
      existing?.remove();
      return;
    }

    const root = document.documentElement ?? document.head ?? document.body;
    if (!root) {
      return;
    }

    const nextElement = existing ?? document.createElement("script");
    nextElement.type = "application/json";
    nextElement.setAttribute(`data-${markerAttr}`, "");
    const json = JSON.stringify(snapshot);
    // Skip createPolicy: calling it with a name that violates the page's
    // trusted-types directive fires securitypolicyviolation synchronously even
    // when caught. Use data attribute (not a TrustedScript sink) instead.
    if ((globalThis as Record<string, unknown>)["trustedTypes"]) {
      nextElement.setAttribute(payloadAttr, json);
    } else {
      try {
        nextElement.textContent = json;
      } catch {
        nextElement.setAttribute(payloadAttr, json);
      }
    }
    if (!nextElement.isConnected) {
      root.prepend(nextElement);
    }
  };

  syncDomSnapshot();
  if (snapshot && !(document.documentElement ?? document.head ?? document.body)) {
    const observer = new MutationObserver(() => {
      if (!(document.documentElement ?? document.head ?? document.body)) {
        return;
      }

      observer.disconnect();
      syncDomSnapshot();
    });

    observer.observe(document, {
      childList: true,
      subtree: true,
    });
  }

  globalThis.dispatchEvent(new CustomEvent(readyEvent));
};

export const seedFxEarlyState = (state: FirefoxShimState, markerAttr: string): void => {
  const root = document.head ?? document.documentElement;
  if (!root) {
    return;
  }

  const existing = document.querySelector(
    `script[type="application/json"][data-${markerAttr}]`,
  );
  existing?.remove();

  const script = document.createElement("script");
  script.type = "application/json";
  script.setAttribute(`data-${markerAttr}`, "");
  script.textContent = JSON.stringify(state);
  root.prepend(script);
};

export const restoreFxHashUrl = (
  originalHash: string,
  shimGuardKey: string,
  cleanupGraceMs = 1_500,
): void => {
  const restoredUrl = `${globalThis.location.pathname}${globalThis.location.search}${originalHash}`;
  const guardSymbol = Symbol.for(shimGuardKey);
  const cleanupDeadline = Date.now() + cleanupGraceMs;
  const globalRecord = globalThis as Record<string | symbol, unknown>;

  const tryRestore = (state: unknown): boolean => {
    try {
      globalThis.history.replaceState(state, "", restoredUrl);
      return globalThis.location.hash === originalHash;
    } catch {
      return false;
    }
  };

  const cleanupIfReady = (): void => {
    if (globalThis.location.hash === originalHash) {
      return;
    }

    if (!globalRecord[guardSymbol] && Date.now() < cleanupDeadline) {
      globalThis.setTimeout(cleanupIfReady, 50);
      return;
    }

    if (tryRestore(globalThis.history.state) || tryRestore(null)) {
      return;
    }

    globalThis.setTimeout(() => {
      if (!tryRestore(globalThis.history.state)) {
        tryRestore(null);
      }
    }, 0);
  };

  cleanupIfReady();
};

export const seedFxWindowState = (
  seedState: FirefoxWindowSeedState,
  windowSeedPrefix: string,
  windowSeedBuildKey: string,
): void => {
  const encodeBase64Url = (binary: string): string => {
    let encoded = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_");
    while (encoded.endsWith("=")) {
      encoded = encoded.slice(0, -1);
    }
    return encoded;
  };
  const currentWindow = globalThis as typeof globalThis & { name?: string };
  let previousName = currentWindow.name ?? "";

  if (previousName.startsWith(windowSeedPrefix)) {
    try {
      const encoded = previousName.slice(windowSeedPrefix.length);
      const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
      const padding =
        normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
      const binary = atob(`${normalized}${padding}`);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const decoded = new TextDecoder().decode(bytes);
      const existing = JSON.parse(decoded) as {
        previousName?: string;
      };
      previousName = existing.previousName ?? "";
    } catch {
      previousName = "";
    }
  }

  const json = JSON.stringify({
    buildKey: windowSeedBuildKey,
    previousName,
    seedState,
  });
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  const encoded = encodeBase64Url(binary);
  currentWindow.name = `${windowSeedPrefix}${encoded}`;
};

export const seedWindowSnapshot = (
  snapshot: RuntimeSnapshot | null,
  windowSeedPrefix: string,
  runtimeDisabled = false,
): void => {
  if (!snapshot && !runtimeDisabled) {
    return;
  }

  const encodeBase64Url = (binary: string): string => {
    const encoded = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_");
    const firstPaddingIndex = encoded.indexOf("=");
    return firstPaddingIndex >= 0 ? encoded.slice(0, firstPaddingIndex) : encoded;
  };
  const currentWindow = globalThis as typeof globalThis & { name?: string };
  // Strip an existing runtime payload to prevent recursive nesting.
  let previousName = currentWindow.name ?? "";
  if (previousName.startsWith(windowSeedPrefix)) {
    try {
      const encoded = previousName.slice(windowSeedPrefix.length);
      const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
      const padding =
        normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
      const binary = atob(`${normalized}${padding}`);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const decoded = new TextDecoder().decode(bytes);
      const existing = JSON.parse(decoded) as {
        previousName?: string;
      };
      previousName = existing.previousName ?? "";
    } catch {
      previousName = "";
    }
  }

  const json = JSON.stringify(
    runtimeDisabled
      ? {
          kind: "disabled",
          previousName,
        }
      : {
          kind: "snapshot",
          previousName,
          snapshot,
        },
  );
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  const encoded = encodeBase64Url(binary);
  currentWindow.name = `${windowSeedPrefix}${encoded}`;
};
