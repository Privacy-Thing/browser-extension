import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyPrivacyDefaults,
  getWebRtcPolicyConfirmed,
  getWebRtcPrivacyPolicy,
} from "@/background/privacy";

describe("privacy defaults", () => {
  const setWebRtcPolicy = vi.fn<(...args: Array<{ value: string }>) => Promise<void>>();
  const getWebRtcPolicy = vi.fn<(...args: unknown[]) => Promise<{ value: string }>>();

  beforeEach(() => {
    setWebRtcPolicy.mockReset();
    setWebRtcPolicy.mockResolvedValue(undefined);
    getWebRtcPolicy.mockReset();
    getWebRtcPolicy.mockResolvedValue({ value: getWebRtcPrivacyPolicy() });

    vi.stubGlobal("chrome", {
      privacy: {
        network: {
          webRTCIPHandlingPolicy: {
            set: setWebRtcPolicy,
            get: getWebRtcPolicy,
          },
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the restrictive default public interface policy", () => {
    expect(getWebRtcPrivacyPolicy()).toBe("default_public_interface_only");
  });

  it("applies the restrictive WebRTC policy through chrome.privacy", async () => {
    await applyPrivacyDefaults();

    expect(setWebRtcPolicy).toHaveBeenCalledWith({
      value: getWebRtcPrivacyPolicy(),
    });
  });

  it("confirms the applied policy via a readback", async () => {
    await applyPrivacyDefaults();

    expect(getWebRtcPolicy).toHaveBeenCalledWith({});
    expect(getWebRtcPolicyConfirmed()).toBe(true);
  });

  it("reports the policy as unconfirmed when the readback does not match", async () => {
    getWebRtcPolicy.mockResolvedValue({ value: "disable_non_proxied_udp" });

    await applyPrivacyDefaults();

    expect(getWebRtcPolicyConfirmed()).toBe(false);
  });

  it("reports the policy as unconfirmed (not failed) when the readback itself throws", async () => {
    getWebRtcPolicy.mockRejectedValue(new Error("readback unavailable"));

    await applyPrivacyDefaults();

    expect(getWebRtcPolicyConfirmed()).toBeNull();
  });
});
