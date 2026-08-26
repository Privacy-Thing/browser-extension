import type { FirefoxShimState } from "@privacy-brand/refract-browser/common/firefox-shim-state";

import { applyFencedNoiseSeeds, getSiteKey } from "@/shared/domain-fencing";

/**
 * Finalizes a shared-carrier fencing marker on Firefox shim state. Noise seeds
 * become per-site; catalog-driven fields stay at the carried base values.
 */
export const fenceFxShimState = (
  state: FirefoxShimState,
  hostname: string,
): FirefoxShimState => {
  if (!state.fingerprint?.fencing) {
    return state;
  }
  return {
    ...state,
    fingerprint: applyFencedNoiseSeeds(state.fingerprint, getSiteKey(hostname)),
  };
};
