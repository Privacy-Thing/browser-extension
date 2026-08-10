import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ButtonProps } from "@/ui/components/ui/button";

export type ConfirmDialogConfig = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: "default" | "destructive";
  confirmVariant?: ButtonProps["variant"];
  cancelVariant?: ButtonProps["variant"];
  confirmClassName?: string;
  cancelClassName?: string;
  footerLayout?: "default" | "split";
  actionOrder?: "cancel-confirm" | "confirm-cancel";
  showOnboardingReset?: boolean;
};

export const useSettingsConfirmDialog = () => {
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmDialogConfig, setConfirmDialogConfig] =
    useState<ConfirmDialogConfig | null>(null);
  const confirmResolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const requestConfirmation = useCallback(
    (config: ConfirmDialogConfig): Promise<boolean> => {
      if (confirmResolverRef.current) {
        confirmResolverRef.current(false);
        confirmResolverRef.current = null;
      }

      setConfirmDialogConfig(config);
      setConfirmDialogOpen(true);

      return new Promise((resolve) => {
        confirmResolverRef.current = resolve;
      });
    },
    [],
  );

  const resolveConfirmDialog = useCallback((confirmed: boolean): void => {
    setConfirmDialogOpen(false);
    const resolver = confirmResolverRef.current;
    confirmResolverRef.current = null;
    resolver?.(confirmed);
  }, []);

  useEffect(() => {
    return () => {
      if (confirmResolverRef.current) {
        confirmResolverRef.current(false);
        confirmResolverRef.current = null;
      }
    };
  }, []);

  return {
    confirmDialogOpen,
    confirmDialogConfig,
    requestConfirmation,
    resolveConfirmDialog,
  };
};
