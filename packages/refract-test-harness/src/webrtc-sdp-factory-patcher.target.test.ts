import {
  patchSdpFactoryMethod,
  type SdpFactoryPrototype,
} from "@privacy-brand/refract-core";
import { describe, expect, it, vi } from "vitest";

class MockPeerConnection {
  async createOffer(
    _options?: RTCOfferOptions | RTCAnswerOptions,
  ): Promise<RTCSessionDescriptionInit> {
    return {
      type: "offer",
      sdp: [
        "v=0",
        "a=candidate:1 1 UDP 2130706431 192.168.1.100 12345 typ host",
        "a=candidate:2 1 UDP 16777215 198.51.100.1 9999 typ relay",
      ].join("\r\n"),
    };
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    return {
      type: "answer",
      sdp: "v=0\r\na=candidate:1 1 UDP 2130706431 10.0.0.1 12345 typ host",
    };
  }
}

describe("patchSdpFactoryMethod", () => {
  it("sanitizes SDP output when enabled", async () => {
    patchSdpFactoryMethod(
      MockPeerConnection.prototype as unknown as SdpFactoryPrototype,
      "createOffer",
      () => true,
    );

    const offer = await new MockPeerConnection().createOffer();

    expect(offer.sdp).toContain("0.0.0.0");
    expect(offer.sdp).not.toContain("192.168.1.100");
    expect(offer.sdp).toContain("198.51.100.1");
  });

  it("leaves SDP unchanged when sanitization is disabled", async () => {
    const nativePromise = new MockPeerConnection().createAnswer();
    class DisabledPeerConnection {
      createOffer(): Promise<RTCSessionDescriptionInit> {
        return nativePromise;
      }

      createAnswer(): Promise<RTCSessionDescriptionInit> {
        return nativePromise;
      }
    }
    patchSdpFactoryMethod(
      DisabledPeerConnection.prototype as unknown as SdpFactoryPrototype,
      "createAnswer",
      () => false,
    );

    const returnedPromise = new DisabledPeerConnection().createAnswer();
    const answer = await returnedPromise;

    expect(returnedPromise).toBe(nativePromise);
    expect(answer.sdp).toContain("10.0.0.1");
  });

  it("sanitizes the legacy createOffer success callback and preserves options and return", async () => {
    const nativeReturn = Promise.resolve();
    const options = { iceRestart: true };
    const failureCallback = vi.fn();
    let receivedOptions: RTCOfferOptions | undefined;
    let receivedFailure: unknown;
    class LegacyPeerConnection {
      createOffer(
        successCallback: (description: RTCSessionDescriptionInit) => void,
        failure: (error: DOMException) => void,
        nextOptions?: RTCOfferOptions,
      ): Promise<void> {
        receivedFailure = failure;
        receivedOptions = nextOptions;
        successCallback({
          type: "offer",
          sdp: "v=0\r\na=candidate:1 1 UDP 2130706431 192.168.1.100 12345 typ host",
        });
        return nativeReturn;
      }

      createAnswer(): Promise<RTCSessionDescriptionInit> {
        return Promise.resolve({ type: "answer", sdp: "v=0" });
      }
    }
    patchSdpFactoryMethod(
      LegacyPeerConnection.prototype as unknown as SdpFactoryPrototype,
      "createOffer",
      () => true,
    );
    const successCallback = vi.fn();

    const returned = (
      LegacyPeerConnection.prototype.createOffer as unknown as Function
    ).call(
      new LegacyPeerConnection(),
      successCallback,
      failureCallback,
      options,
    ) as Promise<void>;

    expect(returned).toBe(nativeReturn);
    expect(receivedFailure).toBe(failureCallback);
    expect(receivedOptions).toBe(options);
    expect(successCallback).toHaveBeenCalledOnce();
    expect(
      (successCallback.mock.calls[0]?.[0] as RTCSessionDescriptionInit).sdp,
    ).toContain("0.0.0.0");
    await returned;
  });

  it("preserves the legacy createAnswer failure callback and native return", async () => {
    const nativeError = new DOMException("Cannot answer", "InvalidStateError");
    const nativeReturn = Promise.resolve();
    class LegacyPeerConnection {
      createOffer(): Promise<RTCSessionDescriptionInit> {
        return Promise.resolve({ type: "offer", sdp: "v=0" });
      }

      createAnswer(
        _successCallback: (description: RTCSessionDescriptionInit) => void,
        failureCallback: (error: DOMException) => void,
      ): Promise<void> {
        failureCallback(nativeError);
        return nativeReturn;
      }
    }
    patchSdpFactoryMethod(
      LegacyPeerConnection.prototype as unknown as SdpFactoryPrototype,
      "createAnswer",
      () => true,
    );
    const successCallback = vi.fn();
    const failureCallback = vi.fn();

    const returned = (
      LegacyPeerConnection.prototype.createAnswer as unknown as Function
    ).call(
      new LegacyPeerConnection(),
      successCallback,
      failureCallback,
    ) as Promise<void>;

    expect(returned).toBe(nativeReturn);
    expect(successCallback).not.toHaveBeenCalled();
    expect(failureCallback).toHaveBeenCalledWith(nativeError);
    await returned;
  });

  it("preserves native receiver validation for modern and legacy overloads", () => {
    const validReceiver = {};
    const nativeMethod = function (this: unknown): Promise<RTCSessionDescriptionInit> {
      if (this !== validReceiver) {
        throw new TypeError("Illegal invocation");
      }
      return Promise.resolve({ type: "offer", sdp: "v=0" });
    };
    const prototype = {
      createOffer: nativeMethod,
      createAnswer: nativeMethod,
    } as unknown as SdpFactoryPrototype;
    patchSdpFactoryMethod(prototype, "createOffer", () => true);

    expect(() => Reflect.apply(prototype.createOffer, {}, [])).toThrow(
      "Illegal invocation",
    );
    expect(() => Reflect.apply(prototype.createOffer, {}, [vi.fn(), vi.fn()])).toThrow(
      "Illegal invocation",
    );
  });

  it("preserves arity, native masking, and descriptor overrides", () => {
    const nativeLength = MockPeerConnection.prototype.createOffer.length;

    patchSdpFactoryMethod(
      MockPeerConnection.prototype as unknown as SdpFactoryPrototype,
      "createOffer",
      () => true,
      {
        descriptorOverrides: {
          configurable: false,
          writable: false,
          enumerable: true,
        },
      },
    );

    const descriptor = Object.getOwnPropertyDescriptor(
      MockPeerConnection.prototype,
      "createOffer",
    );

    expect(MockPeerConnection.prototype.createOffer.length).toBe(nativeLength);
    expect(MockPeerConnection.prototype.createOffer.toString()).toContain(
      "[native code]",
    );
    expect(descriptor).toMatchObject({
      configurable: false,
      writable: false,
      enumerable: true,
    });
  });

  it("reports sanitized factory method access", async () => {
    class LocalPeerConnection {
      async createOffer(): Promise<RTCSessionDescriptionInit> {
        return {
          type: "offer",
          sdp: "v=0\r\na=candidate:1 1 UDP 2130706431 10.0.0.1 12345 typ host",
        };
      }

      async createAnswer(): Promise<RTCSessionDescriptionInit> {
        return { type: "answer", sdp: "v=0" };
      }
    }

    let calls = 0;
    patchSdpFactoryMethod(
      LocalPeerConnection.prototype as unknown as SdpFactoryPrototype,
      "createOffer",
      () => true,
      {
        onAccess: () => {
          calls += 1;
        },
      },
    );

    await new LocalPeerConnection().createOffer();

    expect(calls).toBe(1);
  });
});
