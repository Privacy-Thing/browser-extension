/**
 * Keep these selectors aligned with UI_DATA_ATTRIBUTES.toast and
 * UI_DATA_ATTRIBUTES.toastProgress in src/shared/extension-contract.ts.
 * The toast shell lives in packages/ui now, but runtime and E2E selectors
 * still depend on the same DOM attribute contract.
 */
export const TOAST_DATA_ATTRIBUTES = {
  toast: "data-pt-toast",
  toastProgress: "data-pt-toast-progress",
} as const;
