import {
  BRAND_THING_DEFAULT_TIMING,
  BRAND_THING_MAX_CYCLE_MS,
  BRAND_THING_POSES,
  createBoopHeadPath,
  type BrandThingHoverReaction,
  type BrandThingLookAroundDirections,
  type BrandThingPose,
  type BrandThingTiming,
} from "@privacy-thing/brand";
import { memo, type CSSProperties } from "react";

import "./branding.css";

import type { BrandTone } from "./branding";
import { PrivacyThingBrandElement } from "./PrivacyThingBrandElement";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { cn } from "@/ui/components/lib/utils";

export {
  BRAND_THING_DEFAULT_TIMING,
  BRAND_THING_MAX_CYCLE_MS,
  BRAND_THING_POSES,
  createBoopHeadPath,
};
export type { BrandThingLookAroundDirections, BrandThingPose, BrandThingTiming };

export const BrandThing = memo(
  ({
    className,
    title = BRAND_DISPLAY_NAME,
    ariaLabel,
    tone = "foreground",
    color,
    pose = "idle",
    lookAround = false,
    lookAroundDirections,
    blink = false,
    trackPointer = false,
    hoverReaction = "none",
    reduceMotion = false,
    decorative = false,
    timing,
  }: {
    className?: string;
    title?: string;
    ariaLabel?: string;
    tone?: BrandTone;
    color?: string;
    pose?: BrandThingPose;
    lookAround?: boolean;
    lookAroundDirections?: BrandThingLookAroundDirections;
    blink?: boolean;
    reduceMotion?: boolean;
    decorative?: boolean;
    trackPointer?: boolean;
    hoverReaction?: BrandThingHoverReaction;
    timing?: BrandThingTiming;
  }) => (
    <PrivacyThingBrandElement
      variant="thing"
      label={ariaLabel ?? title}
      decorative={decorative}
      color={color}
      animateCursor={false}
      animateIcon
      pose={pose}
      lookAround={lookAround}
      lookAroundDirections={lookAroundDirections}
      blink={blink}
      trackPointer={trackPointer}
      hoverReaction={hoverReaction}
      reduceMotion={reduceMotion}
      timing={timing}
      className={cn("gw-brand-svg gw-brand-thing", className)}
      style={color ? ({ color } satisfies CSSProperties) : undefined}
      dataTone={tone}
    />
  ),
);
