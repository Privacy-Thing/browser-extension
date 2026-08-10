import type { CSSProperties, HTMLAttributes } from "react";

import { cn } from "../lib/utils";

export type AnimatedBarcodeBar = {
  x: number;
  width: number;
  shift: number;
  duration: number;
  delay: number;
  easing: string;
  direction: "alternate" | "alternate-reverse";
};

export type AnimatedBarcodeProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  bars?: readonly AnimatedBarcodeBar[];
  width?: number;
  height?: number;
  barColor?: string;
  backgroundColor?: string;
  borderColor?: string;
};

type BarcodeStyle = CSSProperties & {
  "--animated-barcode-width"?: string;
  "--animated-barcode-height"?: string;
  "--animated-barcode-bar-color"?: string;
  "--animated-barcode-background-color"?: string;
  "--animated-barcode-border-color"?: string;
};

type BarcodeBarStyle = CSSProperties & {
  "--animated-barcode-bar-x": string;
  "--animated-barcode-bar-width": string;
  "--animated-barcode-bar-shift": string;
  "--animated-barcode-bar-duration": string;
  "--animated-barcode-bar-delay": string;
  "--animated-barcode-bar-ease": string;
  "--animated-barcode-bar-direction": string;
};

export const DEFAULT_BARCODE_BARS = [
  {
    x: 3,
    width: 1,
    shift: 3,
    duration: 4.8,
    delay: -1.2,
    easing: "ease",
    direction: "alternate",
  },
  {
    x: 8,
    width: 3,
    shift: 5,
    duration: 6.4,
    delay: -5.1,
    easing: "ease-in-out",
    direction: "alternate-reverse",
  },
  {
    x: 14,
    width: 1,
    shift: 4,
    duration: 5.2,
    delay: -3.4,
    easing: "ease-in",
    direction: "alternate",
  },
  {
    x: 18,
    width: 5,
    shift: 6,
    duration: 8.2,
    delay: -6.7,
    easing: "cubic-bezier(.22,.61,.36,1)",
    direction: "alternate-reverse",
  },
  {
    x: 27,
    width: 2,
    shift: 5,
    duration: 5.8,
    delay: -1.9,
    easing: "ease-out",
    direction: "alternate",
  },
  {
    x: 32,
    width: 7,
    shift: 7,
    duration: 9.6,
    delay: -8.8,
    easing: "cubic-bezier(.4,0,.2,1)",
    direction: "alternate-reverse",
  },
  {
    x: 43,
    width: 1,
    shift: 6,
    duration: 4.4,
    delay: -3.1,
    easing: "linear",
    direction: "alternate",
  },
  {
    x: 47,
    width: 4,
    shift: 8,
    duration: 7.1,
    delay: -4.6,
    easing: "ease-in-out",
    direction: "alternate",
  },
  {
    x: 55,
    width: 2,
    shift: 6,
    duration: 6.1,
    delay: -5.7,
    easing: "cubic-bezier(.16,1,.3,1)",
    direction: "alternate-reverse",
  },
  {
    x: 60,
    width: 8,
    shift: 9,
    duration: 10.8,
    delay: -9.9,
    easing: "ease",
    direction: "alternate",
  },
  {
    x: 73,
    width: 1,
    shift: 5,
    duration: 4.9,
    delay: -2.3,
    easing: "ease-in",
    direction: "alternate-reverse",
  },
  {
    x: 77,
    width: 4,
    shift: 7,
    duration: 8.7,
    delay: -7.4,
    easing: "cubic-bezier(.65,0,.35,1)",
    direction: "alternate",
  },
  {
    x: 86,
    width: 2,
    shift: 5,
    duration: 6.8,
    delay: -4.2,
    easing: "ease-out",
    direction: "alternate-reverse",
  },
  {
    x: 92,
    width: 1,
    shift: 3,
    duration: 5.5,
    delay: -4.9,
    easing: "cubic-bezier(.3,0,.1,1)",
    direction: "alternate",
  },
  {
    x: 95,
    width: 2,
    shift: 2,
    duration: 7.2,
    delay: -6.4,
    easing: "ease-in-out",
    direction: "alternate-reverse",
  },
] as const satisfies readonly AnimatedBarcodeBar[];

const ANIMATED_BARCODE_STYLES = `
@keyframes pt-animated-barcode-slide {
  from { transform: translate3d(calc(var(--animated-barcode-bar-shift) * -1), 0, 0); }
  to { transform: translate3d(var(--animated-barcode-bar-shift), 0, 0); }
}

:root[data-reduce-motion] .gw-animated-barcode__bar {
  animation: none;
  transform: none;
}
`;

const toBarcodeStyle = ({
  width,
  height,
  barColor,
  backgroundColor,
  borderColor,
  style,
}: Pick<
  AnimatedBarcodeProps,
  "width" | "height" | "barColor" | "backgroundColor" | "borderColor"
> & {
  style: CSSProperties | undefined;
}): BarcodeStyle => {
  const barcodeStyle: BarcodeStyle = { ...style };

  if (width !== undefined) barcodeStyle["--animated-barcode-width"] = `${width}px`;
  if (height !== undefined) barcodeStyle["--animated-barcode-height"] = `${height}px`;
  if (barColor !== undefined) barcodeStyle["--animated-barcode-bar-color"] = barColor;
  if (backgroundColor !== undefined) {
    barcodeStyle["--animated-barcode-background-color"] = backgroundColor;
  }
  if (borderColor !== undefined)
    barcodeStyle["--animated-barcode-border-color"] = borderColor;

  return barcodeStyle;
};

const toBarStyle = (bar: AnimatedBarcodeBar): BarcodeBarStyle => ({
  "--animated-barcode-bar-x": `${bar.x}px`,
  "--animated-barcode-bar-width": `${bar.width}px`,
  "--animated-barcode-bar-shift": `${bar.shift}px`,
  "--animated-barcode-bar-duration": `${bar.duration}s`,
  "--animated-barcode-bar-delay": `${bar.delay}s`,
  "--animated-barcode-bar-ease": bar.easing,
  "--animated-barcode-bar-direction": bar.direction,
});

export function AnimatedBarcode({
  bars = DEFAULT_BARCODE_BARS,
  width = 100,
  height = 70,
  barColor = "#000000",
  backgroundColor = "#ffffff",
  borderColor = "#000000",
  className,
  style,
  "aria-label": ariaLabel = "Animated barcode",
  ...props
}: AnimatedBarcodeProps) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden border",
        "h-[var(--animated-barcode-height)] w-[var(--animated-barcode-width)]",
        "max-w-full bg-[var(--animated-barcode-background-color)]",
        "border-[var(--animated-barcode-border-color)]",
        className,
      )}
      style={toBarcodeStyle({
        width,
        height,
        barColor,
        backgroundColor,
        borderColor,
        style,
      })}
      aria-label={ariaLabel}
      role="img"
      {...props}
    >
      <style>{ANIMATED_BARCODE_STYLES}</style>
      {bars.map((bar) => (
        <span
          aria-hidden="true"
          className={cn(
            "gw-animated-barcode__bar absolute top-0 block h-full",
            "left-[var(--animated-barcode-bar-x)]",
            "w-[var(--animated-barcode-bar-width)]",
            "bg-[var(--animated-barcode-bar-color)] will-change-transform",
            "animate-[pt-animated-barcode-slide_var(--animated-barcode-bar-duration)_var(--animated-barcode-bar-ease)_var(--animated-barcode-bar-delay)_infinite]",
            "[animation-direction:var(--animated-barcode-bar-direction)]",
          )}
          key={`${bar.x}-${bar.width}-${bar.shift}-${bar.duration}-${bar.delay}`}
          style={toBarStyle(bar)}
        />
      ))}
    </div>
  );
}
