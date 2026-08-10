/**
 * Synchronizes the runtime snapshot bootstrap script and main-world runtime
 * loader into the document as early as the DOM allows.
 */

import {
  findRuntimeConfigElement,
  getRuntimeReadyEvent,
  writeConfigElement,
} from "@privacy-brand/refract-browser/common/runtime-config";

import { safeSendMessage } from "@/content/safe-messaging";
import { CMD_LOG_EVENT } from "@/shared/extension-contract";
import type { RuntimeSnapshot } from "@/shared/types";

const injectedScripts = new Set<string>();
const pendingScripts = new Set<string>();
let observerActive = false;

const reportScriptLoadFailure = (scriptPath: string): void => {
  safeSendMessage({
    type: CMD_LOG_EVENT,
    heartbeat: true,
    event: "FirefoxBootstrap.page-world-script-load-failed",
    details: {
      result: {
        scriptPath,
      },
    },
  });
};

const injectScript = (snapshot: RuntimeSnapshot): void => {
  writeConfigElement(document, snapshot);

  window.dispatchEvent(new CustomEvent(getRuntimeReadyEvent()));
};

/** Writes or updates the DOM bootstrap payload consumed by the main-world runtime. */
export const injectRuntimeConfig = (snapshot: RuntimeSnapshot): void => {
  if (document.documentElement ?? document.head ?? document.body) {
    injectScript(snapshot);
    return;
  }

  const observer = new MutationObserver(() => {
    if (!(document.documentElement ?? document.head ?? document.body)) {
      return;
    }

    observer.disconnect();
    injectScript(snapshot);
  });

  observer.observe(document, {
    childList: true,
  });
};

/** Removes the DOM bootstrap payload when runtime state must be cleared. */
export const clearRuntimeConfig = (): void => {
  findRuntimeConfigElement()?.remove();
};

/**
 * Injects the bundled main-world runtime script exactly once, waiting for a DOM
 * root if the document is still booting.
 */
export const injectMainWorldScript = (scriptPath: string): void => {
  if (injectedScripts.has(scriptPath)) {
    return;
  }

  pendingScripts.add(scriptPath);

  const injectPendingScripts = (): boolean => {
    const root = document.head ?? document.documentElement ?? document.body;
    if (!root) {
      return false;
    }

    const scriptPaths = [...pendingScripts].filter(
      (path) => !injectedScripts.has(path),
    );
    for (const nextScriptPath of scriptPaths) {
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL(nextScriptPath);
      script.async = false;
      script.onload = () => script.remove();
      script.onerror = () => {
        reportScriptLoadFailure(nextScriptPath);
        script.remove();
      };
      root.appendChild(script);
      injectedScripts.add(nextScriptPath);
      pendingScripts.delete(nextScriptPath);
    }

    return true;
  };

  if (injectPendingScripts()) {
    return;
  }

  if (observerActive) {
    return;
  }

  observerActive = true;

  const observer = new MutationObserver(() => {
    if (!injectPendingScripts()) {
      return;
    }

    if (pendingScripts.size === 0) {
      observerActive = false;
      observer.disconnect();
    }
  });

  observer.observe(document, {
    childList: true,
  });
};
