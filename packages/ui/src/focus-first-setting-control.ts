const SETTINGS_FOCUS_SELECTOR = [
  "button:not([disabled])",
  "input:not([type='hidden']):not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[role='slider'][tabindex]:not([tabindex='-1'])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

export const focusFirstSettingControl = (
  ...containers: Array<HTMLElement | null>
): boolean => {
  for (const container of containers) {
    const target = container?.querySelector<HTMLElement>(SETTINGS_FOCUS_SELECTOR);

    if (target) {
      target.focus();
      return true;
    }
  }

  return false;
};
