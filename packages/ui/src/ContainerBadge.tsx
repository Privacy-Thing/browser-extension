import { cn } from "./lib/utils";

export type ContainerBadgeProps = {
  name: string;
  iconUrl?: string | null;
  colorCode?: string | null;
  accentName?: boolean;
  className?: string;
  nameClassName?: string;
};

export const ContainerBadge = ({
  name,
  iconUrl,
  colorCode,
  accentName = false,
  className,
  nameClassName,
}: ContainerBadgeProps) => {
  const accent = colorCode ?? "#34d399";

  return (
    <div
      className={cn("inline-flex max-w-full items-center gap-3 text-left", className)}
    >
      <span
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-foreground"
        style={{
          color: accent,
        }}
        aria-hidden="true"
      >
        {iconUrl ? (
          <span
            className="block h-5 w-5 bg-current"
            style={{
              maskImage: `url("${iconUrl}")`,
              maskRepeat: "no-repeat",
              maskPosition: "center",
              maskSize: "contain",
              WebkitMaskImage: `url("${iconUrl}")`,
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              WebkitMaskSize: "contain",
            }}
          />
        ) : (
          <span
            className="block h-3 w-3 rounded-[4px] border"
            style={{ backgroundColor: accent, borderColor: `${accent}88` }}
          />
        )}
      </span>
      <p
        className={cn("truncate text-base font-medium text-foreground", nameClassName)}
        style={accentName ? { color: accent } : undefined}
      >
        {name}
      </p>
    </div>
  );
};
