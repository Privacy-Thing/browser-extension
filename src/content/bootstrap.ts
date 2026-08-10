import {
  registerLogListener,
  registerErrorRelay,
  registerUsageRelay,
  registerUsageRequest,
  registerWorkerCsp,
} from "@/content/bootstrap-common";
import { runTargetBootstrap } from "@/content/bootstrap-target";

/** Active rule's diagnostic nonce - attached to XRay re-sync requests when available. */
let currentAuthKey: string | undefined;

const setCurrentAuthKey = (authKey: string | undefined): void => {
  currentAuthKey = authKey;
};

registerUsageRelay();
registerErrorRelay();
registerUsageRequest(() => currentAuthKey);
runTargetBootstrap({
  setCurrentAuthKey,
  registerLogListener,
  registerWorkerCsp,
});
