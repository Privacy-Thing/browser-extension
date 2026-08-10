export const ACTION_ICON_PATHS = {
  neutral: {
    16: "icons/icon-16.png",
    32: "icons/icon-32.png",
    48: "icons/icon-48.png",
    128: "icons/icon-128.png",
  },
  unsupported: {
    16: "icons/icon-unsupported-16.png",
    32: "icons/icon-unsupported-32.png",
    48: "icons/icon-unsupported-48.png",
    128: "icons/icon-unsupported-128.png",
  },
  active: {
    16: "icons/icon-16.png",
    32: "icons/icon-32.png",
    48: "icons/icon-48.png",
    128: "icons/icon-128.png",
  },
  "attention-1": {
    16: "icons/icon-attention-1-16.png",
    32: "icons/icon-attention-1-32.png",
    48: "icons/icon-attention-1-48.png",
    128: "icons/icon-attention-1-128.png",
  },
  "attention-2": {
    16: "icons/icon-attention-2-16.png",
    32: "icons/icon-attention-2-32.png",
    48: "icons/icon-attention-2-48.png",
    128: "icons/icon-attention-2-128.png",
  },
  attention: {
    16: "icons/icon-attention-16.png",
    32: "icons/icon-attention-32.png",
    48: "icons/icon-attention-48.png",
    128: "icons/icon-attention-128.png",
  },
  off: {
    16: "icons/icon-off-16.png",
    32: "icons/icon-off-32.png",
    48: "icons/icon-off-48.png",
    128: "icons/icon-off-128.png",
  },
} as const;

export const toExtensionIconPaths = (
  paths: Record<number, string>,
): Record<number, string> =>
  Object.fromEntries(
    Object.entries(paths).map(([size, iconPath]) => [
      Number(size),
      chrome.runtime.getURL(iconPath),
    ]),
  ) as Record<number, string>;
