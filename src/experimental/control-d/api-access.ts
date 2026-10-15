import { CONTROL_D_API_ORIGIN } from "./contracts";

/**
 * Firefox accepts `permissions.request()` only in the task that handles the user
 * gesture, so it must not follow an awaited call. An origin that is already granted
 * resolves `true` without a prompt in both browsers.
 */
export const requestApiAccess = (): Promise<boolean> =>
  chrome.permissions.request({ origins: [CONTROL_D_API_ORIGIN] });
