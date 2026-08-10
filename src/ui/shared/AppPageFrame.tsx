import type { ReactNode } from "react";
import type { MouseEventHandler } from "react";

import { BrandLogo } from "@/ui/branding/BrandLogo";
import type { BrandThingPose, BrandThingTiming } from "@/ui/branding/BrandThing";
import type { BrandThingHoverReaction } from "@/ui/branding/thing-hover-reaction";
import { cn } from "@/ui/components/lib/utils";
import { MadeWithLoveBadge } from "@/ui/shared/MadeWithLoveBadge";

type AppPageFrameHeaderProps = {
  title: ReactNode;
  lead?: ReactNode;
  headerAside?: ReactNode;
  headerClassName: string;
  headerAsideClassName: string;
  brandHref?: string | undefined;
  onBrandNavigate?: MouseEventHandler<HTMLAnchorElement> | undefined;
  animateBrandIcon: boolean;
  brandThingPose: BrandThingPose;
  brandThingTiming?: BrandThingTiming | undefined;
  brandThingHoverReaction: BrandThingHoverReaction;
  trackBrandThingPointer: boolean;
  reduceBrandMotion: boolean;
  hideTitle: boolean;
};

const BrandLogoLink = ({
  brandHref,
  onBrandNavigate,
  animateBrandIcon,
  brandThingPose,
  brandThingTiming,
  brandThingHoverReaction,
  trackBrandThingPointer,
  reduceBrandMotion,
}: Pick<
  AppPageFrameHeaderProps,
  | "brandHref"
  | "onBrandNavigate"
  | "animateBrandIcon"
  | "brandThingPose"
  | "brandThingTiming"
  | "brandThingHoverReaction"
  | "trackBrandThingPointer"
  | "reduceBrandMotion"
>) => {
  const brandProps: {
    href?: string;
    onClick?: MouseEventHandler<HTMLAnchorElement>;
    thingTiming?: BrandThingTiming;
  } = {};
  if (brandHref) {
    brandProps.href = brandHref;
  }
  if (onBrandNavigate) {
    brandProps.onClick = onBrandNavigate;
  }
  if (brandThingTiming) {
    brandProps.thingTiming = brandThingTiming;
  }

  return (
    <BrandLogo
      className="gw-brand-logo--accent-cursor w-[210px] max-w-full shrink-0"
      tone="foreground"
      animateCursor
      animateIcon={animateBrandIcon}
      thingPose={brandThingPose}
      thingHoverReaction={brandThingHoverReaction}
      trackThingPointer={trackBrandThingPointer}
      reduceMotion={reduceBrandMotion}
      {...brandProps}
    />
  );
};

const AppPageFrameHeader = ({
  title,
  lead,
  headerAside,
  headerClassName,
  headerAsideClassName,
  brandHref,
  onBrandNavigate,
  animateBrandIcon,
  brandThingPose,
  brandThingTiming,
  brandThingHoverReaction,
  trackBrandThingPointer,
  reduceBrandMotion,
  hideTitle,
}: AppPageFrameHeaderProps) => {
  const titleNode = hideTitle ? (
    <h1 id="page-title" className="sr-only">
      {title}
    </h1>
  ) : (
    <h1
      id="page-title"
      className="text-xl font-semibold leading-tight tracking-tight text-foreground"
    >
      {title}
    </h1>
  );
  const showTitleBlock = !hideTitle || lead;

  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-4 pb-5 mb-5 border-b border-border/60",
        headerClassName,
      )}
    >
      <div className="flex min-w-0 items-start gap-5">
        <BrandLogoLink
          brandHref={brandHref}
          onBrandNavigate={onBrandNavigate}
          animateBrandIcon={animateBrandIcon}
          brandThingPose={brandThingPose}
          brandThingTiming={brandThingTiming}
          brandThingHoverReaction={brandThingHoverReaction}
          trackBrandThingPointer={trackBrandThingPointer}
          reduceBrandMotion={reduceBrandMotion}
        />
        {hideTitle && !lead ? titleNode : null}
        {showTitleBlock ? (
          <div className="min-w-0 pt-1">
            {titleNode}
            {lead ? (
              <p
                id="page-lede"
                className="mt-0.5 max-w-[72ch] text-xs text-muted-foreground leading-relaxed"
              >
                {lead}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {headerAside && (
        <div className={cn("min-w-0 pt-1", headerAsideClassName)}>{headerAside}</div>
      )}
    </header>
  );
};

export const AppPageFrame = ({
  title,
  lead,
  headerAside,
  children,
  pageClassName = "",
  headerClassName = "",
  headerAsideClassName = "",
  brandHref,
  onBrandNavigate,
  animateBrandIcon = false,
  brandThingPose = "idle",
  brandThingTiming,
  brandThingHoverReaction = "none",
  trackBrandThingPointer = false,
  reduceBrandMotion = false,
  hideTitle = false,
  hideHeader = false,
}: {
  title: ReactNode;
  lead?: ReactNode;
  headerAside?: ReactNode;
  children: ReactNode;
  pageClassName?: string;
  headerClassName?: string;
  headerAsideClassName?: string;
  brandHref?: string;
  onBrandNavigate?: MouseEventHandler<HTMLAnchorElement>;
  animateBrandIcon?: boolean;
  brandThingPose?: BrandThingPose;
  brandThingTiming?: BrandThingTiming;
  brandThingHoverReaction?: BrandThingHoverReaction;
  trackBrandThingPointer?: boolean;
  reduceBrandMotion?: boolean;
  hideTitle?: boolean;
  hideHeader?: boolean;
}) => (
  <div className="relative min-h-screen flex flex-col bg-background text-foreground">
    <div
      className={cn(
        "relative z-10 flex-1 flex flex-col w-full max-w-[1360px] mx-auto px-6 pt-6 pb-12",
        pageClassName,
      )}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      {hideHeader ? (
        <h1 id="page-title" className="sr-only">
          {title}
        </h1>
      ) : (
        <AppPageFrameHeader
          title={title}
          lead={lead}
          headerAside={headerAside}
          headerClassName={headerClassName}
          headerAsideClassName={headerAsideClassName}
          brandHref={brandHref}
          onBrandNavigate={onBrandNavigate}
          animateBrandIcon={animateBrandIcon}
          brandThingPose={brandThingPose}
          brandThingTiming={brandThingTiming}
          brandThingHoverReaction={brandThingHoverReaction}
          trackBrandThingPointer={trackBrandThingPointer}
          reduceBrandMotion={reduceBrandMotion}
          hideTitle={hideTitle}
        />
      )}

      <main
        className="flex-1"
        aria-labelledby="page-title"
        {...(lead ? { "aria-describedby": "page-lede" } : {})}
      >
        {children}
      </main>
    </div>

    <footer className="relative z-10 shrink-0 flex justify-center px-6 pb-5 pointer-events-none opacity-70">
      <MadeWithLoveBadge />
    </footer>
  </div>
);
