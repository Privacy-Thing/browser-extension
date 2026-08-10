import { memo } from "react";
import type { CSSProperties } from "react";

import "./branding.css";

import type { BrandTone } from "./branding";
import { PrivacyThingBrandElement } from "./PrivacyThingBrandElement";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { cn } from "@/ui/components/lib/utils";

export const BrandIcon = memo(
  ({
    className,
    title = BRAND_DISPLAY_NAME,
    ariaLabel,
    tone = "foreground",
    color,
  }: {
    className?: string;
    title?: string;
    ariaLabel?: string;
    tone?: BrandTone;
    color?: string;
  }) => (
    <PrivacyThingBrandElement
      variant="icon"
      label={ariaLabel ?? title}
      decorative={false}
      color={color}
      animateCursor={false}
      animateIcon={false}
      pose="idle"
      lookAround={false}
      blink={false}
      trackPointer={false}
      hoverReaction="none"
      reduceMotion={false}
      className={cn("gw-brand-svg gw-brand-icon", className)}
      style={color ? ({ color } satisfies CSSProperties) : undefined}
      dataTone={tone}
    />
  ),
);
