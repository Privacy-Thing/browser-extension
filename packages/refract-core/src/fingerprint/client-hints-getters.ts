import { createPublicArray, privateArraySet } from "../runtime/primordials";
import type { BrowserClientHints } from "../types/snapshot";

type DirectHighEntropyHint = keyof Pick<
  BrowserClientHints,
  | "architecture"
  | "bitness"
  | "platformVersion"
  | "model"
  | "formFactors"
  | "wow64"
  | "fullVersionList"
  | "mobile"
  | "platform"
  | "deviceMemory"
>;

export type HighEntropyHint = DirectHighEntropyHint | "uaFullVersion";
export type HighEntropyGetter = (clientHints: BrowserClientHints) => unknown;

export const DIRECT_ENTROPY_HINTS = [
  "architecture",
  "bitness",
  "platformVersion",
  "model",
  "formFactors",
  "wow64",
  "fullVersionList",
  "mobile",
  "platform",
  "deviceMemory",
] as const satisfies readonly DirectHighEntropyHint[];

type ClientHintBrand = { brand: string; version: string };

const cloneClientHintArray = (
  values: readonly (string | ClientHintBrand)[] | undefined,
): Array<string | ClientHintBrand> | undefined => {
  if (!values) return undefined;
  const result = createPublicArray<string | ClientHintBrand>(values.length);
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    privateArraySet(
      result,
      index,
      typeof value === "string"
        ? value
        : { brand: value.brand, version: value.version },
    );
  }
  return result;
};

export const cloneClientHintBrands = cloneClientHintArray as (
  brands: readonly ClientHintBrand[] | undefined,
) => ClientHintBrand[] | undefined;

const createDirectEntropy =
  (hint: DirectHighEntropyHint): HighEntropyGetter =>
  (clientHints) =>
    clientHints[hint];

const createClonedEntropy =
  (hint: "formFactors" | "fullVersionList"): HighEntropyGetter =>
  (clientHints) =>
    cloneClientHintArray(clientHints[hint]);

/**
 * Chromium still exposes uaFullVersion via the Chrome/Chromium entry inside
 * fullVersionList, so both main-world and worker client-hints patches should
 * reuse the same lookup instead of drifting on brand selection.
 */
export function getUaFullVersion(clientHints: BrowserClientHints): string | undefined {
  const brands = clientHints.fullVersionList;
  if (!brands) return undefined;
  for (let index = 0; index < brands.length; index += 1) {
    const brand = brands[index];
    if (brand?.brand === "Google Chrome" || brand?.brand === "Chromium") {
      return brand.version;
    }
  }
  return undefined;
}

export const HIGH_ENTROPY_GETTERS = {
  architecture: createDirectEntropy("architecture"),
  bitness: createDirectEntropy("bitness"),
  platformVersion: createDirectEntropy("platformVersion"),
  model: createDirectEntropy("model"),
  formFactors: createClonedEntropy("formFactors"),
  wow64: createDirectEntropy("wow64"),
  fullVersionList: createClonedEntropy("fullVersionList"),
  uaFullVersion: getUaFullVersion,
  mobile: createDirectEntropy("mobile"),
  platform: createDirectEntropy("platform"),
  deviceMemory: createDirectEntropy("deviceMemory"),
} satisfies Record<HighEntropyHint, HighEntropyGetter>;

export const ENTROPY_GETTERS_SOURCE = `const clientHintsObjectDefineProperty=Object.defineProperty;const cloneClientHintArray=(values)=>{if(!values)return;const result=new Array(values.length);for(let index=0;index<values.length;index+=1){const value=values[index];clientHintsObjectDefineProperty(result,index,{configurable:true,enumerable:true,writable:true,value:typeof value==="string"?value:{brand:value.brand,version:value.version}})}return result};const cloneClientHintBrands=cloneClientHintArray;function getUaFullVersion(clientHints){const brands=clientHints.fullVersionList;if(brands)for(let index=0;index<brands.length;index+=1){const brand=brands[index];if(brand?.brand==="Google Chrome"||brand?.brand==="Chromium")return brand.version}}const HIGH_ENTROPY_GETTERS={architecture:(hints)=>hints.architecture,bitness:(hints)=>hints.bitness,platformVersion:(hints)=>hints.platformVersion,model:(hints)=>hints.model,formFactors:(hints)=>cloneClientHintArray(hints.formFactors),wow64:(hints)=>hints.wow64,fullVersionList:(hints)=>cloneClientHintBrands(hints.fullVersionList),mobile:(hints)=>hints.mobile,platform:(hints)=>hints.platform,deviceMemory:(hints)=>hints.deviceMemory,uaFullVersion:getUaFullVersion};`;
