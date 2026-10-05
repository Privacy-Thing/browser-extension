import { InvalidTimeZoneError } from "@/shared/time-zone-validation";

/** Keep one legacy preset from aborting a catalog; never hide unrelated failures. */
export const recoverInvalidProfile = <T>(
  build: () => T,
  onInvalid: () => T | null = () => null,
): T | null => {
  try {
    return build();
  } catch (error) {
    if (!(error instanceof InvalidTimeZoneError)) throw error;
    return onInvalid();
  }
};
