import { getSafeCandidateAddress, sanitizeSdp } from "@privacy-brand/refract-core";
import { describe, expect, it } from "vitest";

describe("webrtc-sanitize", () => {
  it("sanitizes IPv4 and IPv6 host candidate addresses", () => {
    expect(getSafeCandidateAddress("192.168.1.10")).toBe("0.0.0.0");
    expect(getSafeCandidateAddress("2001:db8::1")).toBe("::");
  });

  it("rewrites host and srflx candidates without touching relay candidates", () => {
    const sdp = [
      "v=0",
      "a=candidate:1 1 udp 2122260223 192.168.1.10 54400 typ host generation 0",
      "a=candidate:2 1 udp 1686052607 203.0.113.25 3478 typ srflx raddr 192.168.1.10 rport 54400",
      "a=candidate:3 1 udp 41819902 2001:db8::1 54401 typ host generation 0",
      "a=candidate:4 1 udp 41819902 203.0.113.50 3478 typ relay raddr 0.0.0.0 rport 0",
    ].join("\r\n");

    expect(sanitizeSdp(sdp)).toBe(
      [
        "v=0",
        "a=candidate:1 1 udp 2122260223 0.0.0.0 54400 typ host generation 0",
        "a=candidate:2 1 udp 1686052607 0.0.0.0 3478 typ srflx raddr 0.0.0.0 rport 54400",
        "a=candidate:3 1 udp 41819902 :: 54401 typ host generation 0",
        "a=candidate:4 1 udp 41819902 203.0.113.50 3478 typ relay raddr 0.0.0.0 rport 0",
      ].join("\r\n"),
    );
  });

  it("sanitizes every related address without changing relay addresses or ports", () => {
    const sdp = [
      "a=candidate:1 1 udp 1 198.51.100.10 5000 typ relay raddr 192.168.1.10 rport 6000",
      "a=candidate:2 1 udp 1 2001:db8::10 5001 typ relay raddr fd00::1 rport 6001",
    ].join("\r\n");

    expect(sanitizeSdp(sdp)).toBe(
      [
        "a=candidate:1 1 udp 1 198.51.100.10 5000 typ relay raddr 0.0.0.0 rport 6000",
        "a=candidate:2 1 udp 1 2001:db8::10 5001 typ relay raddr :: rport 6001",
      ].join("\r\n"),
    );
  });

  it("leaves relay SDP with an already-sanitized related address untouched", () => {
    const sdp = [
      "v=0",
      "a=candidate:4 1 udp 41819902 203.0.113.50 3478 typ relay raddr 0.0.0.0 rport 0",
    ].join("\r\n");

    expect(sanitizeSdp(sdp)).toBe(sdp);
  });
});
