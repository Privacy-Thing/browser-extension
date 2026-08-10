import { createPatchedPeerCtor } from "@privacy-brand/refract-core";
import { describe, expect, it } from "vitest";

class MockRTCPeerConnection {
  private readonly config: RTCConfigurationLike;

  constructor(config?: RTCConfigurationLike) {
    this.config = config ?? {};
  }

  getConfiguration(): RTCConfigurationLike {
    return this.config;
  }

  static generateCertificate(): string {
    return "mock-certificate";
  }
}

type RTCConfigurationLike = RTCConfiguration | null | undefined;

describe("createPatchedPeerCtor", () => {
  it("forces relay policy while preserving instanceof and static properties", () => {
    const PatchedRTCPeerConnection = createPatchedPeerCtor(
      MockRTCPeerConnection as unknown as typeof RTCPeerConnection,
      (configuration) => ({
        ...(configuration ?? {}),
        iceTransportPolicy: "relay",
      }),
    );

    const connection = new PatchedRTCPeerConnection({
      iceTransportPolicy: "all",
    });

    expect(connection).toBeInstanceOf(PatchedRTCPeerConnection);
    expect(connection.getConfiguration().iceTransportPolicy).toBe("relay");
    expect(
      (
        PatchedRTCPeerConnection as unknown as typeof MockRTCPeerConnection
      ).generateCertificate(),
    ).toBe("mock-certificate");
  });

  it("passes through configuration when the patch callback does not override it", () => {
    const PatchedRTCPeerConnection = createPatchedPeerCtor(
      MockRTCPeerConnection as unknown as typeof RTCPeerConnection,
      (configuration) => configuration,
    );

    const connection = new PatchedRTCPeerConnection({
      iceTransportPolicy: "all",
    });

    expect(connection.getConfiguration().iceTransportPolicy).toBe("all");
  });

  it("keeps constructor masking and call-without-new failure", () => {
    const PatchedRTCPeerConnection = createPatchedPeerCtor(
      MockRTCPeerConnection as unknown as typeof RTCPeerConnection,
      (configuration) => configuration,
    );

    expect(PatchedRTCPeerConnection.toString()).toContain("[native code]");
    expect(() => {
      // @ts-expect-error intentional illegal call for parity
      PatchedRTCPeerConnection({ iceServers: [] });
    }).toThrow(TypeError);
  });
});
