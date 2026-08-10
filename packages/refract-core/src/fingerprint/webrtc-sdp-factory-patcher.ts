import { createNativeSource, maskAsNative } from "../native/native-mask";

import { sanitizeSdp } from "./webrtc-sanitize";

type SdpFactoryMethod = "createOffer" | "createAnswer";

type WebRTCSdpSuccessCallback = (description: RTCSessionDescriptionInit) => void;
type WebRTCSdpFailureCallback = (error: DOMException) => void;

type WebRTCSdpFactoryMethod = {
  (
    this: RTCPeerConnection,
    options?: RTCOfferOptions | RTCAnswerOptions,
  ): Promise<RTCSessionDescriptionInit>;
  (
    this: RTCPeerConnection,
    successCallback: WebRTCSdpSuccessCallback,
    failureCallback: WebRTCSdpFailureCallback,
    options?: RTCOfferOptions | RTCAnswerOptions,
  ): Promise<void>;
};

type SdpFactoryRuntime = (
  this: RTCPeerConnection,
  ...args: unknown[]
) => Promise<RTCSessionDescriptionInit | void>;

export type SdpFactoryPrototype = Record<SdpFactoryMethod, WebRTCSdpFactoryMethod>;

type SdpDescriptorOverrides = Partial<
  Pick<PropertyDescriptor, "configurable" | "writable" | "enumerable">
>;

type SdpFactoryOptions = {
  descriptorOverrides?: SdpDescriptorOverrides;
  onAccess?: () => void;
};

const hasOwnDescriptorOverride = <TKey extends keyof SdpDescriptorOverrides>(
  overrides: SdpDescriptorOverrides,
  key: TKey,
): overrides is SdpDescriptorOverrides & Required<Pick<SdpDescriptorOverrides, TKey>> =>
  Object.prototype.hasOwnProperty.call(overrides, key);

export const patchSdpFactoryMethod = (
  prototype: SdpFactoryPrototype,
  property: SdpFactoryMethod,
  shouldSanitize: () => boolean,
  patchOptions: SdpFactoryOptions = {},
): void => {
  const descriptorOverrides = patchOptions.descriptorOverrides ?? {};
  const nativeMethod = prototype[property] as unknown as SdpFactoryRuntime;
  const nativeDescriptor = Object.getOwnPropertyDescriptor(prototype, property);

  const sanitizeDescription = (
    description: RTCSessionDescriptionInit,
  ): RTCSessionDescriptionInit => {
    if (!shouldSanitize() || !description.sdp) {
      return description;
    }

    patchOptions.onAccess?.();
    description.sdp = sanitizeSdp(description.sdp);
    return description;
  };

  const patchedMethod = {
    [property](
      this: RTCPeerConnection,
      ...args: unknown[]
    ): Promise<RTCSessionDescriptionInit | void> {
      const successCallback = args[0];
      if (typeof successCallback === "function") {
        const wrappedSuccessCallback = function (
          this: unknown,
          description: RTCSessionDescriptionInit,
          ...callbackArgs: unknown[]
        ): unknown {
          return Reflect.apply(successCallback, this, [
            sanitizeDescription(description),
            ...callbackArgs,
          ]);
        };
        return Reflect.apply(nativeMethod, this, [
          wrappedSuccessCallback,
          ...args.slice(1),
        ]) as Promise<void>;
      }

      const nativeResult = Reflect.apply(
        nativeMethod,
        this,
        args,
      ) as Promise<RTCSessionDescriptionInit>;
      if (!shouldSanitize()) {
        return nativeResult;
      }
      return nativeResult.then(sanitizeDescription);
    },
  }[property] as SdpFactoryRuntime;

  const patchedDescriptor: PropertyDescriptor = {
    value: maskAsNative(
      patchedMethod,
      createNativeSource(property),
      nativeMethod.length,
    ),
  };

  if (hasOwnDescriptorOverride(descriptorOverrides, "configurable")) {
    patchedDescriptor.configurable = descriptorOverrides.configurable;
  } else if (nativeDescriptor?.configurable !== undefined) {
    patchedDescriptor.configurable = nativeDescriptor.configurable;
  }

  if (hasOwnDescriptorOverride(descriptorOverrides, "writable")) {
    patchedDescriptor.writable = descriptorOverrides.writable;
  } else if (nativeDescriptor?.writable !== undefined) {
    patchedDescriptor.writable = nativeDescriptor.writable;
  }

  if (hasOwnDescriptorOverride(descriptorOverrides, "enumerable")) {
    patchedDescriptor.enumerable = descriptorOverrides.enumerable;
  }

  Object.defineProperty(prototype, property, patchedDescriptor);
};
