import {
  PRIVACY_THING_LOGO_TAG,
  dispatchPrivacyThingCommand,
  type PrivacyThingCommand,
  type PrivacyThingLogoElement,
} from "@privacy-thing/brand";
import type { Meta, StoryObj } from "@storybook/react";
import { useRef, useState } from "react";

import {
  BRAND_THING_DEFAULT_TIMING,
  BRAND_THING_MAX_CYCLE_MS,
  BRAND_THING_POSES,
  BrandThing,
  type BrandThingPose,
} from "@/ui/branding/BrandThing";
import {
  BRAND_THING_HOVER_REACTIONS,
  type BrandThingHoverReaction,
} from "@/ui/branding/thing-hover-reaction";
import { cn } from "@/ui/components/lib/utils";
import { Checkbox } from "@/ui/components/ui/checkbox";
import { Slider } from "@/ui/components/ui/slider";

const meta = {
  title: "Brand/Thing",
  component: BrandThing,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="rounded-[2rem] bg-background p-8">
        <Story />
      </div>
    ),
  ],
  args: {
    className: "w-40",
    pose: "idle",
    lookAround: false,
    blink: false,
  },
  argTypes: {
    pose: {
      control: "select",
      options: BRAND_THING_POSES,
    },
    hoverReaction: {
      control: "select",
      options: BRAND_THING_HOVER_REACTIONS,
    },
  },
} satisfies Meta<typeof BrandThing>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Static: Story = {};

export const LookAround: Story = {
  args: { lookAround: true },
};

export const Blink: Story = {
  args: { blink: true },
};

export const Combined: Story = {
  args: { lookAround: true, blink: true },
};

export const PointerTracking: Story = {
  args: { trackPointer: true, lookAround: true, blink: true },
};

export const BoopOnHover: Story = {
  args: { hoverReaction: "boop", lookAround: true, blink: true },
};

const poseAtlas: ReadonlyArray<{
  pose: BrandThingPose;
  label: string;
  symbol: string;
}> = [
  { pose: "north-west", label: "North-west", symbol: "↖" },
  { pose: "north", label: "North", symbol: "↑" },
  { pose: "north-east", label: "North-east", symbol: "↗" },
  { pose: "west", label: "West", symbol: "←" },
  { pose: "zz", label: "Zz", symbol: "Zz" },
  { pose: "east", label: "East", symbol: "→" },
  { pose: "south-west", label: "South-west", symbol: "↙" },
  { pose: "south", label: "South", symbol: "↓" },
  { pose: "south-east", label: "South-east", symbol: "↘" },
];

export const PoseAtlas: Story = {
  render: () => (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-3 gap-4">
      {poseAtlas.map(({ pose, label, symbol }) => (
        <figure
          key={pose}
          className="grid min-h-48 place-items-center gap-3 rounded-2xl border border-border bg-card p-5 text-card-foreground"
        >
          <BrandThing className="w-28" pose={pose} />
          <figcaption className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
            {symbol} {label}
          </figcaption>
        </figure>
      ))}
    </div>
  ),
};

const EventCommandDemo = () => {
  const stageRef = useRef<HTMLDivElement>(null);
  const [lastCommand, setLastCommand] = useState("reset");
  const sendCommand = (command: PrivacyThingCommand) => {
    const thing =
      stageRef.current?.querySelector<PrivacyThingLogoElement>(PRIVACY_THING_LOGO_TAG);
    if (!thing) return;
    dispatchPrivacyThingCommand(thing, command);
    setLastCommand(command.type === "look" ? command.direction : command.type);
  };

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 rounded-2xl border border-border bg-card p-6 text-card-foreground">
      <div
        ref={stageRef}
        className="grid min-h-80 place-items-center rounded-xl bg-background p-8"
      >
        <BrandThing className="w-56 max-w-full" pose="idle" lookAround blink />
      </div>
      <div className="grid gap-3">
        <div
          className="grid grid-cols-3 gap-2"
          role="group"
          aria-label="Thing event commands"
        >
          {poseAtlas
            .filter(({ pose }) => pose !== "zz")
            .map(({ pose, label, symbol }) => (
              <button
                key={pose}
                type="button"
                className="gw-form-focus-visible grid h-10 place-items-center rounded-md border border-input bg-background font-mono text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-none"
                onClick={() => {
                  if (pose !== "zz") sendCommand({ type: "look", direction: pose });
                }}
                title={`Send look: ${label}`}
              >
                {symbol}
              </button>
            ))}
        </div>
        <button
          type="button"
          className="gw-form-focus-visible h-10 rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none"
          onClick={() => {
            sendCommand({ type: "reset" });
          }}
        >
          Reset to declared pose
        </button>
        <p className="text-center font-mono text-xs text-muted-foreground">
          privacy-thing:command · {lastCommand}
        </p>
      </div>
    </div>
  );
};

export const EventCommands: Story = {
  render: () => <EventCommandDemo />,
};

const readSliderValue = (next: number[], current: number) => next[0] ?? current;

const AnimationControlPanel = () => {
  const [pose, setPose] = useState<BrandThingPose>("idle");
  const [lookAroundEnabled, setLookAroundEnabled] = useState(true);
  const [blinkEnabled, setBlinkEnabled] = useState(true);
  const [trackPointerEnabled, setTrackPointerEnabled] = useState(false);
  const [hoverReaction, setHoverReaction] = useState<BrandThingHoverReaction>("boop");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [lookCycleMs, setLookCycleMs] = useState<number>(
    BRAND_THING_DEFAULT_TIMING.lookAround.cycleMs,
  );
  const [lookHoldMs, setLookHoldMs] = useState<number>(
    BRAND_THING_DEFAULT_TIMING.lookAround.holdMs,
  );
  const [blinkCycleMs, setBlinkCycleMs] = useState<number>(
    BRAND_THING_DEFAULT_TIMING.blink.cycleMs,
  );
  const [blinkDurationMs, setBlinkDurationMs] = useState<number>(
    BRAND_THING_DEFAULT_TIMING.blink.durationMs,
  );
  const [eyeStaggerMs, setEyeStaggerMs] = useState<number>(
    BRAND_THING_DEFAULT_TIMING.blink.eyeStaggerMs,
  );
  const [directionDelayMs, setDirectionDelayMs] = useState<number>(
    BRAND_THING_DEFAULT_TIMING.pointer.directionDelayMs,
  );
  const [idleHoldMs, setIdleHoldMs] = useState<number>(
    BRAND_THING_DEFAULT_TIMING.pointer.idleHoldMs,
  );
  const [pointerInactivityMs, setPointerInactivityMs] = useState<number>(
    BRAND_THING_DEFAULT_TIMING.pointer.inactivityTimeoutMs,
  );
  const [poseTransitionMs, setPoseTransitionMs] = useState<number>(
    BRAND_THING_DEFAULT_TIMING.pointer.transitionMs,
  );
  const maximumLookHoldMs = Math.round(lookCycleMs * 0.23);
  const effectiveLookHoldMs = Math.min(lookHoldMs, maximumLookHoldMs);
  const minimumBlinkDurationMs = 120;
  const maximumBlinkDurationMs = Math.min(600, Math.round(blinkCycleMs * 0.12));
  const effectiveBlinkDurationMs = Math.min(
    Math.max(blinkDurationMs, minimumBlinkDurationMs),
    maximumBlinkDurationMs,
  );
  const maximumEyeStaggerMs = Math.min(160, effectiveBlinkDurationMs);
  const effectiveEyeStaggerMs = Math.min(eyeStaggerMs, maximumEyeStaggerMs);
  const timing = {
    lookAround: {
      cycleMs: lookCycleMs,
      holdMs: effectiveLookHoldMs,
    },
    blink: {
      cycleMs: blinkCycleMs,
      durationMs: effectiveBlinkDurationMs,
      eyeStaggerMs: effectiveEyeStaggerMs,
    },
    pointer: {
      directionDelayMs,
      idleHoldMs,
      inactivityTimeoutMs: pointerInactivityMs,
      transitionMs: poseTransitionMs,
    },
  };
  const timingKey = [
    lookAroundEnabled,
    blinkEnabled,
    reduceMotion,
    trackPointerEnabled,
    hoverReaction,
    lookCycleMs,
    effectiveLookHoldMs,
    blinkCycleMs,
    effectiveBlinkDurationMs,
    effectiveEyeStaggerMs,
    directionDelayMs,
    idleHoldMs,
    pointerInactivityMs,
    poseTransitionMs,
  ].join("-");
  const zz = pose === "zz";
  const poseLabel = trackPointerEnabled
    ? "Pointer tracking"
    : (poseAtlas.find((item) => item.pose === pose)?.label ?? "Neutral");
  const motionLabels: string[] = [];
  if (lookAroundEnabled) motionLabels.push("look around");
  if (blinkEnabled) motionLabels.push("blink");
  if (trackPointerEnabled) motionLabels.push("pointer tracking");
  let motionSummary = motionLabels.join(" + ") || "still";
  if (zz) motionSummary = "Zz scene";
  if (reduceMotion) motionSummary = "motion paused";

  return (
    <main className="mx-auto grid w-full max-w-6xl items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)]">
      <section className="grid min-h-[36rem] place-items-center rounded-2xl border border-border bg-card p-8 text-card-foreground shadow-sm lg:sticky lg:top-8 lg:h-[calc(100dvh-4rem)] lg:min-h-0">
        <figure className="grid justify-items-center gap-8">
          <BrandThing
            key={timingKey}
            className="w-64 max-w-full"
            pose={pose}
            lookAround={lookAroundEnabled}
            blink={blinkEnabled}
            trackPointer={trackPointerEnabled}
            hoverReaction={hoverReaction}
            reduceMotion={reduceMotion}
            timing={timing}
          />
          <figcaption className="text-center text-sm text-muted-foreground">
            <strong className="font-medium text-foreground">{poseLabel}</strong>
            <span aria-hidden="true"> · </span>
            {motionSummary}
          </figcaption>
        </figure>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
        <header className="border-b border-border px-6 py-5">
          <h2 className="text-lg font-semibold tracking-tight">Thing controls</h2>
        </header>

        <div className="grid gap-8 p-6">
          <fieldset className="grid gap-4">
            <legend className="mb-3 text-sm font-semibold">Pose</legend>
            <div
              className="mx-auto grid grid-cols-3 gap-2"
              role="group"
              aria-label="Gaze direction and Zz pose"
            >
              {poseAtlas.map(({ pose: nextPose, label, symbol }) => (
                <button
                  key={nextPose}
                  type="button"
                  className={cn(
                    "gw-form-focus-visible grid size-12 place-items-center rounded-md border border-input bg-background font-mono text-base text-foreground transition-colors hover:bg-accent focus-visible:outline-none",
                    pose === nextPose &&
                      "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                  aria-label={label}
                  aria-pressed={pose === nextPose}
                  title={label}
                  onClick={() => {
                    setPose(nextPose);
                  }}
                >
                  {symbol}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={cn(
                "gw-form-focus-visible h-9 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none",
                pose === "idle" &&
                  "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
              )}
              aria-pressed={pose === "idle"}
              onClick={() => {
                setPose("idle");
              }}
            >
              Neutral
            </button>
          </fieldset>

          <fieldset className="grid gap-3 border-t border-border pt-6">
            <legend className="mb-1 text-sm font-semibold">Motion</legend>
            <label className="flex min-h-12 items-center justify-between gap-4 rounded-md border border-border px-4 py-3">
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">Look around</span>
                <span className="text-xs text-muted-foreground">
                  Head and eye movement
                </span>
              </span>
              <Checkbox
                aria-label="Look around"
                checked={lookAroundEnabled}
                disabled={zz}
                onChange={(event) => {
                  setLookAroundEnabled(event.currentTarget.checked);
                }}
              />
            </label>
            <div className="grid gap-2 rounded-md border border-border px-4 py-3">
              <span className="text-sm font-medium">Hover reaction</span>
              <div
                className="grid grid-cols-2 gap-2"
                role="group"
                aria-label="Hover reaction"
              >
                {BRAND_THING_HOVER_REACTIONS.map((reaction) => (
                  <button
                    key={reaction}
                    type="button"
                    className={cn(
                      "gw-form-focus-visible h-8 rounded-md border border-input bg-background px-2 text-xs font-medium capitalize text-foreground transition-colors hover:bg-accent focus-visible:outline-none",
                      hoverReaction === reaction &&
                        "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                    )}
                    aria-pressed={hoverReaction === reaction}
                    disabled={zz || reduceMotion}
                    onClick={() => {
                      setHoverReaction(reaction);
                    }}
                  >
                    {reaction}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                Boops once, then follows the pointer directly until it leaves Thing.
              </span>
            </div>
            <label className="flex min-h-12 items-center justify-between gap-4 rounded-md border border-border px-4 py-3">
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">Track pointer</span>
                <span className="text-xs text-muted-foreground">
                  Follow stable cursor directions
                </span>
              </span>
              <Checkbox
                aria-label="Track pointer"
                checked={trackPointerEnabled}
                disabled={zz || reduceMotion}
                onChange={(event) => {
                  setTrackPointerEnabled(event.currentTarget.checked);
                }}
              />
            </label>
            <label className="flex min-h-12 items-center justify-between gap-4 rounded-md border border-border px-4 py-3">
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">Blink</span>
                <span className="text-xs text-muted-foreground">
                  Natural eye closure
                </span>
              </span>
              <Checkbox
                aria-label="Blink"
                checked={blinkEnabled}
                disabled={zz}
                onChange={(event) => {
                  setBlinkEnabled(event.currentTarget.checked);
                }}
              />
            </label>
            <label className="flex min-h-12 items-center justify-between gap-4 rounded-md border border-border px-4 py-3">
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">Reduce motion</span>
                <span className="text-xs text-muted-foreground">
                  Keep the selected pose still
                </span>
              </span>
              <Checkbox
                aria-label="Reduce motion"
                checked={reduceMotion}
                onChange={(event) => {
                  setReduceMotion(event.currentTarget.checked);
                }}
              />
            </label>
          </fieldset>

          <fieldset className="grid gap-7 border-t border-border pt-6">
            <legend className="mb-1 text-sm font-semibold">
              Pointer tracking timing
            </legend>
            <Slider
              aria-label="Direction delay"
              label="Direction delay"
              valueLabel={`${directionDelayMs} ms`}
              minLabel="50 ms"
              maxLabel="10 s"
              value={[directionDelayMs]}
              min={50}
              max={10_000}
              step={50}
              disabled={!trackPointerEnabled || zz || reduceMotion}
              onValueChange={(next) => {
                setDirectionDelayMs((current) => readSliderValue(next, current));
              }}
            />
            <Slider
              aria-label="Neutral hold"
              label="Neutral hold"
              valueLabel={`${idleHoldMs} ms`}
              minLabel="50 ms"
              maxLabel="10 s"
              value={[idleHoldMs]}
              min={50}
              max={10_000}
              step={50}
              disabled={!trackPointerEnabled || zz || reduceMotion}
              onValueChange={(next) => {
                setIdleHoldMs((current) => readSliderValue(next, current));
              }}
            />
            <Slider
              aria-label="Return to Neutral"
              label="Return to Neutral"
              valueLabel={`${(pointerInactivityMs / 1_000).toFixed(1)} s`}
              minLabel="1 s"
              maxLabel="60 s"
              value={[pointerInactivityMs]}
              min={1_000}
              max={60_000}
              step={500}
              disabled={!trackPointerEnabled || zz || reduceMotion}
              onValueChange={(next) => {
                setPointerInactivityMs((current) => readSliderValue(next, current));
              }}
            />
            <Slider
              aria-label="Pose transition"
              label="Pose transition"
              valueLabel={`${poseTransitionMs} ms`}
              minLabel="80 ms"
              maxLabel="10 s"
              value={[poseTransitionMs]}
              min={80}
              max={10_000}
              step={20}
              disabled={zz || reduceMotion}
              onValueChange={(next) => {
                setPoseTransitionMs((current) => readSliderValue(next, current));
              }}
            />
            <p className="-mt-2 text-xs leading-relaxed text-muted-foreground">
              A direction must settle first. Changes always pause in Neutral before the
              next gaze. An idle pointer eventually returns Thing to Neutral.
            </p>
          </fieldset>

          <fieldset className="grid gap-7 border-t border-border pt-6">
            <legend className="mb-1 text-sm font-semibold">Look-around timing</legend>
            <Slider
              aria-label="Look-around cycle"
              label="Full loop"
              valueLabel={`${(lookCycleMs / 1_000).toFixed(1)} s`}
              minLabel="3 s"
              maxLabel={`${BRAND_THING_MAX_CYCLE_MS / 1_000} s`}
              value={[lookCycleMs]}
              min={3_000}
              max={BRAND_THING_MAX_CYCLE_MS}
              step={100}
              disabled={!lookAroundEnabled || zz || reduceMotion}
              onValueChange={(next) => {
                setLookCycleMs((current) => readSliderValue(next, current));
              }}
            />
            <p className="-mt-2 text-xs leading-relaxed text-muted-foreground">
              One left and one right glance per loop. Longer loops add idle time;
              movement speed stays fixed.
            </p>
            <Slider
              aria-label="Look-around hold"
              label="Hold"
              valueLabel={`${effectiveLookHoldMs} ms`}
              minLabel="0 ms"
              maxLabel={`${maximumLookHoldMs} ms`}
              value={[effectiveLookHoldMs]}
              min={0}
              max={maximumLookHoldMs}
              step={25}
              disabled={!lookAroundEnabled || zz || reduceMotion}
              onValueChange={(next) => {
                setLookHoldMs((current) => readSliderValue(next, current));
              }}
            />
          </fieldset>

          <fieldset className="grid gap-7 border-t border-border pt-6">
            <legend className="mb-1 text-sm font-semibold">Blink timing</legend>
            <Slider
              aria-label="Blink cycle"
              label="Interval"
              valueLabel={`${(blinkCycleMs / 1_000).toFixed(1)} s`}
              minLabel="2 s"
              maxLabel={`${BRAND_THING_MAX_CYCLE_MS / 1_000} s`}
              value={[blinkCycleMs]}
              min={2_000}
              max={BRAND_THING_MAX_CYCLE_MS}
              step={100}
              disabled={!blinkEnabled || zz || reduceMotion}
              onValueChange={(next) => {
                setBlinkCycleMs((current) => readSliderValue(next, current));
              }}
            />
            <Slider
              aria-label="Blink duration"
              label="Duration"
              valueLabel={`${effectiveBlinkDurationMs} ms`}
              minLabel={`${minimumBlinkDurationMs} ms`}
              maxLabel={`${maximumBlinkDurationMs} ms`}
              value={[effectiveBlinkDurationMs]}
              min={minimumBlinkDurationMs}
              max={maximumBlinkDurationMs}
              step={10}
              disabled={!blinkEnabled || zz || reduceMotion}
              onValueChange={(next) => {
                setBlinkDurationMs((current) => readSliderValue(next, current));
              }}
            />
            <Slider
              aria-label="Delay between eyes"
              label="Eye stagger"
              valueLabel={`${effectiveEyeStaggerMs} ms`}
              minLabel="0 ms"
              maxLabel={`${maximumEyeStaggerMs} ms`}
              value={[effectiveEyeStaggerMs]}
              min={0}
              max={maximumEyeStaggerMs}
              step={5}
              disabled={!blinkEnabled || zz || reduceMotion}
              onValueChange={(next) => {
                setEyeStaggerMs((current) => readSliderValue(next, current));
              }}
            />
            <p className="-mt-2 text-xs leading-relaxed text-muted-foreground">
              One complete close–open event per interval.
            </p>
          </fieldset>
        </div>
      </section>
    </main>
  );
};

export const CompositionMatrix: Story = {
  render: () => <AnimationControlPanel />,
};
