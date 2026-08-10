/**
 * WebRTC IP leak protection patch.
 *
 * Prevents real IP address disclosure through WebRTC by:
 * 1. Forcing `iceTransportPolicy: 'relay'` on every RTCPeerConnection — the
 *    browser never gathers host or server-reflexive (srflx) candidates.
 * 2. Defence-in-depth: sanitising SDP output from `createOffer()` /
 *    `createAnswer()` to strip any residual host/srflx candidate lines.
 *
 * Unlike canvas/audio/WebGL noise, WebRTC IP leak protection is binary.
 */

import {
  createLogger,
  createOnceLogger,
} from "@privacy-brand/refract-browser/common/debug-logger";
import { markSurfaceUsed } from "@privacy-brand/refract-browser/common/surface-usage-emitter";
import { createPatchedPeerCtor } from "@privacy-brand/refract-core/fingerprint/rtc-peer-connection-wrapper";
import { isFpSurfaceEnabled } from "@privacy-brand/refract-core/fingerprint/surface-guards";
import { patchSdpFactoryMethod } from "@privacy-brand/refract-core/fingerprint/webrtc-sdp-factory-patcher";
import {
  createNativeSource,
  maskAsNative,
} from "@privacy-brand/refract-core/native/native-mask";

import type { WebRTCIntegrityOwnership } from "@/injection/main/surface-integrity";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import type { RuntimeSnapshot } from "@/shared/types";

type ExtendedRTCConfiguration = RTCConfiguration & {
  encodedInsertableStreams?: boolean;
  peerIdentity?: string;
};

const withRelayPolicy = (configuration?: RTCConfiguration | null): RTCConfiguration => {
  const source = (configuration ?? undefined) as ExtendedRTCConfiguration | undefined;
  const patchedConfiguration = Object.create(null) as ExtendedRTCConfiguration;
  const descriptors: PropertyDescriptorMap = {};
  for (const property of [
    "bundlePolicy",
    "certificates",
    ...(BUILD_BROWSER_TARGET === "chromium"
      ? (["encodedInsertableStreams"] as const)
      : []),
    "iceCandidatePoolSize",
    "iceServers",
    "iceTransportPolicy",
    ...(BUILD_BROWSER_TARGET === "firefox" ? (["peerIdentity"] as const) : []),
    "rtcpMuxPolicy",
  ] as const) {
    descriptors[property] = {
      configurable: true,
      enumerable: true,
      get(): unknown {
        const value =
          source === undefined
            ? undefined
            : (Reflect.get(source, property, source) as unknown);
        if (property !== "iceTransportPolicy") {
          return value;
        }

        if (value !== undefined) {
          const convertedValue = String(value);
          if (convertedValue !== "all" && convertedValue !== "relay") {
            throw new TypeError(
              `${convertedValue} is not a valid RTCIceTransportPolicy`,
            );
          }
        }
        return "relay";
      },
    };
  }
  Object.defineProperties(patchedConfiguration, descriptors);
  return patchedConfiguration;
};

const noWebRTCOwnership = (): WebRTCIntegrityOwnership => ({
  standardConstructor: false,
  webkitConstructor: false,
  createOffer: false,
  createAnswer: false,
  setConfiguration: false,
});

type PeerCtorInstallInput = {
  target: object;
  key: "RTCPeerConnection" | "webkitRTCPeerConnection";
  available: boolean;
  descriptor: PropertyDescriptor | undefined;
  PatchedPeer: typeof RTCPeerConnection;
};

const installPeerCtor = ({
  target,
  key,
  available,
  descriptor,
  PatchedPeer,
}: PeerCtorInstallInput): boolean => {
  if (
    !available ||
    (descriptor?.configurable === false && descriptor.writable === false)
  ) {
    return false;
  }
  Object.defineProperty(target, key, {
    configurable: descriptor?.configurable ?? true,
    writable: descriptor?.writable ?? false,
    enumerable: descriptor?.enumerable ?? false,
    value: PatchedPeer,
  });
  return true;
};

const installSdpPatches = (
  NativePeer: typeof RTCPeerConnection,
  ownership: WebRTCIntegrityOwnership,
): void => {
  const nativeOfferDesc = Object.getOwnPropertyDescriptor(
    NativePeer.prototype,
    "createOffer",
  );
  const nativeAnswerDesc = Object.getOwnPropertyDescriptor(
    NativePeer.prototype,
    "createAnswer",
  );
  patchSdpFactoryMethod(NativePeer.prototype, "createOffer", () => true, {
    descriptorOverrides: {
      configurable: nativeOfferDesc?.configurable ?? true,
      writable: nativeOfferDesc?.writable ?? true,
      enumerable: nativeOfferDesc?.enumerable ?? false,
    },
    onAccess: () => markSurfaceUsed("webRTC", "webRTC.createOffer"),
  });
  ownership.createOffer = true;
  patchSdpFactoryMethod(NativePeer.prototype, "createAnswer", () => true, {
    descriptorOverrides: {
      configurable: nativeAnswerDesc?.configurable ?? true,
      writable: nativeAnswerDesc?.writable ?? true,
      enumerable: nativeAnswerDesc?.enumerable ?? false,
    },
    onAccess: () => markSurfaceUsed("webRTC", "webRTC.createAnswer"),
  });
  ownership.createAnswer = true;
};

export const installWebRTCPatch = (
  snapshot: RuntimeSnapshot,
): WebRTCIntegrityOwnership => {
  const ownership = noWebRTCOwnership();
  if (!snapshot.fingerprint) {
    return ownership;
  }

  // Check per-surface toggle
  if (!isFpSurfaceEnabled(snapshot.fingerprint, "webRTC")) {
    return ownership;
  }

  const runtimeGlobal = globalThis as typeof globalThis & {
    webkitRTCPeerConnection?: typeof RTCPeerConnection;
  };
  const NativePeerConnection =
    typeof RTCPeerConnection === "function" ? RTCPeerConnection : undefined;
  const WebkitRTCPeerConnection = runtimeGlobal.webkitRTCPeerConnection;
  const NativeRTCPeerConnection = NativePeerConnection ?? WebkitRTCPeerConnection;
  if (!NativeRTCPeerConnection) {
    return ownership;
  }

  const logWebRTC = createLogger(snapshot, "WebRTC");
  const logWebRTCOnce = createOnceLogger(snapshot, "WebRTC");
  logWebRTC("install", [], {
    iceTransportPolicy: "relay",
  });

  const nativeDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "RTCPeerConnection",
  );
  const webkitDescriptor = Object.getOwnPropertyDescriptor(
    runtimeGlobal,
    "webkitRTCPeerConnection",
  );

  const PatchedRTCPeerConnection = createPatchedPeerCtor(
    NativeRTCPeerConnection,
    (configuration) => withRelayPolicy(configuration),
    () => {
      markSurfaceUsed("webRTC", "webRTC.constructor");
      logWebRTCOnce("new RTCPeerConnection", [], {
        iceTransportPolicy: "relay",
      });
    },
  );

  // Preserve the native descriptor shape. In Chromium, `RTCPeerConnection`
  // on `globalThis` has `writable: false, configurable: false` (or
  // `configurable: true` in some versions). We mirror the native descriptor
  // to avoid detection via `Object.getOwnPropertyDescriptor()`.
  ownership.standardConstructor = installPeerCtor({
    target: globalThis,
    key: "RTCPeerConnection",
    available: Boolean(NativePeerConnection),
    descriptor: nativeDescriptor,
    PatchedPeer: PatchedRTCPeerConnection,
  });
  ownership.webkitConstructor = installPeerCtor({
    target: runtimeGlobal,
    key: "webkitRTCPeerConnection",
    available: typeof runtimeGlobal.webkitRTCPeerConnection === "function",
    descriptor: webkitDescriptor,
    PatchedPeer: PatchedRTCPeerConnection,
  });

  const nativeSetConfigDesc = Object.getOwnPropertyDescriptor(
    NativeRTCPeerConnection.prototype,
    "setConfiguration",
  );
  const nativeSetConfiguration = nativeSetConfigDesc?.value;
  if (
    typeof nativeSetConfiguration === "function" &&
    nativeSetConfigDesc?.configurable !== false
  ) {
    const patchedSetConfiguration = maskAsNative(
      {
        setConfiguration(
          this: RTCPeerConnection,
          configuration?: RTCConfiguration,
        ): void {
          const configurationValue: unknown = configuration;
          const isNonDictionaryPrimitive =
            configurationValue !== null &&
            configurationValue !== undefined &&
            typeof configurationValue !== "object" &&
            typeof configurationValue !== "function";
          const patchedConfiguration = isNonDictionaryPrimitive
            ? configurationValue
            : withRelayPolicy(configuration);
          markSurfaceUsed("webRTC", "webRTC.constructor");
          logWebRTCOnce("setConfiguration", [], {
            iceTransportPolicy: "relay",
          });
          Reflect.apply(nativeSetConfiguration, this, [patchedConfiguration]);
        },
      }.setConfiguration,
      createNativeSource("setConfiguration"),
      nativeSetConfiguration.length,
    );

    Object.defineProperty(NativeRTCPeerConnection.prototype, "setConfiguration", {
      ...nativeSetConfigDesc,
      value: patchedSetConfiguration,
    });
    ownership.setConfiguration = true;
  }

  installSdpPatches(NativeRTCPeerConnection, ownership);
  return ownership;
};
