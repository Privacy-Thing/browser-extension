import type { UserAgentDataLike } from "./browser-fingerprint-source.js";
import type {
  BrowserClientHintBrand,
  BrowserClientHints,
} from "./fingerprint-types.js";

export const buildClientHints = (
  nativeHints: UserAgentDataLike | null | undefined,
  brands: BrowserClientHintBrand[] | undefined,
  fullVersionList: BrowserClientHintBrand[] | undefined,
  sourcePlatform: string | undefined,
): BrowserClientHints | undefined => {
  if (!nativeHints) return undefined;

  const clientHints: BrowserClientHints = {
    mobile: typeof nativeHints.mobile === "boolean" ? nativeHints.mobile : false,
  };
  const platform =
    typeof nativeHints.platform === "string" ? nativeHints.platform : sourcePlatform;

  if (brands) clientHints.brands = brands;
  if (fullVersionList) clientHints.fullVersionList = fullVersionList;
  if (platform) clientHints.platform = platform;

  return clientHints;
};

/** Serializes Client Hint brands into the Sec-CH-UA header value format. */
export const quoteHeaderString = (value: string): string =>
  `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

export const serializeHintBrands = (
  brands: readonly BrowserClientHintBrand[] | undefined,
): string | undefined =>
  brands
    ?.map(
      (brand) =>
        `${quoteHeaderString(brand.brand)};v=${quoteHeaderString(brand.version)}`,
    )
    .join(", ");
