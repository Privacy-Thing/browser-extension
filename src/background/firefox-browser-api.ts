import type { createUserScriptRegs } from "@/background/firefox-user-scripts";

type FirefoxPermissionsApi = {
  contains: (permissions: {
    permissions?: string[];
    origins?: string[];
  }) => Promise<boolean>;
  request: (permissions: {
    permissions?: string[];
    origins?: string[];
  }) => Promise<boolean>;
  onAdded?: {
    addListener: (
      listener: (permissions: chrome.permissions.Permissions) => void,
    ) => void;
  };
  onRemoved?: {
    addListener: (
      listener: (permissions: chrome.permissions.Permissions) => void,
    ) => void;
  };
};

type FirefoxUserScriptsApi = {
  register: (scripts: ReturnType<typeof createUserScriptRegs>) => Promise<unknown>;
  unregister: (filter?: { ids?: string[] }) => Promise<void>;
};

export type FirefoxBrowserApi = {
  permissions?: FirefoxPermissionsApi;
  userScripts?: FirefoxUserScriptsApi;
  webRequest?: {
    onBeforeRequest?: {
      addListener: (
        listener: (
          details: chrome.webRequest.OnBeforeRequestDetails,
        ) =>
          | chrome.webRequest.BlockingResponse
          | Promise<chrome.webRequest.BlockingResponse | undefined>
          | void,
        filter: chrome.webRequest.RequestFilter,
        extraInfoSpec?: string[],
      ) => void;
    };
  };
};

export const firefoxBrowserApi = (
  globalThis as typeof globalThis & { browser?: FirefoxBrowserApi }
).browser;
