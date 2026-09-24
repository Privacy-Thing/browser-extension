import { useSyncExternalStore, type ReactNode } from "react";

import { getActiveUiLocale, subscribeActiveUiLocale } from "@/ui/i18n";
import type { UiLocale } from "@/ui/i18n";

export const useUiLocale = (): UiLocale =>
  useSyncExternalStore(subscribeActiveUiLocale, getActiveUiLocale, getActiveUiLocale);

export const LocaleRefresh = ({ children }: { children: ReactNode }) => {
  const locale = useUiLocale();
  return (
    <div key={locale} style={{ display: "contents" }}>
      {children}
    </div>
  );
};
