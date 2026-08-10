import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./lib/utils";

type SettingsEmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  title?: ReactNode;
  description?: ReactNode;
  hint?: ReactNode;
  actions?: ReactNode;
  variant?: "plain" | "muted";
  centered?: boolean;
  titleClassName?: string;
  descriptionClassName?: string;
  hintClassName?: string;
  actionsClassName?: string;
};

export const SettingsEmptyState = ({
  title,
  description,
  hint,
  actions,
  variant = "plain",
  centered = false,
  className,
  titleClassName,
  descriptionClassName,
  hintClassName,
  actionsClassName,
  ...props
}: SettingsEmptyStateProps) => (
  <div
    className={cn(
      variant === "muted"
        ? "rounded-xl border border-dashed bg-muted/30 p-6"
        : "rounded-lg border border-dashed py-10 text-sm text-muted-foreground",
      centered && "text-center",
      className,
    )}
    {...props}
  >
    {title ? (
      <p className={cn("font-medium text-foreground", titleClassName)}>{title}</p>
    ) : null}
    {description ? (
      <div
        className={cn(
          title ? "mt-2" : undefined,
          "text-sm text-muted-foreground",
          descriptionClassName,
        )}
      >
        {description}
      </div>
    ) : null}
    {hint ? (
      <div className={cn("mt-2 text-sm text-muted-foreground", hintClassName)}>
        {hint}
      </div>
    ) : null}
    {actions ? (
      <div
        className={cn(
          "mt-4 flex flex-wrap gap-2",
          centered && "justify-center",
          actionsClassName,
        )}
      >
        {actions}
      </div>
    ) : null}
  </div>
);
