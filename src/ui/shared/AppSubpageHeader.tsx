import type { MouseEventHandler, ReactNode } from "react";

import { cn } from "@/ui/components/lib/utils";
import { Button } from "@/ui/components/ui/button";

export const AppSubpageHeader = ({
  title,
  lead,
  backLabel,
  backAriaLabel,
  backIconOnly = false,
  backHref,
  onBack,
  actions,
  className,
}: {
  title: ReactNode;
  lead?: ReactNode;
  backLabel?: ReactNode;
  backAriaLabel?: string;
  backIconOnly?: boolean;
  backHref?: string;
  onBack?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  actions?: ReactNode;
  className?: string;
}) => {
  const handleBackClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    if (onBack) {
      onBack(event);
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    if (backHref) {
      window.location.href = backHref;
    }
  };
  const backButtonProps =
    backIconOnly && backAriaLabel
      ? { "aria-label": backAriaLabel, title: backAriaLabel }
      : {};
  const backButtonContent = backIconOnly ? (
    <span className="sr-only">{backAriaLabel ?? backLabel}</span>
  ) : (
    backLabel
  );

  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2 sm:gap-3">
          <div className="shrink-0 pt-0.5">
            {backLabel ? (
              <Button
                type="button"
                variant="ghost"
                size={backIconOnly ? "icon-sm" : "sm"}
                className={cn("shrink-0", backIconOnly ? "w-7 px-0" : "w-fit")}
                onClick={handleBackClick}
                {...backButtonProps}
              >
                <span className="fa-solid fa-arrow-left" aria-hidden="true" />
                {backButtonContent}
              </Button>
            ) : null}
          </div>

          <div className="min-w-0 pt-0.5">
            <h2 className="min-w-0 text-xl font-semibold leading-tight tracking-tight text-foreground">
              {title}
            </h2>
            {lead ? (
              <p className="mt-1 max-w-[72ch] text-xs leading-relaxed text-muted-foreground">
                {lead}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </section>
  );
};
