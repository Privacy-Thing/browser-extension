import { afterEach, describe, expect, it, vi } from "vitest";

import {
  reportBootstrapChannel,
  resolveChromiumFallback,
} from "@/content/bootstrap-resolver";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import type { RuntimeSnapshot } from "@/shared/types";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const snapshot: RuntimeSnapshot = {
  geo: {
    latitude: 10,
    longitude: 20,
    accuracy: 30,
    noiseRadius: 40,
  },
  locale: {
    language: "en-US",
    languages: ["en-US"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "en-US",
  },
  date: {
    baseEpochMs: 1,
    offsetMs: 2,
    timeZone: "Europe/Warsaw",
  },
  debugMode: true,
  watchPositionDelay: [60, 500],
};

describe("reportBootstrapChannel", () => {
  it("emits a debug log event and swallows transport errors", async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error("boom"));
    vi.stubGlobal("chrome", {
      runtime: {
        id: "abc",
        sendMessage,
      },
    });

    expect(() => reportBootstrapChannel("background-message", snapshot)).not.toThrow();

    await Promise.resolve();

    expect(sendMessage).toHaveBeenCalledWith({
      type: EXTENSION_COMMAND_TYPES.logEvent,
      event: "Bootstrap.channel-used",
      details: {
        browserTarget: BUILD_BROWSER_TARGET,
        channel: "background-message",
        hadSnapshot: true,
      },
    });
  });

  it("does nothing when debugMode is disabled", async () => {
    const sendMessage = vi.fn();
    vi.stubGlobal("chrome", {
      runtime: {
        id: "abc",
        sendMessage,
      },
    });

    reportBootstrapChannel("preloaded-state", {
      ...snapshot,
      debugMode: false,
    });

    await Promise.resolve();

    expect(sendMessage).not.toHaveBeenCalled();
  });
});

describe("resolveChromiumFallback", () => {
  it("returns preloaded-state when session preload matches", async () => {
    const resolveBackground = vi.fn();

    await expect(
      resolveChromiumFallback("example.com", {
        readPreloadedState: async () => ({
          entries: [
            {
              pattern: "example.com",
              blockServiceWorkerRegistration: false,
              snapshot,
            },
          ],
        }),
        resolveBackground,
      }),
    ).resolves.toEqual({
      snapshot: {
        ...snapshot,
        blockServiceWorkerRegistration: false,
      },
      channel: "preloaded-state",
    });
    expect(resolveBackground).not.toHaveBeenCalled();
  });

  it("returns background-message only after preload misses", async () => {
    const resolveBackground = vi.fn().mockResolvedValue(snapshot);

    await expect(
      resolveChromiumFallback("example.com", {
        readPreloadedState: async () => ({ entries: [] }),
        resolveBackground,
      }),
    ).resolves.toEqual({ snapshot, channel: "background-message" });
    expect(resolveBackground).toHaveBeenCalledWith("example.com");
  });

  it("returns background-fallback-miss when neither preload nor background has a snapshot", async () => {
    await expect(
      resolveChromiumFallback("example.com", {
        readPreloadedState: async () => ({ entries: [] }),
        resolveBackground: async () => null,
      }),
    ).resolves.toEqual({ snapshot: null, channel: "background-fallback-miss" });
  });

  it("treats invalidated background messaging as a fallback miss", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        id: "abc",
        sendMessage: vi.fn(() => {
          throw new Error("Extension context invalidated.");
        }),
      },
    });

    await expect(
      resolveChromiumFallback("example.com", {
        readPreloadedState: async () => ({ entries: [] }),
      }),
    ).resolves.toEqual({ snapshot: null, channel: "background-fallback-miss" });
  });
});
