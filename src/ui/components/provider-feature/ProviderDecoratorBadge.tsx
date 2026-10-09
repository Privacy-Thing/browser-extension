import type { ProviderDecorator } from "@/shared/provider-feature";
import { cn } from "@/ui/components/lib/utils";

export type DecoratorBadgeProps = {
  decorator: ProviderDecorator;
  /** Sites in the group. Renders +N for the other sites when greater than 1. */
  groupSize?: number;
  label?: string;
  className?: string;
};

export const ProviderDecoratorBadge = ({
  decorator,
  groupSize,
  label,
  className,
}: DecoratorBadgeProps) => {
  const text = label ?? decorator.label;
  const extra = groupSize !== undefined && groupSize > 1 ? groupSize - 1 : 0;
  const initials = decorator.initials.slice(0, 2);
  const colors = decorator.badgeColors;
  return (
    <span
      data-provider-decorator-badge
      className={cn("inline-flex min-w-0 items-center gap-1.5", className)}
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
            "inline-flex size-[18px] shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold uppercase leading-none",
            colors ? "" : "border-border bg-secondary text-secondary-foreground",
          )}
        >
          {initials}
        </span>
      ) : null}
      <span className="min-w-0 truncate text-sm text-foreground">{text}</span>
      {extra > 0 ? (
        <span
          data-provider-feature-count={extra}
          className="shrink-0 text-xs text-muted-foreground"
        >
          +{extra}
        </span>
      ) : null}
    </span>
  );
};

export const ProviderFeatureBadge = ProviderDecoratorBadge;
