import type { ProviderDecorator } from "@/shared/provider-feature";
import { cn } from "@/ui/components/lib/utils";

export type ProviderLabelMode = "initials" | "name";

export type DecoratorBadgeProps = {
  decorator: ProviderDecorator;
  label?: string;
  /** Provider mark: initials circle, or the full name as a brand pill. */
  providerLabel?: ProviderLabelMode;
  className?: string;
  /** When set, the label wraps beside the mark. */
  wrap?: boolean;
};

const plainMarkClass = "border-border bg-secondary text-secondary-foreground";

const badgeStyle = (decorator: ProviderDecorator) => {
  const colors = decorator.badgeColors;
  if (!colors) return undefined;
  return {
    backgroundColor: colors.background,
    color: colors.foreground,
    borderColor: colors.background,
  };
};

const InitialsMark = ({ decorator }: { decorator: ProviderDecorator }) => {
  const initials = decorator.initials.slice(0, 2);
  if (!initials) return null;
  return (
    <span
      aria-hidden="true"
      data-provider-initials={initials}
      title={decorator.providerName}
      style={badgeStyle(decorator)}
      className={cn(
        "inline-flex size-[24px] shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold uppercase leading-none",
        decorator.badgeColors ? undefined : plainMarkClass,
      )}
    >
      {initials}
    </span>
  );
};

const NameMark = ({ decorator }: { decorator: ProviderDecorator }) => (
  <span
    data-provider-name={decorator.providerName}
    style={badgeStyle(decorator)}
    className={cn(
      "inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 text-xs font-semibold leading-none",
      decorator.badgeColors ? undefined : plainMarkClass,
    )}
  >
    {decorator.providerName}
  </span>
);

export const ProviderDecoratorBadge = ({
  decorator,
  label,
  providerLabel = "initials",
  className,
  wrap,
}: DecoratorBadgeProps) => {
  const text = label ?? decorator.label;
  return (
    <span
      data-provider-decorator-badge
      data-provider-label={providerLabel}
      className={cn(
        "inline-flex min-w-0 gap-1.5",
        wrap ? "items-start" : "items-center",
        className,
      )}
    >
      {providerLabel === "name" ? (
        <NameMark decorator={decorator} />
      ) : (
        <InitialsMark decorator={decorator} />
      )}
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
