import type { ProviderDecorator } from "@/shared/provider-feature";
import { cn } from "@/ui/components/lib/utils";

export type DecoratorBadgeProps = {
  decorator: ProviderDecorator;
  label?: string;
  className?: string;
  /** When set, the label wraps beside the mark. */
  wrap?: boolean;
};

export const ProviderDecoratorBadge = ({
  decorator,
  label,
  className,
  wrap,
}: DecoratorBadgeProps) => {
  const text = label ?? decorator.label;
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
    </span>
  );
};

export const ProviderFeatureBadge = ProviderDecoratorBadge;
