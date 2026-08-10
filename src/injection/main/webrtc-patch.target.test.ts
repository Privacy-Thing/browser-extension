import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installWebRTCPatch } from "@/injection/main/webrtc-patch";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import type { RuntimeSnapshot } from "@/shared/types";

const convertRTCConfiguration = (
  config?: RTCConfiguration | null,
): RTCConfiguration => {
  if (
    config !== null &&
    config !== undefined &&
    typeof config !== "object" &&
    typeof config !== "function"
  ) {
    throw new TypeError("Native RTCConfiguration conversion rejected a primitive");
  }
  const converted: Record<string, unknown> = {};
  const source = config as unknown as Record<string, unknown> | null | undefined;
  for (const key of [
    "bundlePolicy",
    "certificates",
    ...(BUILD_BROWSER_TARGET === "chromium" ? ["encodedInsertableStreams"] : []),
    "iceCandidatePoolSize",
    "iceServers",
    "iceTransportPolicy",
    ...(BUILD_BROWSER_TARGET === "firefox" ? ["peerIdentity"] : []),
    "rtcpMuxPolicy",
  ]) {
    const value = source?.[key];
    if (value !== undefined) {
      converted[key] = value;
    }
  }
  return converted as RTCConfiguration;
};

class MockRTCPeerConnection {
  private config: RTCConfiguration;

  constructor(config?: RTCConfiguration) {
    this.config = convertRTCConfiguration(config);
  }

  getConfiguration(): RTCConfiguration {
    return this.config;
  }

  setConfiguration(config?: RTCConfiguration): void {
    this.config = convertRTCConfiguration(config);
  }

  async createOffer(_options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> {
    return {
      type: "offer" as RTCSdpType,
      sdp:
        [
          "v=0",
          "a=candidate:1 1 UDP 2130706431 192.168.1.100 12345 typ host",
          "a=candidate:2 1 UDP 1694498815 203.0.113.5 54321 typ srflx raddr 0.0.0.0 rport 0",
          "a=candidate:4 1 UDP 2130706431 2001:db8::1 23456 typ host",
          "a=candidate:3 1 UDP 16777215 198.51.100.1 9999 typ relay raddr 0.0.0.0 rport 0",
        ].join("\r\n") + "\r\n",
    };
  }

  async createAnswer(_options?: RTCAnswerOptions): Promise<RTCSessionDescriptionInit> {
    return {
      type: "answer" as RTCSdpType,
      sdp:
        ["v=0", "a=candidate:1 1 UDP 2130706431 10.0.0.1 12345 typ host"].join("\r\n") +
        "\r\n",
    };
  }

  close(): void {}

  static generateCertificate(): string {
    return "mock-certificate";
  }
}

const buildSnapshot = (
  overrides: Partial<RuntimeSnapshot["fingerprint"]> | null = {},
): RuntimeSnapshot => {
  const base: RuntimeSnapshot = {
    geo: { latitude: 0, longitude: 0, accuracy: 10, noiseRadius: 50 },
    locale: {
      language: "en",
      languages: ["en"],
      timeZone: "UTC",
      acceptLanguage: "en",
    },
    date: { baseEpochMs: 0, offsetMs: 0, timeZone: "UTC" },
    debugMode: false,
    watchPositionDelay: [100, 500],
  };
  if (overrides !== null) {
    base.fingerprint = { ...overrides };
  }
  return base;
};

describe("installWebRTCPatch", () => {
  let originalCreateOffer: typeof MockRTCPeerConnection.prototype.createOffer;
  let originalCreateAnswer: typeof MockRTCPeerConnection.prototype.createAnswer;
  let originalSetConfiguration: typeof MockRTCPeerConnection.prototype.setConfiguration;

  beforeEach(() => {
    originalCreateOffer = MockRTCPeerConnection.prototype.createOffer;
    originalCreateAnswer = MockRTCPeerConnection.prototype.createAnswer;
    originalSetConfiguration = MockRTCPeerConnection.prototype.setConfiguration;
    vi.stubGlobal("RTCPeerConnection", MockRTCPeerConnection);
  });

  afterEach(() => {
    MockRTCPeerConnection.prototype.createOffer = originalCreateOffer;
    MockRTCPeerConnection.prototype.createAnswer = originalCreateAnswer;
    MockRTCPeerConnection.prototype.setConfiguration = originalSetConfiguration;
    vi.unstubAllGlobals();
  });

  it("forces iceTransportPolicy to relay on construction", () => {
    installWebRTCPatch(buildSnapshot());

    const pc = new RTCPeerConnection({ iceTransportPolicy: "all" });
    expect(pc.getConfiguration().iceTransportPolicy).toBe("relay");
  });

  it("sets relay even with default (empty) config", () => {
    installWebRTCPatch(buildSnapshot());

    const pc = new RTCPeerConnection();
    expect(pc.getConfiguration().iceTransportPolicy).toBe("relay");
  });

  it("keeps relay enforced through setConfiguration while preserving other fields", () => {
    installWebRTCPatch(buildSnapshot());

    const pc = new RTCPeerConnection();
    pc.setConfiguration({
      iceServers: [{ urls: "turn:relay.example" }],
      iceTransportPolicy: "all",
    });

    expect(pc.getConfiguration()).toEqual({
      iceServers: [{ urls: "turn:relay.example" }],
      iceTransportPolicy: "relay",
    });
    expect(MockRTCPeerConnection.prototype.setConfiguration.toString()).toContain(
      "[native code]",
    );
  });

  it("preserves inherited and non-enumerable WebIDL members in setConfiguration", () => {
    installWebRTCPatch(buildSnapshot());
    const iceServers = [{ urls: "turn:relay.example" }];
    const inheritedConfiguration = Object.create(
      Object.defineProperty({}, "iceServers", {
        configurable: true,
        enumerable: false,
        value: iceServers,
      }),
    ) as RTCConfiguration & { unknown?: string };
    const unknownGetter = vi.fn(() => "not a dictionary member");
    Object.defineProperty(inheritedConfiguration, "unknown", {
      enumerable: true,
      get: unknownGetter,
    });
    inheritedConfiguration.iceTransportPolicy = "all";

    const pc = new RTCPeerConnection();
    pc.setConfiguration(inheritedConfiguration);

    expect(pc.getConfiguration()).toEqual({
      iceServers,
      iceTransportPolicy: "relay",
    });
    expect(unknownGetter).not.toHaveBeenCalled();
  });

  it("invokes known WebIDL getters with the original configuration receiver", () => {
    installWebRTCPatch(buildSnapshot());
    const configuration = {} as RTCConfiguration;
    const iceServers = [{ urls: "turn:relay.example" }];
    const receiverMatches: boolean[] = [];
    Object.defineProperties(configuration, {
      iceServers: {
        get(this: RTCConfiguration) {
          receiverMatches.push(this === configuration);
          return iceServers;
        },
      },
      iceTransportPolicy: {
        get(this: RTCConfiguration) {
          receiverMatches.push(this === configuration);
          return "all";
        },
      },
    });

    const pc = new RTCPeerConnection();
    pc.setConfiguration(configuration);

    expect(receiverMatches).toEqual([true, true]);
    expect(pc.getConfiguration()).toEqual({
      iceServers,
      iceTransportPolicy: "relay",
    });
  });

  it("reads only the target-specific extended RTC configuration field", () => {
    installWebRTCPatch(buildSnapshot());
    const encodedInsertableStreams = vi.fn(() => true);
    const peerIdentity = vi.fn(() => "peer.example");
    const configuration = Object.defineProperties(
      { iceTransportPolicy: "all" },
      {
        encodedInsertableStreams: { get: encodedInsertableStreams },
        peerIdentity: { get: peerIdentity },
      },
    ) as RTCConfiguration & {
      encodedInsertableStreams: boolean;
      peerIdentity: string;
    };

    const pc = new RTCPeerConnection(configuration);
    const result = pc.getConfiguration() as RTCConfiguration & {
      encodedInsertableStreams?: boolean;
      peerIdentity?: string;
    };

    expect(result.iceTransportPolicy).toBe("relay");
    if (BUILD_BROWSER_TARGET === "chromium") {
      expect(result.encodedInsertableStreams).toBe(true);
      expect(result.peerIdentity).toBeUndefined();
      expect(encodedInsertableStreams).toHaveBeenCalledTimes(1);
      expect(peerIdentity).not.toHaveBeenCalled();
    } else {
      expect(result.encodedInsertableStreams).toBeUndefined();
      expect(result.peerIdentity).toBe("peer.example");
      expect(encodedInsertableStreams).not.toHaveBeenCalled();
      expect(peerIdentity).toHaveBeenCalledTimes(1);
    }
  });

  it("preserves inherited WebIDL members during construction", () => {
    installWebRTCPatch(buildSnapshot());
    const iceServers = [{ urls: "turn:relay.example" }];
    const configuration = Object.create({ iceServers }) as RTCConfiguration;
    configuration.iceTransportPolicy = "all";

    const pc = new RTCPeerConnection(configuration);

    expect(pc.getConfiguration()).toEqual({
      iceServers,
      iceTransportPolicy: "relay",
    });
  });

  it("protects the webkitRTCPeerConnection vendor alias", () => {
    vi.stubGlobal("webkitRTCPeerConnection", MockRTCPeerConnection);
    installWebRTCPatch(buildSnapshot());

    const WebkitRTC = (
      globalThis as typeof globalThis & {
        webkitRTCPeerConnection: typeof RTCPeerConnection;
      }
    ).webkitRTCPeerConnection;
    const pc = new WebkitRTC({ iceTransportPolicy: "all" });

    expect(pc.getConfiguration().iceTransportPolicy).toBe("relay");
    expect(WebkitRTC).toBe(RTCPeerConnection);
    expect(WebkitRTC.toString()).toContain("[native code]");
  });

  it("sanitizes host and srflx IPs in createOffer SDP", async () => {
    installWebRTCPatch(buildSnapshot());

    const pc = new RTCPeerConnection();
    const offer = await pc.createOffer();

    expect(offer.sdp).toBeDefined();
    const lines = offer.sdp!.split("\r\n");

    const hostLine = lines.find((l) => l.includes("typ host"));
    expect(hostLine).toContain("0.0.0.0");
    expect(hostLine).not.toContain("192.168.1.100");

    const srflxLine = lines.find((l) => l.includes("typ srflx"));
    expect(srflxLine).toContain("0.0.0.0");
    expect(srflxLine).not.toContain("203.0.113.5");

    const ipv6HostLine = lines.find((l) => l.includes("2001:db8::1"));
    expect(ipv6HostLine).toBeUndefined();
    expect(lines.find((l) => l.includes("typ host") && l.includes("::"))).toBeDefined();

    const relayLine = lines.find((l) => l.includes("typ relay"));
    expect(relayLine).toContain("198.51.100.1");
    expect(relayLine).toContain("raddr 0.0.0.0 rport 0");
  });

  it("sanitizes host IPs in createAnswer SDP", async () => {
    installWebRTCPatch(buildSnapshot());

    const pc = new RTCPeerConnection();
    const answer = await pc.createAnswer();

    expect(answer.sdp).toBeDefined();
    const lines = answer.sdp!.split("\r\n");

    const hostLine = lines.find((l) => l.includes("typ host"));
    expect(hostLine).toContain("0.0.0.0");
    expect(hostLine).not.toContain("10.0.0.1");
  });

  it("preserves instanceof behavior", () => {
    installWebRTCPatch(buildSnapshot());

    const pc = new RTCPeerConnection();
    expect(pc instanceof RTCPeerConnection).toBe(true);
  });

  it("skips patching when webRTC toggle is disabled", () => {
    installWebRTCPatch(buildSnapshot({ spoofingToggles: { webRTC: false } }));

    const pc = new RTCPeerConnection({ iceTransportPolicy: "all" });
    expect(pc.getConfiguration().iceTransportPolicy).toBe("all");
  });

  it("skips patching when fingerprint spoofing is not configured", () => {
    expect(installWebRTCPatch(buildSnapshot(null))).toEqual({
      standardConstructor: false,
      webkitConstructor: false,
      createOffer: false,
      createAnswer: false,
      setConfiguration: false,
    });

    const pc = new RTCPeerConnection({ iceTransportPolicy: "all" });
    expect(pc.getConfiguration().iceTransportPolicy).toBe("all");
  });

  it("accepts null configuration objects", () => {
    installWebRTCPatch(buildSnapshot());

    expect(
      () => new RTCPeerConnection(null as unknown as RTCConfiguration),
    ).not.toThrow();
    const pc = new RTCPeerConnection(null as unknown as RTCConfiguration);
    expect(pc.getConfiguration().iceTransportPolicy).toBe("relay");
  });

  it("delegates primitive RTCConfiguration errors to the native methods", () => {
    installWebRTCPatch(buildSnapshot());

    expect(() => new RTCPeerConnection(1 as unknown as RTCConfiguration)).toThrow(
      "Native RTCConfiguration conversion rejected a primitive",
    );
    const pc = new RTCPeerConnection();
    expect(() => pc.setConfiguration(1 as unknown as RTCConfiguration)).toThrow(
      "Native RTCConfiguration conversion rejected a primitive",
    );
  });

  it("skips gracefully when RTCPeerConnection is undefined", () => {
    vi.stubGlobal("RTCPeerConnection", undefined);

    expect(() => installWebRTCPatch(buildSnapshot())).not.toThrow();
  });

  it("protects a vendor-only webkitRTCPeerConnection surface", () => {
    vi.stubGlobal("RTCPeerConnection", undefined);
    vi.stubGlobal("webkitRTCPeerConnection", MockRTCPeerConnection);

    installWebRTCPatch(buildSnapshot());

    const WebkitRTC = (
      globalThis as typeof globalThis & {
        webkitRTCPeerConnection: typeof RTCPeerConnection;
      }
    ).webkitRTCPeerConnection;
    const pc = new WebkitRTC({ iceTransportPolicy: "all" });
    expect(pc.getConfiguration().iceTransportPolicy).toBe("relay");
    expect(globalThis.RTCPeerConnection).toBeUndefined();
  });

  it("masks the constructor with [native code] toString", () => {
    installWebRTCPatch(buildSnapshot());

    expect(RTCPeerConnection.toString()).toContain("[native code]");
  });

  it("preserves static properties like generateCertificate", () => {
    installWebRTCPatch(buildSnapshot());

    expect(
      (RTCPeerConnection as unknown as typeof MockRTCPeerConnection)
        .generateCertificate,
    ).toBeDefined();
    expect(
      (
        RTCPeerConnection as unknown as typeof MockRTCPeerConnection
      ).generateCertificate(),
    ).toBe("mock-certificate");
  });

  it("throws TypeError when called without new", () => {
    installWebRTCPatch(buildSnapshot());

    const PatchedRTC = globalThis.RTCPeerConnection;
    expect(() => {
      // @ts-expect-error — intentionally calling without new
      PatchedRTC({ iceServers: [] });
    }).toThrow(TypeError);
  });

  it("masks createOffer and createAnswer with [native code] toString", () => {
    installWebRTCPatch(buildSnapshot());

    expect(MockRTCPeerConnection.prototype.createOffer.toString()).toContain(
      "[native code]",
    );
    expect(MockRTCPeerConnection.prototype.createAnswer.toString()).toContain(
      "[native code]",
    );
  });

  it("preserves native createOffer and createAnswer arity", () => {
    const nativeCreateOfferLength = MockRTCPeerConnection.prototype.createOffer.length;
    const nativeCreateAnswerLength =
      MockRTCPeerConnection.prototype.createAnswer.length;

    installWebRTCPatch(buildSnapshot());

    expect(MockRTCPeerConnection.prototype.createOffer.length).toBe(
      nativeCreateOfferLength,
    );
    expect(MockRTCPeerConnection.prototype.createAnswer.length).toBe(
      nativeCreateAnswerLength,
    );
  });
});
