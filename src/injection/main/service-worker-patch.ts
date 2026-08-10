import { createLogger } from "@privacy-brand/refract-browser/common/debug-logger";
import { markSurfaceUsed } from "@privacy-brand/refract-browser/common/surface-usage-emitter";
import {
  createNativeSource,
  maskAsNative,
} from "@privacy-brand/refract-core/native/native-mask";
import {
  inspectPatchAnchors,
  markPatchAnchor,
} from "@privacy-brand/refract-core/runtime/patch-marker";

import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import type { RuntimeSnapshot } from "@/shared/types";

const createBlockedError = (scope: string, url: string): DOMException =>
  new DOMException(
    BUILD_BROWSER_TARGET === "firefox"
      ? `Failed to register/update a ServiceWorker for scope ('${scope}'): ` +
          `The operation is insecure for script ('${url}').`
      : `Failed to register a ServiceWorker for scope ('${scope}') ` +
          `with script ('${url}'): An SSL certificate error occurred ` +
          `when fetching the script.`,
    "SecurityError",
  );

export const installServiceWorker = (snapshot: RuntimeSnapshot): void => {
  if (
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    typeof ServiceWorkerContainer === "undefined"
  ) {
    return;
  }
  const logger = createLogger(snapshot, "ServiceWorker");
  const NativeRegister = ServiceWorkerContainer.prototype.register;
  const anchorState = inspectPatchAnchors(__PT_SW_PATCH_GUARD_KEY__, [
    { fn: NativeRegister, name: "register" },
  ]);
  if (anchorState === "installed") return;
  if (anchorState === "conflict") {
    throw new Error("Conflicting ServiceWorker.register patch anchor");
  }

  const PatchedRegister = maskAsNative(function (
    this: ServiceWorkerContainer,
    scriptURL: string | URL,
    ...rest: [RegistrationOptions?]
  ): Promise<ServiceWorkerRegistration> {
    const url = String(scriptURL);
    const scope = rest[0]?.scope ?? "/";
    logger("register", [url, ...rest]);
    if (snapshot.blockServiceWorkerRegistration) {
      logger("register [blocked]", [url, ...rest]);
      markSurfaceUsed("serviceWorker", "serviceWorker.register");
      return Promise.reject(createBlockedError(scope, url));
    }
    return Reflect.apply(NativeRegister, this, [scriptURL, ...rest]);
  }, createNativeSource("register"));
  markPatchAnchor(PatchedRegister, __PT_SW_PATCH_GUARD_KEY__, "register");
  Object.defineProperty(ServiceWorkerContainer.prototype, "register", {
    configurable: true,
    enumerable: true,
    value: PatchedRegister,
    writable: true,
  });
};
