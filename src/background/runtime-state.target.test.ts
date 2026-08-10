import { describe, expect, it } from "vitest";

import { createRuntimeState } from "@/background/runtime-state";
import type {
  ContainerAssignment,
  ControlState,
  DomainRule,
  EffectiveTabContext,
  GlobalFallbackRule,
  Location,
  TrustedSite,
} from "@/shared/types";

const preparedDecision = { marker: "prepared" };
type RuntimeState = ReturnType<typeof createRuntimeState<typeof preparedDecision>>;

const expectInvalidated = (mutate: (state: RuntimeState) => void): void => {
  const state = createRuntimeState<typeof preparedDecision>();
  state.setPreparedRuntimeDecisions(preparedDecision);

  mutate(state);

  expect(state.getPreparedDecisions()).toBeNull();
};

describe("createRuntimeState", () => {
  it.each([
    ["profiles", (state: RuntimeState) => state.setLastKnownProfiles([] as Location[])],
    ["rules", (state: RuntimeState) => state.setLastKnownRules([] as DomainRule[])],
    [
      "trusted sites",
      (state: RuntimeState) => state.setLastKnownTrustedSites([] as TrustedSite[]),
    ],
    [
      "control state",
      (state: RuntimeState) => state.setLastKnownControlState({} as ControlState),
    ],
    ["debug mode", (state: RuntimeState) => state.setLastKnownDebugMode(true)],
    [
      "container assignments",
      (state: RuntimeState) => state.setKnownContainers([] as ContainerAssignment[]),
    ],
    [
      "global fallback rule",
      (state: RuntimeState) =>
        state.setKnownFallback(undefined as GlobalFallbackRule | undefined),
    ],
  ] as const)("invalidates prepared decisions when %s changes", (_, mutate) => {
    expectInvalidated(mutate);
  });

  it.each([
    ["rules", (state: RuntimeState) => state.setLastKnownRules([])],
    ["trusted sites", (state: RuntimeState) => state.setLastKnownTrustedSites([])],
  ] as const)("clears effective snapshots when %s change", (_, mutate) => {
    const state = createRuntimeState<typeof preparedDecision>();
    state.effectiveSnapshotCache.set({
      tabId: 1,
      frameId: 0,
      hostname: "example.com",
      decision: {
        snapshot: null,
        trustedSiteMatched: false,
      },
    });

    mutate(state);

    expect(state.effectiveSnapshotCache.readEntry(1, 0)).toBeUndefined();
  });

  it("returns a copy of active tab contexts", () => {
    const state = createRuntimeState();
    state.activeTabContexts.set(1, { tabId: 1 } as EffectiveTabContext);

    const contexts = state.getActiveTabContexts();
    contexts.length = 0;

    expect(state.getActiveTabContexts()).toHaveLength(1);
  });

  it("does not update attention motion through setCachedValues", () => {
    const state = createRuntimeState();
    state.setKnownAttentionMotion(false);

    state.setCachedValues({
      showBadgeQueryCount: true,
      includeDateCallsInBadgeCount: true,
    });

    expect(state.getKnownAttentionMotion()).toBe(false);
  });
});
