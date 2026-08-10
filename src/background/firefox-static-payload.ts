import {
  getFxStaticCandidatesKey,
  type FirefoxShimState,
  type FxStaticStateCandidate,
} from "@privacy-brand/refract-browser/common/firefox-shim-state";

import { getDomainRuleSpecificity } from "@/shared/domain-match";

export type FxSeedEntryLike = {
  pattern: string;
  state: FirefoxShimState;
};

export const buildFxStateCandidate = ({
  pattern,
  state,
}: FxSeedEntryLike): FxStaticStateCandidate => ({
  buildKey: __PT_SHIM_GUARD_KEY__,
  pattern,
  specificity: getDomainRuleSpecificity(pattern),
  state,
});

export const buildFxSeedSource = (candidate: FxStaticStateCandidate): string => {
  const encodedCandidate = JSON.stringify(candidate);
  const encodedSymbolKey = JSON.stringify(getFxStaticCandidatesKey());

  return `(()=>{const g=globalThis;const s=Symbol.for(${encodedSymbolKey});const next=${encodedCandidate};const current=Array.isArray(g[s])?g[s]:[];current.push(next);Object.defineProperty(g,s,{value:current,writable:true,configurable:true,enumerable:false});})();`;
};
