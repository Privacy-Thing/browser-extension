import type { MouseEventHandler } from "react";

import { fireAndForget } from "@/shared/async";

/** Keep the action popup focused so following a settings link preserves its draft. */
export const openInBackground: MouseEventHandler<HTMLAnchorElement> = (event) => {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  if (typeof chrome === "undefined" || !chrome.tabs?.create) return;
  event.preventDefault();
  fireAndForget(chrome.tabs.create({ url: event.currentTarget.href, active: false }));
};
