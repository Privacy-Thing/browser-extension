import { isFpSurfaceEnabled } from "@privacy-brand/refract-core/fingerprint/surface-guards";

import { serializeHintBrands } from "@/shared/browser-fingerprint";
import type { DynamicHeaderRule, RuntimeSnapshot } from "@/shared/types";

const SET_HEADER = "set" as chrome.declarativeNetRequest.HeaderOperation;

export const buildRequestHeaders = (
  snapshot: RuntimeSnapshot,
): DynamicHeaderRule["action"]["requestHeaders"] => {
  const requestHeaders: DynamicHeaderRule["action"]["requestHeaders"] = [];
  if (snapshot.timeLocaleEnabled !== false && snapshot.locale) {
    requestHeaders.push({
      header: "Accept-Language",
      operation: SET_HEADER,
      value: snapshot.locale.acceptLanguage,
    });
  }
  if (
    isFpSurfaceEnabled(snapshot.fingerprint, "navigator") &&
    snapshot.fingerprint?.userAgent
  ) {
    requestHeaders.push({
      header: "User-Agent",
      operation: SET_HEADER,
      value: snapshot.fingerprint.userAgent,
    });
  }
  if (snapshot.fingerprint?.spoofingToggles?.clientHints === false) {
    return requestHeaders;
  }
  const clientHints = snapshot.fingerprint?.clientHints;
  const brandsHeader = serializeHintBrands(clientHints?.brands);
  const fullVersionListHeader = serializeHintBrands(clientHints?.fullVersionList);
  if (brandsHeader) {
    requestHeaders.push({
      header: "Sec-CH-UA",
      operation: SET_HEADER,
      value: brandsHeader,
    });
  }
  if (clientHints?.platform) {
    requestHeaders.push({
      header: "Sec-CH-UA-Platform",
      operation: SET_HEADER,
      value: `"${clientHints.platform.replace(/"/g, '\\"')}"`,
    });
  }
  if (typeof clientHints?.mobile === "boolean") {
    requestHeaders.push({
      header: "Sec-CH-UA-Mobile",
      operation: SET_HEADER,
      value: clientHints.mobile ? "?1" : "?0",
    });
  }
  if (fullVersionListHeader) {
    requestHeaders.push({
      header: "Sec-CH-UA-Full-Version-List",
      operation: SET_HEADER,
      value: fullVersionListHeader,
    });
  }
  return requestHeaders;
};
