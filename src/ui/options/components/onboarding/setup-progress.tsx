import { cn } from "@/ui/components/lib/utils";

const STEP_COUNT = 4;

export const SetupProgress = ({
  active,
  label,
  stepLabels,
  onSelect,
  selectableUntil,
}: {
  active: number;
  label: string;
  stepLabels?: readonly string[];
  onSelect?: (step: number) => void;
  selectableUntil?: number;
}) => {
  const fillScale = (active - 1) / (STEP_COUNT - 1);
  return (
    <div
      aria-label={label}
      data-setup-progress
      className="mx-auto h-[22px] w-full max-w-[340px]"
    >
      <div className="relative grid h-[22px] grid-cols-4 place-items-center">
        <div className="absolute left-[11px] right-[11px] top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-border" />
        <div
          className="absolute left-[11px] right-[11px] top-1/2 h-0.5 origin-left rounded-full bg-primary transition-transform duration-300 ease-out"
          style={{ transform: `translateY(-50%) scaleX(${fillScale})` }}
        />
        {Array.from({ length: STEP_COUNT }, (_, index) => {
          const item = index + 1;
          const reached = item <= active;
          const className = cn(
            "relative z-[1] grid h-[22px] w-[22px] place-items-center rounded-full border text-xs font-semibold leading-none transition-[background-color,border-color,color,transform] duration-300",
            reached
              ? "scale-100 border-primary bg-primary text-primary-foreground"
              : "scale-95 border-border bg-background text-muted-foreground",
          );
          if (!onSelect) {
            return (
              <div key={item} className={className}>
                {item}
              </div>
            );
          }
          const stepLabel = stepLabels?.[index];
          return (
            <button
              key={item}
              type="button"
              className={className}
              disabled={selectableUntil !== undefined && index > selectableUntil}
              aria-current={item === active ? "step" : undefined}
              aria-label={stepLabel ?? String(item)}
              onClick={() => onSelect(index)}
            >
              {item}
            </button>
          );
        })}
      </div>
    </div>
  );
};
