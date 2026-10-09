import { providerFeatureCopy } from "./provider-feature-copy";

import type { ProviderDecorator } from "@/shared/provider-feature";
import { cn } from "@/ui/components/lib/utils";
import { useUiLocale } from "@/ui/i18n/LocaleRefresh";

export type DecoratorBadgeProps = {
  decorator: ProviderDecorator;
  /** Sites in this service binding. The total is shown when greater than 1. */
  groupSize?: number;
  label?: string;
  className?: string;
  /** When set, the label wraps beside the mark. */
  wrap?: boolean;
};

export const ProviderDecoratorBadge = ({
  decorator,
  groupSize,
  label,
  className,
  wrap,
}: DecoratorBadgeProps) => {
  const locale = useUiLocale();
  const text = label ?? decorator.label;
  const siteCount = groupSize !== undefined && groupSize > 1 ? groupSize : 0;
  const initials = decorator.initials.slice(0, 2);
  const colors = decorator.badgeColors;
  return (
    <span
      data-provider-decorator-badge
      className={cn(
        "inline-flex min-w-0 gap-1.5",
        wrap ? "items-start" : "items-center",
        className,
      )}
    >
      {initials ? (
        <span
          aria-hidden="true"
          data-provider-initials={initials}
          title={decorator.providerName}
          style={
            colors
              ? {
                  backgroundColor: colors.background,
                  color: colors.foreground,
                  borderColor: colors.background,
                }
              : undefined
          }
          className={cn(
            "inline-flex size-[24px] shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold uppercase leading-none",
            colors ? "" : "border-border bg-secondary text-secondary-foreground",
          )}
        >
          {initials}
        </span>
      ) : null}
      <span
        className={cn(
          "min-w-0 text-sm text-foreground",
          wrap ? "whitespace-normal" : "truncate",
        )}
      >
        {text}
      </span>
      {siteCount > 0 ? (
        <span
          data-provider-feature-site-count={siteCount}
          className="shrink-0 text-xs text-muted-foreground"
        >
          {providerFeatureCopy[locale].siteCount(siteCount)}
        </span>
      ) : null}
    </span>
  );
};

export const ProviderFeatureBadge = ProviderDecoratorBadge;
