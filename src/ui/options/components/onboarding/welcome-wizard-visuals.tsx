import { useEffect, useMemo, useRef, useState } from "react";

import privacyPolicyMarkdown from "../../../../../PRIVACY.md?raw";

import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog";
import { t } from "@/ui/i18n";
import { SetupProgress } from "@/ui/options/components/onboarding/setup-progress";
import type { WizardStep } from "@/ui/options/components/onboarding/WelcomeWizard";
import {
  NUMERIC_ROLLING_ALPHABET,
  RollingCharacter,
} from "@/ui/options/components/rolling-value";
import {
  applyPrivacyPolicySemantics,
  renderPrivacyPolicyMarkdown,
} from "@/ui/options/components/subpages/privacy-policy-render";

type VersionDigits = { build: string; patch: string };
const HINT_REPLAY_INTERVAL_MS = 3_000;
const PARENT_PROGRESS: Record<WizardStep, number | null> = {
  welcome: null,
  privacy: 1,
  presets: 1,
  scope: 2,
  browser: 2,
  appearance: 3,
  done: 4,
};

export const WizardProgress = ({ step }: { step: WizardStep }) => {
  const active = PARENT_PROGRESS[step];
  if (!active) return null;
  return <SetupProgress active={active} label={t.welcome.progressLabel} />;
};

const OdometerDigit = ({
  animationCycle,
  animationDelayMs,
  fromDigit,
  toDigit,
}: {
  animationCycle: number;
  animationDelayMs: number;
  fromDigit: string;
  toDigit: string;
}) => (
  <RollingCharacter
    fromCharacter={fromDigit}
    toCharacter={toDigit}
    animationCycle={animationCycle}
    animationDelayMs={animationDelayMs}
    alphabet={NUMERIC_ROLLING_ALPHABET}
    fullCycleOnMatch
  />
);

const buildVisualVersion = (
  turn: number,
  previousVersion: VersionDigits,
): VersionDigits => ({
  build: String((Number(previousVersion.build) + 13 + turn * 7) % 9000).padStart(
    4,
    "0",
  ),
  patch: String((Number(previousVersion.patch) + 5 + turn * 3) % 200).padStart(3, "0"),
});

export const ChromiumPreview = ({
  catalogVersionDigits,
  enabled,
}: {
  catalogVersionDigits: readonly VersionDigits[];
  enabled: boolean;
}) => {
  const actualDigits = useMemo<VersionDigits>(
    () => ({ build: "7042", patch: "107" }),
    [],
  );
  const [animationCycle, setAnimationCycle] = useState(0);
  const [versionRange, setVersionRange] = useState<{
    from: VersionDigits;
    to: VersionDigits;
  }>({ from: actualDigits, to: actualDigits });
  useEffect(() => {
    if (!enabled) {
      setVersionRange({ from: actualDigits, to: actualDigits });
      setAnimationCycle(0);
      return;
    }
    let turn = 0;
    const advanceVersion = () => {
      turn += 1;
      setVersionRange((current) => {
        const from = turn === 1 ? actualDigits : current.to;
        const to =
          catalogVersionDigits.length > 0
            ? (catalogVersionDigits[
                // eslint-disable-next-line sonarjs/pseudo-random -- decorative version odometer, not a security context
                Math.floor(Math.random() * catalogVersionDigits.length)
              ] ?? current.to)
            : buildVisualVersion(turn, current.to);
        return { from, to };
      });
      setAnimationCycle((current) => current + 1);
    };
    advanceVersion();
    const intervalId = window.setInterval(advanceVersion, HINT_REPLAY_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [actualDigits, catalogVersionDigits, enabled]);

  const renderDigits = (kind: keyof VersionDigits) =>
    Array.from(versionRange.to[kind]).map((digit, index, digits) => (
      <OdometerDigit
        key={`${kind}-${digits.length - index}`}
        fromDigit={versionRange.from[kind][index] ?? digit}
        toDigit={digit}
        animationCycle={animationCycle}
        animationDelayMs={(digits.length - index - 1) * 75}
      />
    ));
  return (
    <div className="font-mono text-[2.5rem] font-semibold leading-none">
      <span className="text-foreground">149.0.</span>
      <span className="sr-only">{`149.0.${versionRange.to.build}.${versionRange.to.patch}`}</span>
      <span aria-hidden="true" className="gw-rolling-value text-primary">
        {renderDigits("build")}
        <span className="gw-rolling-value-separator">.</span>
        {renderDigits("patch")}
      </span>
    </div>
  );
};

export const PrivacyPolicyDialog = ({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const rootRef = useRef<HTMLElement | null>(null);
  const renderedMarkup = useMemo(
    () => renderPrivacyPolicyMarkdown(privacyPolicyMarkdown),
    [],
  );
  useEffect(() => {
    if (open && rootRef.current) applyPrivacyPolicySemantics(rootRef.current);
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid-rows-[auto_minmax(0,1fr)] max-h-[85vh] max-w-3xl">
        <DialogCloseButton label={t.welcome.privacyDialog.close} />
        <DialogHeader>
          <DialogTitle className="pr-8">{t.welcome.privacyDialog.title}</DialogTitle>
          <DialogDescription>{t.welcome.privacyDialog.description}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto rounded-lg border border-border/70 bg-background p-5">
          <article
            ref={rootRef}
            className="gw-policy-doc"
            dangerouslySetInnerHTML={{ __html: renderedMarkup }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
