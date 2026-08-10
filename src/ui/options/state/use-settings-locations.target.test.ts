import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import type {
  ContainerAssignment,
  DomainRule,
  GlobalFallbackRule,
  Location,
} from "@/shared/types";
import {
  createLocationHandlers,
  type LocationHandlerOptions,
  type LocationState,
} from "@/ui/options/state/use-settings-locations";

const { warning } = vi.hoisted(() => ({ warning: vi.fn() }));

vi.mock("@/ui/components/ui/toast", () => ({
  notify: { warning },
}));

const preset: Location = {
  id: "warsaw",
  label: "Warsaw",
  latitude: 52.2297,
  longitude: 21.0122,
  accuracy: 25,
  noiseRadius: 100,
  language: "pl-PL",
  languages: ["pl-PL", "pl"],
  timeZone: "Europe/Warsaw",
};

const domainRule: DomainRule = {
  pattern: "example.com",
  enabled: true,
  locationId: preset.id,
  ruleSeedKey: "domain-seed",
};

const fallbackRule: GlobalFallbackRule = {
  enabled: true,
  locationId: preset.id,
  ruleSeedKey: "fallback-seed",
};

const containerAssignment: ContainerAssignment = {
  cookieStoreId: "firefox-container-1",
  enabled: true,
  locationId: preset.id,
  ruleSeedKey: "container-seed",
};

const createOptions = ({
  rules = [],
  globalFallbackRule,
  containerAssignments = [],
  requestConfirmation = vi.fn(async () => true),
}: {
  rules?: DomainRule[];
  globalFallbackRule?: GlobalFallbackRule;
  containerAssignments?: ContainerAssignment[];
  requestConfirmation?: LocationHandlerOptions["requestConfirmation"];
} = {}) => {
  const rulesRef = { current: rules } as RefObject<readonly DomainRule[]>;
  const globalFallbackRuleRef = {
    current: globalFallbackRule,
  } as RefObject<GlobalFallbackRule | undefined>;
  const containerAssignmentsRef = {
    current: containerAssignments,
  } as RefObject<readonly ContainerAssignment[]>;
  const persistSettings = vi.fn(async () => true);
  const state = {
    profiles: [preset],
    profilesRef: { current: [preset] },
  } as unknown as LocationState;
  const options: LocationHandlerOptions = {
    containerAssignmentsRef,
    globalFallbackRuleRef,
    navigateToAnchor: vi.fn(),
    persistSettings,
    requestConfirmation,
    rules,
    rulesRef,
    state,
  };

  return {
    containerAssignmentsRef,
    globalFallbackRuleRef,
    handlers: createLocationHandlers(options),
    persistSettings,
    requestConfirmation,
    rulesRef,
  };
};

describe("regional preset deletion guard", () => {
  it("deletes only an unused preset after persistence succeeds", async () => {
    const { handlers, persistSettings } = createOptions();

    await expect(handlers.handleRemoveProfile(preset, 0)).resolves.toBe(true);
    expect(persistSettings).toHaveBeenCalledWith({
      toast: "Preset deleted.",
      locations: [],
      scopes: ["location-model"],
    });
  });

  it.each([
    ["Domain Rule", { rules: [domainRule] }],
    ["Default Rule", { globalFallbackRule: fallbackRule }],
    ["Firefox Container", { containerAssignments: [containerAssignment] }],
    [
      "several sources",
      {
        rules: [domainRule],
        globalFallbackRule: fallbackRule,
        containerAssignments: [containerAssignment],
      },
    ],
  ])("blocks a preset used by %s", async (_label, dependencies) => {
    const { handlers, persistSettings, requestConfirmation } =
      createOptions(dependencies);

    await expect(handlers.handleRemoveProfile(preset, 0)).resolves.toBe(false);
    expect(requestConfirmation).not.toHaveBeenCalled();
    expect(persistSettings).not.toHaveBeenCalled();
  });

  it("rechecks dependencies after confirmation", async () => {
    let rulesRef: RefObject<readonly DomainRule[]>;
    const requestConfirmation = vi.fn(async () => {
      rulesRef.current = [domainRule];
      return true;
    });
    const options = createOptions({ requestConfirmation });
    rulesRef = options.rulesRef;

    await expect(options.handlers.handleRemoveProfile(preset, 0)).resolves.toBe(false);
    expect(options.persistSettings).not.toHaveBeenCalled();
  });
});
