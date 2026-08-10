import { memo } from "react";
import type { CSSProperties, MouseEventHandler } from "react";

import "./branding.css";

import type { BrandTone } from "./branding";
import { PrivacyThingBrandElement } from "./PrivacyThingBrandElement";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { cn } from "@/ui/components/lib/utils";

export const BrandWordmark = memo(
  ({
    className,
    width,
    height,
    title = BRAND_DISPLAY_NAME,
    ariaLabel,
    tone = "foreground",
    color,
    href,
    onClick,
  }: {
    className?: string;
    width?: number;
    height?: number;
    title?: string;
    ariaLabel?: string;
    tone?: BrandTone;
    color?: string;
    href?: string;
    onClick?: MouseEventHandler<HTMLAnchorElement>;
  }) => {
    const accessibleLabel = ariaLabel ?? title;
    const style: CSSProperties = {
      ...(color ? { color } : {}),
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
    };
    const wordmark = (
      <PrivacyThingBrandElement
        variant="wordmark"
        label={accessibleLabel}
        decorative={Boolean(href)}
        color={color}
        animateCursor={false}
        animateIcon={false}
        pose="idle"
        lookAround={false}
        blink={false}
        trackPointer={false}
        hoverReaction="none"
        reduceMotion={false}
        className={cn("gw-brand-svg gw-brand-wordmark", className)}
        style={style}
        dataTone={tone}
      />
    );

    return href ? (
      <a
        href={href}
        className="inline-block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={accessibleLabel}
        onClick={onClick}
      >
        {wordmark}
      </a>
    ) : (
      wordmark
    );
  },
);
