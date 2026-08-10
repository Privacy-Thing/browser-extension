import { createNativeSource, maskAsNative } from "../native/native-mask";

type RTCConfigurationLike = RTCConfiguration | null | undefined;

export const createPatchedPeerCtor = (
  NativeRTCPeerConnection: typeof RTCPeerConnection,
  patchConfiguration: (configuration: RTCConfigurationLike) => RTCConfigurationLike,
  onConstruct?: (
    originalConfiguration: RTCConfigurationLike,
    patchedConfiguration: RTCConfigurationLike,
  ) => void,
): typeof RTCPeerConnection => {
  const PatchedRTCPeerConnection = function RTCPeerConnection(
    this: RTCPeerConnection,
    configuration?: RTCConfiguration,
  ): RTCPeerConnection {
    if (!new.target) {
      throw new TypeError(
        "Failed to construct 'RTCPeerConnection': Please use the 'new' operator, this DOM object constructor cannot be called as a function.",
      );
    }

    const configurationValue: unknown = configuration;
    const isNonDictionaryPrimitive =
      configurationValue !== null &&
      configurationValue !== undefined &&
      typeof configurationValue !== "object" &&
      typeof configurationValue !== "function";
    const nextConfiguration = isNonDictionaryPrimitive
      ? configurationValue
      : patchConfiguration(configuration);
    if (!isNonDictionaryPrimitive) {
      onConstruct?.(configuration, nextConfiguration as RTCConfigurationLike);
    }
    return Reflect.construct(
      NativeRTCPeerConnection,
      [nextConfiguration as RTCConfiguration],
      new.target || NativeRTCPeerConnection,
    ) as RTCPeerConnection;
  } as unknown as typeof RTCPeerConnection;

  PatchedRTCPeerConnection.prototype = NativeRTCPeerConnection.prototype;

  const nativePrototypeDesc = Object.getOwnPropertyDescriptor(
    NativeRTCPeerConnection,
    "prototype",
  );
  if (nativePrototypeDesc && !nativePrototypeDesc.writable) {
    Object.defineProperty(PatchedRTCPeerConnection, "prototype", {
      writable: false,
    });
  }

  const nativeConstructorDesc = Object.getOwnPropertyDescriptor(
    NativeRTCPeerConnection.prototype,
    "constructor",
  );
  Object.defineProperty(PatchedRTCPeerConnection.prototype, "constructor", {
    value: PatchedRTCPeerConnection,
    configurable: nativeConstructorDesc?.configurable ?? true,
    writable: nativeConstructorDesc?.writable ?? true,
  });

  for (const key of Object.getOwnPropertyNames(NativeRTCPeerConnection)) {
    if (key === "prototype" || key === "length" || key === "name") {
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(NativeRTCPeerConnection, key);
    if (descriptor) {
      Object.defineProperty(PatchedRTCPeerConnection, key, descriptor);
    }
  }

  return maskAsNative(
    PatchedRTCPeerConnection,
    createNativeSource("RTCPeerConnection"),
    NativeRTCPeerConnection.length,
  ) as unknown as typeof RTCPeerConnection;
};
