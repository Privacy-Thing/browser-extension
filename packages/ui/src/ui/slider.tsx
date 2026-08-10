/* eslint-disable react/no-array-index-key -- slider thumb slot order is the stable identity */
import * as SliderPrimitive from "@radix-ui/react-slider";
import { forwardRef } from "react";

import { cn } from "../lib/utils";

type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
  label?: React.ReactNode;
  valueLabel?: React.ReactNode;
  minLabel?: React.ReactNode;
  maxLabel?: React.ReactNode;
  rootClassName?: string;
};

const Slider = forwardRef<React.ComponentRef<typeof SliderPrimitive.Root>, SliderProps>(
  (
    {
      className,
      label,
      valueLabel,
      minLabel,
      maxLabel,
      rootClassName,
      "aria-label": ariaLabel,
      ...props
    },
    ref,
  ) => {
    const values = props.value ?? props.defaultValue ?? [0];
    const hasHeader = label !== undefined || valueLabel !== undefined;
    const hasFooter = minLabel !== undefined || maxLabel !== undefined;

    return (
      <div className={cn("grid w-full gap-2", className)}>
        {hasHeader ? (
          <div className="flex items-start gap-3">
            {label !== undefined ? (
              <div className="min-w-0 flex-1 text-sm font-medium">{label}</div>
            ) : (
              <div className="flex-1" />
            )}
            {valueLabel !== undefined ? (
              <div className="text-right text-sm font-medium tabular-nums text-foreground">
                {valueLabel}
              </div>
            ) : null}
          </div>
        ) : null}

        <SliderPrimitive.Root
          ref={ref}
          className={cn(
            "group relative flex w-full cursor-pointer touch-none select-none items-center",
            rootClassName,
          )}
          {...props}
        >
          <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-[color:var(--gw-form-border-color)] transition-colors group-hover:bg-[color:var(--gw-form-border-hover-color)]">
            <SliderPrimitive.Range className="absolute h-full bg-primary" />
          </SliderPrimitive.Track>
          {values.map((_, i) => (
            <SliderPrimitive.Thumb
              key={i}
              aria-label={
                ariaLabel === undefined
                  ? undefined
                  : values.length === 1
                    ? ariaLabel
                    : `${ariaLabel} ${i === 0 ? "minimum" : "maximum"}`
              }
              className="gw-form-focus-visible block h-5 w-5 rounded-full border-2 [border-color:var(--gw-form-chrome-border-color)] bg-[color:var(--gw-form-foreground)] shadow-sm transition-[border-color,box-shadow,transform] group-hover:[border-color:var(--gw-form-border-hover-color)] group-hover:shadow-md focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            />
          ))}
        </SliderPrimitive.Root>

        {hasFooter ? (
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{minLabel}</span>
            <span>{maxLabel}</span>
          </div>
        ) : null}
      </div>
    );
  },
);
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
