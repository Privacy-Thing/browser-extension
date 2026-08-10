import type {
  BrandThingLookAroundDirections,
  BrandThingTiming,
} from "@/ui/branding/BrandThing";
import type { BrandThingHoverReaction } from "@/ui/branding/thing-hover-reaction";

export const OPTIONS_HOVER_REACTION = "boop" satisfies BrandThingHoverReaction;

export const OPTIONS_THING_TIMING = {
  lookAround: {
    cycleMs: 18_000,
    holdMs: 2_500,
  },
  pointer: {
    directionDelayMs: 2_700,
    idleHoldMs: 7_500,
    inactivityTimeoutMs: 15_000,
  },
} satisfies BrandThingTiming;

export const ONBOARDING_DIRECTIONS = [
  "south-west",
  "south-east",
] as const satisfies BrandThingLookAroundDirections;

export const ONBOARDING_THING_TIMING = {
  lookAround: {
    cycleMs: 10_000,
    holdMs: 2_000,
  },
  blink: {
    cycleMs: 5_000,
  },
} satisfies BrandThingTiming;
