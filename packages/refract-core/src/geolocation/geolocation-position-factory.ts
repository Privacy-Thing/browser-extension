import { createNativeSource, maskAsNative } from "../native/native-mask";

type SerializableValue = () => Record<string, unknown>;

type PrototypeSerializeState = readonly [WeakMap<object, SerializableValue>, boolean];

const prototypeSerializeStates = new WeakMap<object, PrototypeSerializeState>();

const getSerializationState = (prototype: object): PrototypeSerializeState => {
  const existing = prototypeSerializeStates.get(prototype);
  if (existing) {
    return existing;
  }

  const registrations = new WeakMap<object, SerializableValue>();
  const nativeDescriptor = Object.getOwnPropertyDescriptor(prototype, "toJSON");
  const nativeToJSON = nativeDescriptor?.value;
  const canPatchPrototype =
    typeof nativeToJSON === "function" && nativeDescriptor?.configurable !== false;

  if (canPatchPrototype) {
    const patchedToJSON = maskAsNative(
      {
        toJSON(this: object): Record<string, unknown> {
          const serialize = registrations.get(this);
          if (serialize) {
            return serialize();
          }

          return Reflect.apply(nativeToJSON, this, []) as Record<string, unknown>;
        },
      }.toJSON,
      createNativeSource("toJSON"),
      nativeToJSON.length,
    );

    Object.defineProperty(prototype, "toJSON", {
      ...nativeDescriptor,
      value: patchedToJSON,
    });
  }

  const state = [registrations, canPatchPrototype] as const;
  prototypeSerializeStates.set(prototype, state);
  return state;
};

const registerSerializedValue = (
  value: object,
  prototype: object,
  serialize: SerializableValue,
): void => {
  const [registrations, usesPrototypeMethod] = getSerializationState(prototype);
  registrations.set(value, serialize);
  if (usesPrototypeMethod) {
    return;
  }

  Object.defineProperty(value, "toJSON", {
    configurable: true,
    enumerable: false,
    writable: true,
    value: maskAsNative({ toJSON: serialize }.toJSON, createNativeSource("toJSON"), 0),
  });
};

export type GeoCoordinateValues = Pick<
  GeolocationCoordinates,
  | "accuracy"
  | "altitude"
  | "altitudeAccuracy"
  | "heading"
  | "latitude"
  | "longitude"
  | "speed"
>;

export const createGeoPositionFactory = (targetGlobal: typeof globalThis) => {
  const PositionProto =
    (targetGlobal as any).GeolocationPosition?.prototype ?? Object.prototype;
  const CoordsProto =
    (targetGlobal as any).GeolocationCoordinates?.prototype ?? Object.prototype;

  return (
    coordinateValues: GeoCoordinateValues,
    timestamp: number,
  ): GeolocationPosition => {
    const coords = { ...coordinateValues } as GeolocationCoordinates;
    Object.setPrototypeOf(coords, CoordsProto);
    const serializeCoords = (): Record<string, unknown> => ({
      accuracy: coords.accuracy,
      latitude: coords.latitude,
      longitude: coords.longitude,
      altitude: coords.altitude,
      altitudeAccuracy: coords.altitudeAccuracy,
      heading: coords.heading,
      speed: coords.speed,
    });
    registerSerializedValue(coords, CoordsProto, serializeCoords);

    const position = { coords, timestamp } as GeolocationPosition;
    Object.setPrototypeOf(position, PositionProto);
    registerSerializedValue(position, PositionProto, () => ({
      timestamp: position.timestamp,
      coords: serializeCoords(),
    }));
    return position;
  };
};
