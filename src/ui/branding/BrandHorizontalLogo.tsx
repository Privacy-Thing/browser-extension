import type { PrivacyThingLogoElement } from "@privacy-thing/brand";
import { memo } from "react";
import type { CSSProperties, MouseEventHandler, Ref } from "react";

import "./branding.css";

import type { BrandTone } from "./branding";
import {
  type BrandThingLookAroundDirections,
  type BrandThingPose,
  type BrandThingTiming,
} from "./BrandThing";
import { PrivacyThingBrandElement } from "./PrivacyThingBrandElement";
import type { BrandThingHoverReaction } from "./thing-hover-reaction";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { cn } from "@/ui/components/lib/utils";

export const BrandHorizontalLogo = memo(
  ({
    className,
    width,
    height,
    title = BRAND_DISPLAY_NAME,
    ariaLabel,
    tone = "foreground",
    color,
    animateCursor = false,
    animateIcon = false,
    thingPose = "idle",
    lookDirections,
    thingTiming,
    thingHoverReaction = "none",
    trackThingPointer = false,
    reduceMotion = false,
    href,
    onClick,
    elementRef,
  }: {
    className?: string;
    width?: number;
    height?: number;
    title?: string;
    ariaLabel?: string;
    tone?: BrandTone;
    color?: string;
    animateCursor?: boolean;
    animateIcon?: boolean;
    thingPose?: BrandThingPose;
    lookDirections?: BrandThingLookAroundDirections;
    thingTiming?: BrandThingTiming;
    thingHoverReaction?: BrandThingHoverReaction;
    trackThingPointer?: boolean;
    reduceMotion?: boolean;
    href?: string;
    onClick?: MouseEventHandler<HTMLAnchorElement>;
    elementRef?: Ref<PrivacyThingLogoElement>;
  }) => {
    const cursorAnimationEnabled =
      animateCursor && (!animateIcon || thingPose !== "zz");
    const rootClassName = cn(
      "gw-brand-svg gw-brand-logo-horizontal",
      cursorAnimationEnabled && "gw-brand-logo--cursor-blink",
      animateIcon &&
        "gw-brand-logo--animated-thing gw-brand-logo-horizontal--animated-thing",
      className,
    );
    const accessibleLabel = ariaLabel ?? title;
    const style: CSSProperties = {
      ...(color ? { color } : {}),
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
    };
    const logo = (
      <PrivacyThingBrandElement
        variant="horizontal"
        label={accessibleLabel}
        decorative={Boolean(href)}
        color={color}
        animateCursor={animateCursor}
        animateIcon={animateIcon}
        pose={thingPose}
        lookAround={false}
        lookAroundDirections={lookDirections}
        blink={false}
        trackPointer={trackThingPointer}
        hoverReaction={thingHoverReaction}
        reduceMotion={reduceMotion}
        timing={thingTiming}
        className={rootClassName}
        style={style}
        dataTone={tone}
        {...(elementRef ? { forwardedRef: elementRef } : {})}
      />
    );

    return href ? (
      <a
        href={href}
        className="inline-block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={accessibleLabel}
        onClick={onClick}
      >
        {logo}
      </a>
    ) : (
      logo
    );
  },
);
