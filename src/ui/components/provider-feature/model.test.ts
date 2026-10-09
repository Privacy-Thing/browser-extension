import { describe, expect, it } from "vitest";

import {
  featureNotice,
  genericInitials,
  initialsFromState,
  recognitionHost,
  resolveSlot,
  type ProviderFeature,
  type ProviderFeatureMatch,
  type RuleFeatureBinding,
  type SlotInput,
} from "./model";

import { compileDomainPattern } from "@/shared/domain-match";
import type { ProviderFeatureState } from "@/shared/provider-feature";

const youtube: ProviderFeature = {
  providerId: "provider",
  featureId: "youtube",
  type: "service",
  name: "YouTube",
};

const netflix: ProviderFeature = {
  providerId: "provider",
  featureId: "netflix",
  type: "service",
  name: "Netflix",
};

const match = (
  overrides: Partial<ProviderFeatureMatch> = {},
): ProviderFeatureMatch => ({
  hostname: "www.youtube.com",
  providerId: "provider",
  featureId: "youtube",
  matchSource: "domain-test",
  status: "matched",
  checkedAt: "2026-10-09T12:00:00.000Z",
  ...overrides,
});

const binding = (overrides: Partial<RuleFeatureBinding> = {}): RuleFeatureBinding => ({
  rulePattern: "www.youtube.com",
  providerId: "provider",
  featureId: "youtube",
  featureName: "YouTube",
  featureType: "service",
  ...overrides,
});

const input = (overrides: Partial<SlotInput> = {}): SlotInput => ({
  available: true,
  providerId: "provider",
  providerName: "Example DNS",
  initials: "ED",
  features: [youtube, netflix],
  bindings: [],
  binding: null,
  match: match(),
  dismissed: false,
  recognizing: false,
  identityPattern: "music.youtube.com",
  decision: undefined,
  declinedId: null,
  ...overrides,
});

describe("recognitionHost", () => {
  it("uses an exact host, the apex of *host, and www for *.host", () => {
    expect(recognitionHost("Video.Example.com.")).toBe("video.example.com");
    expect(recognitionHost("*example.com")).toBe("example.com");
    expect(recognitionHost("*.example.com")).toBe("www.example.com");
    expect(compileDomainPattern("*example.com").test("example.com")).toBe(true);
    expect(compileDomainPattern("*.example.com").test("www.example.com")).toBe(true);
    expect(compileDomainPattern("*.example.com").test("example.com")).toBe(false);
  });

  it("does not invent a host for other wildcards", () => {
    expect(recognitionHost("*")).toBe("");
    expect(recognitionHost("foo.*.com")).toBe("");
    expect(recognitionHost("*.*.example.com")).toBe("");
  });

  it("prefers a valid fixed host and ignores an invalid one", () => {
    expect(recognitionHost("*.example.com", "WWW.Example.com")).toBe("www.example.com");
    expect(recognitionHost("*example.com", "not a host")).toBe("");
  });
});

describe("initialsFromState", () => {
  const state = {
    available: true,
    providerId: "provider",
    providerName: "Example DNS",
    features: [],
    match: null,
    binding: null,
    dismissed: false,
    syncStatus: "synced",
    error: null,
  } satisfies ProviderFeatureState;

  it("derives initials from the provider name", () => {
    expect(genericInitials("Example DNS")).toBe("ED");
    expect(genericInitials("Netflix")).toBe("N");
    expect(initialsFromState(state)).toBe("ED");
  });

  it("prefers adapter initials, then an optional provider field", () => {
    expect(
      initialsFromState({
        ...state,
        decorator: {
          providerId: "provider",
          providerName: "Example DNS",
          initials: "QX",
          featureId: "youtube",
          label: "YouTube",
          type: "service",
        },
      }),
    ).toBe("QX");
    expect(
      initialsFromState({
        ...state,
        providerInitials: "ZZ",
      }),
    ).toBe("ZZ");
  });
});

describe("resolveSlot", () => {
  it("suggests a matched feature that is not already grouped", () => {
    expect(resolveSlot(input()).view).toBe("suggest");
  });

  it("asks to join when another binding already uses the feature", () => {
    const model = resolveSlot(
      input({
        identityPattern: "tv.youtube.com",
        bindings: [
          binding({
            rulePatterns: ["www.youtube.com", "m.youtube.com", "music.youtube.com"],
          }),
        ],
      }),
    );
    expect(model.view).toBe("join");
    expect(model.join).toEqual({ pattern: "www.youtube.com", extra: 2 });
    expect(model.groupSize).toBe(3);
  });

  it("keeps an existing group linked, including its pattern count", () => {
    const model = resolveSlot(
      input({
        identityPattern: "www.youtube.com",
        binding: binding({ rulePatterns: ["www.youtube.com", "m.youtube.com"] }),
        dismissed: true,
        recognizing: true,
      }),
    );
    expect(model.view).toBe("linked");
    expect(model.groupSize).toBe(2);
  });

  it.each([
    [input({ available: false, binding: binding() }), "hidden"],
    [input({ providerId: "" }), "hidden"],
    [input({ match: null, recognizing: true }), "checking"],
    [input({ match: null }), "manual"],
    [input({ dismissed: true }), "manual"],
    [input({ declinedId: "youtube" }), "manual"],
    [input({ match: match({ status: "unresolved", featureId: null }) }), "manual"],
    [input({ match: match({ status: "error", featureId: null }) }), "manual"],
    [input({ decision: { providerId: "provider", featureId: "netflix" } }), "staged"],
    [input({ decision: { providerId: "provider", featureId: null } }), "manual"],
  ] as const)("resolves to $1", (value, view) => {
    expect(resolveSlot(value).view).toBe(view);
  });

  it("still suggests a different feature after another one was declined", () => {
    expect(
      resolveSlot(
        input({ match: match({ featureId: "netflix" }), declinedId: "youtube" }),
      ).view,
    ).toBe("suggest");
  });

  it("keeps join info on a staged join so the draft consequence stays visible", () => {
    const model = resolveSlot(
      input({
        identityPattern: "tv.youtube.com",
        bindings: [binding({ rulePatterns: ["www.youtube.com", "m.youtube.com"] })],
        decision: { providerId: "provider", featureId: "youtube", joinExisting: true },
      }),
    );
    expect(model.view).toBe("staged");
    expect(model.join).toEqual({ pattern: "www.youtube.com", extra: 1 });
  });

  it("forwards badge colors onto the decorator", () => {
    const colors = { background: "#1BE3AD", foreground: "#010818" };
    expect(resolveSlot(input({ badgeColors: colors })).decorator?.badgeColors).toEqual(
      colors,
    );
  });
});

describe("featureNotice", () => {
  const base = {
    errorCode: null,
    failed: false,
    recognitionStatus: "ready" as const,
    syncStatus: "synced",
    hasBinding: false,
    featureCount: 1,
    hasStateError: false,
  };

  it("hides raw sweep errors behind a paused line and stops treating preparing as an error", () => {
    expect(
      featureNotice({
        ...base,
        recognitionStatus: "unavailable",
        hasStateError: true,
      }),
    ).toBe("paused");
    expect(
      featureNotice({
        ...base,
        errorCode: "recognition-preparing",
        failed: true,
        recognitionStatus: "preparing",
      }),
    ).toBeNull();
    expect(featureNotice({ ...base, failed: true })).toBe("generic");
    expect(
      featureNotice({
        ...base,
        syncStatus: "error",
        hasBinding: true,
        hasStateError: true,
      }),
    ).toBe("sync");
  });
});
