import {
  PRIVACY_THING_LOGO_TAG,
  definePrivacyThingLogo,
  renderStaticLogo,
  type PrivacyThingLogoElement,
  type BrandThingLookAroundDirections,
  type BrandThingTiming,
  type PrivacyThingLogoOptions,
  type PrivacyThingLogoVariant,
} from "@privacy-thing/brand";
import {
  createElement,
  useCallback,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type Ref,
} from "react";

const fallbackVariant = (
  variant: PrivacyThingLogoVariant,
): Exclude<PrivacyThingLogoVariant, "thing"> =>
  variant === "thing" ? "icon" : variant;

export const PrivacyThingBrandElement = ({
  variant,
  label,
  decorative,
  color,
  animateCursor,
  animateIcon,
  pose,
  lookAround,
  lookAroundDirections,
  blink,
  trackPointer,
  hoverReaction,
  reduceMotion,
  timing,
  className,
  style,
  dataTone,
  forwardedRef,
}: Required<
  Pick<
    PrivacyThingLogoOptions,
    | "variant"
    | "label"
    | "decorative"
    | "animateCursor"
    | "animateIcon"
    | "pose"
    | "lookAround"
    | "blink"
    | "trackPointer"
    | "hoverReaction"
    | "reduceMotion"
  >
> & {
  color?: string | undefined;
  lookAroundDirections?: BrandThingLookAroundDirections | undefined;
  timing?: BrandThingTiming | undefined;
  className?: string;
  style?: CSSProperties | undefined;
  dataTone?: string;
  forwardedRef?: Ref<PrivacyThingLogoElement>;
}) => {
  const elementRef = useRef<PrivacyThingLogoElement | null>(null);
  const setElementRef = useCallback(
    (element: PrivacyThingLogoElement | null) => {
      elementRef.current = element;
      if (typeof forwardedRef === "function") forwardedRef(element);
      else if (forwardedRef) forwardedRef.current = element;
    },
    [forwardedRef],
  );

  useLayoutEffect(() => {
    definePrivacyThingLogo();
    const element = elementRef.current;
    if (!element) return;
    element.configure({
      variant,
      label,
      decorative,
      ...(color === undefined ? {} : { color }),
      animateCursor,
      animateIcon,
      pose,
      lookAround,
      ...(lookAroundDirections === undefined ? {} : { lookAroundDirections }),
      blink,
      trackPointer,
      hoverReaction,
      reduceMotion,
      ...(timing === undefined ? {} : { timing }),
    });
  }, [
    animateCursor,
    animateIcon,
    blink,
    color,
    decorative,
    hoverReaction,
    label,
    lookAround,
    lookAroundDirections,
    pose,
    reduceMotion,
    timing,
    trackPointer,
    variant,
  ]);

  return createElement(
    PRIVACY_THING_LOGO_TAG,
    {
      ref: setElementRef as Ref<HTMLElement>,
      className,
      style,
      role: decorative ? undefined : "img",
      "aria-label": decorative ? undefined : label,
      "aria-hidden": decorative ? "true" : undefined,
      "data-tone": dataTone,
      suppressHydrationWarning: true,
    },
    <span
      className="gw-brand-fallback"
      aria-hidden="true"
      dangerouslySetInnerHTML={{
        __html: renderStaticLogo(fallbackVariant(variant)),
      }}
    />,
  );
};
