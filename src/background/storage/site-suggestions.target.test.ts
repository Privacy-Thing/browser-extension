import { beforeEach, describe, expect, it, vi } from "vitest";

import { NOTICES_STORAGE_KEY } from "@/background/storage/popup-notifications";
import {
  SUGGESTIONS_STORAGE_KEY,
  clearSiteSuggestions,
  loadSiteSuggestions,
  recordSuggestion,
  selectPopupSuggestions,
  updateSuggestionStatus,
} from "@/background/storage/site-suggestions";
import type { PopupNotification } from "@/shared/types";

const storageState: Record<string, unknown> = {};

const getStorageApi = () => ({
  get: vi.fn(async (key?: string | string[]) => {
    if (key === undefined) {
      return { ...storageState };
    }

    if (typeof key === "string") {
      return key in storageState ? { [key]: storageState[key] } : {};
    }

    return Object.fromEntries(
      key
        .filter((entry) => entry in storageState)
        .map((entry) => [entry, storageState[entry]]),
    );
  }),
  set: vi.fn(async (entries: Record<string, unknown>) => {
    Object.assign(storageState, entries);
  }),
});

beforeEach(() => {
  for (const key of Object.keys(storageState)) {
    Reflect.deleteProperty(storageState, key);
  }

  vi.useRealTimers();
  vi.stubGlobal("chrome", {
    storage: {
      local: getStorageApi(),
    },
  });
});

describe("site suggestion storage", () => {
  it("records a pending suggestion for a hostname", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-09T10:00:00.000Z"));

    await recordSuggestion("example.com", "worker-csp-relaxation");

    await expect(loadSiteSuggestions()).resolves.toEqual({
      "default::example.com": [
        {
          kind: "worker-csp-relaxation",
          status: "pending",
          detectionCount: 1,
          lastDetectedAt: "2026-04-09T10:00:00.000Z",
          dismissedAt: null,
          acceptedAt: null,
        },
      ],
    });
  });

  it("reopens an accepted suggestion when the issue is detected again", async () => {
    storageState[SUGGESTIONS_STORAGE_KEY] = {
      "default::example.com": [
        {
          kind: "worker-csp-relaxation",
          status: "accepted",
          detectionCount: 2,
          lastDetectedAt: "2026-04-09T10:00:00.000Z",
          dismissedAt: null,
          acceptedAt: "2026-04-09T10:05:00.000Z",
        },
      ],
    };

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-09T11:00:00.000Z"));

    await recordSuggestion("example.com", "worker-csp-relaxation");

    await expect(loadSiteSuggestions()).resolves.toEqual({
      "default::example.com": [
        {
          kind: "worker-csp-relaxation",
          status: "pending",
          detectionCount: 3,
          lastDetectedAt: "2026-04-09T11:00:00.000Z",
          dismissedAt: null,
          acceptedAt: null,
        },
      ],
    });
  });

  it("marks dismissed suggestions as warnings after rediscovery", async () => {
    storageState[SUGGESTIONS_STORAGE_KEY] = {
      "example.com": [
        {
          kind: "worker-csp-relaxation",
          status: "dismissed",
          detectionCount: 2,
          lastDetectedAt: "2026-04-09T11:00:00.000Z",
          dismissedAt: "2026-04-09T10:30:00.000Z",
          acceptedAt: null,
        },
      ],
    };

    const selected = selectPopupSuggestions(await loadSiteSuggestions(), "example.com");

    expect(selected.hasWarning).toBe(true);
    expect(selected.items[0]).toMatchObject({
      kind: "worker-csp-relaxation",
      status: "dismissed",
      rediscovered: true,
    });
  });

  it("can dismiss, accept, and clear suggestions", async () => {
    await recordSuggestion("example.com", "worker-csp-relaxation");
    await updateSuggestionStatus("example.com", "worker-csp-relaxation", "dismissed");

    let stored = await loadSiteSuggestions();
    expect(stored["default::example.com"]?.[0]?.status).toBe("dismissed");

    await updateSuggestionStatus("example.com", "worker-csp-relaxation", "accepted");

    stored = await loadSiteSuggestions();
    expect(stored["default::example.com"]?.[0]?.status).toBe("accepted");

    await clearSiteSuggestions();
    await expect(loadSiteSuggestions()).resolves.toEqual({});
  });

  it("resolves the notification belonging to the active Firefox Container", async () => {
    await recordSuggestion(
      "example.com",
      "worker-csp-relaxation",
      "firefox-container-2",
    );
    await updateSuggestionStatus(
      "example.com",
      "worker-csp-relaxation",
      "dismissed",
      "firefox-container-2",
    );

    const notifications = storageState[NOTICES_STORAGE_KEY] as PopupNotification[];
    expect(notifications).toContainEqual(
      expect.objectContaining({
        id: "site:firefox-container-2:example.com:worker-csp-relaxation",
        readAt: expect.any(String),
        resolvedAt: expect.any(String),
      }),
    );
  });
});
