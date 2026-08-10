import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from "react";

import { fireAndForget } from "@/shared/async";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import type { ThemeAccentPreset, ThemeMode } from "@/shared/types";
import { BrandHorizontalLogo } from "@/ui/branding/BrandHorizontalLogo";
import { cn } from "@/ui/components/lib/utils";
import { Button } from "@/ui/components/ui/button";
import { Checkbox } from "@/ui/components/ui/checkbox";
import { Label } from "@/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/components/ui/select";
import { Switch } from "@/ui/components/ui/switch";
import { t } from "@/ui/i18n";
import {
  ONBOARDING_DIRECTIONS,
  ONBOARDING_THING_TIMING,
} from "@/ui/options/brand-thing";
import { RandomizationControl } from "@/ui/options/components/CoordinateRandomizationControl";
import {
  ChromiumPreview,
  PrivacyPolicyDialog,
  WizardProgress,
} from "@/ui/options/components/onboarding/welcome-wizard-visuals";
import type { WizardStep } from "@/ui/options/components/onboarding/WelcomeWizard";

type WelcomeProps = {
  importFileRef: RefObject<HTMLInputElement | null>;
  importSettings: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  saveAdvanced: () => Promise<void>;
  startGuided: () => void;
};

const WelcomeStep = (props: WelcomeProps) => (
  <div className="gw-welcome-step-content flex flex-1 flex-col gap-6">
    <div className="max-w-2xl">
      <h2 className="text-2xl font-semibold tracking-tight">
        {t.welcome.steps.welcome.title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {t.welcome.steps.welcome.description}{" "}
        <button
          type="button"
          className="font-medium text-primary hover:underline"
          onClick={() => props.importFileRef.current?.click()}
        >
          {t.welcome.steps.welcome.importInline}
        </button>
        .
      </p>
      <input
        ref={props.importFileRef}
        type="file"
        accept="application/json"
        hidden
        onChange={(event) => fireAndForget(props.importSettings(event))}
      />
    </div>
    <div className="grid flex-1 gap-4 md:grid-cols-2">
      <button
        type="button"
        className="rounded-lg border border-border bg-background/70 p-5 text-left transition-colors hover:border-primary/70 hover:bg-accent/40"
        onClick={() => fireAndForget(props.saveAdvanced())}
      >
        <span className="text-base font-semibold">
          {t.welcome.steps.welcome.advancedTitle}
        </span>
        <span className="mt-2 block text-sm leading-6 text-muted-foreground">
          {t.welcome.steps.welcome.advancedDescription}
        </span>
        <span className="mt-5 inline-flex text-sm font-semibold text-primary">
          {t.welcome.steps.welcome.advancedCta}
        </span>
      </button>
      <button
        type="button"
        className="rounded-lg border border-primary/60 bg-primary/10 p-5 text-left transition-colors hover:bg-primary/15"
        onClick={props.startGuided}
      >
        <span className="text-base font-semibold">
          {t.welcome.steps.welcome.guidedTitle}
        </span>
        <span className="mt-2 block text-sm leading-6 text-muted-foreground">
          {t.welcome.steps.welcome.guidedDescription}
        </span>
        <span className="mt-5 inline-flex text-sm font-semibold text-primary">
          {t.welcome.steps.welcome.guidedCta}
        </span>
      </button>
    </div>
  </div>
);

type PresetProps = {
  allIds: readonly string[];
  options: readonly { id: string; label: string }[];
  randomize: boolean;
  radiusKm: number;
  selectedIds: Set<string>;
  setRandomize: (value: boolean) => void;
  setRadius: (value: number) => void;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
};

const PresetStep = (props: PresetProps) => (
  <div className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          className="font-medium text-primary hover:underline"
          onClick={() => props.setSelectedIds(new Set(props.allIds))}
        >
          {t.welcome.steps.presets.selectAll}
        </button>
        <span aria-hidden="true" className="text-muted-foreground">
          /
        </span>
        <button
          type="button"
          className="font-medium text-primary hover:underline"
          onClick={() => props.setSelectedIds(new Set())}
        >
          {t.welcome.steps.presets.selectNone}
        </button>
      </div>
      <span className="text-sm text-muted-foreground">
        {t.welcome.steps.presets.selectedCount(props.selectedIds.size)}
      </span>
    </div>
    <div className="grid max-h-44 gap-1.5 overflow-y-scroll rounded-lg border border-border/70 bg-background/35 p-3 pr-2 sm:grid-cols-2">
      {props.options.map(({ id, label }) => (
        <label
          key={id}
          className="flex items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-accent/50"
        >
          <Checkbox
            checked={props.selectedIds.has(id)}
            onChange={(event) =>
              props.setSelectedIds((current) => {
                const next = new Set(current);
                if (event.currentTarget.checked) next.add(id);
                else next.delete(id);
                return next;
              })
            }
          />
          <span>{label}</span>
        </label>
      ))}
    </div>
    <div className="pt-2">
      <RandomizationControl
        id="welcome-randomize-presets"
        checked={props.randomize}
        radiusKm={props.radiusKm}
        onCheckedChange={props.setRandomize}
        onRadiusKmChange={props.setRadius}
      />
    </div>
  </div>
);

const PrivacyStep = ({
  checked,
  setChecked,
}: {
  checked: boolean;
  setChecked: (value: boolean) => void;
}) => (
  <div className="flex items-start justify-between gap-5 py-3">
    <div>
      <Label htmlFor="welcome-osm-consent" className="font-semibold">
        {t.welcome.steps.privacy.consentTitle}
      </Label>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {t.welcome.steps.privacy.consentDescription}
      </p>
    </div>
    <Switch id="welcome-osm-consent" checked={checked} onCheckedChange={setChecked} />
  </div>
);

const ScopeStep = ({
  enabled,
  openDialog,
  setEnabled,
}: {
  enabled: boolean;
  openDialog: () => void;
  setEnabled: (value: boolean) => void;
}) => (
  <div className="flex flex-col gap-4">
    <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
      {t.welcome.steps.scope.defaultRuleDescription}
    </p>
    <div className="flex items-start justify-between gap-5 py-2">
      <div>
        <Label htmlFor="welcome-enable-everywhere" className="font-semibold">
          {t.welcome.steps.scope.enableEverywhereTitle}
        </Label>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {t.welcome.steps.scope.enableEverywhereDescription}
        </p>
      </div>
      <Switch
        id="welcome-enable-everywhere"
        checked={enabled}
        onCheckedChange={setEnabled}
      />
    </div>
    <div className="grid gap-3 py-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div>
        <h3 className="text-sm font-semibold">
          {t.welcome.steps.scope.editDefaultRuleTitle}
        </h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {t.welcome.steps.scope.editDefaultRuleDescription}
        </p>
      </div>
      <Button
        variant="outline"
        className="w-fit md:justify-self-end"
        onClick={openDialog}
      >
        {t.welcome.steps.scope.editDefaultRule}
      </Button>
    </div>
  </div>
);

type BrowserProps = {
  catalog: readonly { build: string; patch: string }[];
  permissionGranted: boolean | null;
  requestPermission: () => Promise<void>;
  rotateVersion: boolean;
  setRotateVersion: (value: boolean) => void;
};

const BrowserStep = (props: BrowserProps) =>
  BUILD_BROWSER_TARGET === "chromium" ? (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex w-full items-start justify-between gap-5 text-left">
        <div>
          <Label htmlFor="welcome-chromium-rotation" className="font-semibold">
            {t.welcome.steps.chromium.switchTitle}
          </Label>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {t.welcome.steps.chromium.switchDescription}
          </p>
        </div>
        <Switch
          id="welcome-chromium-rotation"
          checked={props.rotateVersion}
          onCheckedChange={props.setRotateVersion}
        />
      </div>
    </div>
  ) : (
    <div className="grid min-h-14 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <p
        className={cn(
          "text-sm leading-6 text-muted-foreground",
          props.permissionGranted && "font-medium text-tone-success-text",
        )}
      >
        {props.permissionGranted
          ? t.welcome.steps.firefox.granted
          : t.welcome.steps.firefox.skipped}
      </p>
      <Button
        variant="outline"
        className="w-fit justify-self-end"
        onClick={() => fireAndForget(props.requestPermission())}
      >
        {t.welcome.steps.firefox.action}
      </Button>
    </div>
  );

type AccentOption = { color: string; label: string; preset: ThemeAccentPreset };
type AppearanceProps = {
  accentOptions: AccentOption[];
  accentPreset: ThemeAccentPreset;
  highContrast: boolean;
  motionOverride: boolean;
  preference: ThemeMode;
  reduceMotion: boolean;
  selectedAccentColor: string;
  selectedAccentLabel: string;
  setAccentPreset: (value: ThemeAccentPreset) => Promise<void>;
  setHighContrast: (value: boolean) => Promise<void>;
  setPreference: (value: ThemeMode) => Promise<void>;
  setReduceMotion: (value: boolean) => Promise<void>;
};

const AppearanceStep = (props: AppearanceProps) => (
  <div className="flex flex-col gap-4">
    <div className="grid min-h-20 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div>
        <Label>{t.welcome.steps.appearance.themeTitle}</Label>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {t.welcome.steps.appearance.themeDescription}
        </p>
      </div>
      <Select
        value={props.preference}
        onValueChange={(value) =>
          fireAndForget(props.setPreference(value as ThemeMode))
        }
      >
        <SelectTrigger className="w-36 justify-between md:justify-self-end">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="system">{t.welcome.themeOptions.system}</SelectItem>
          <SelectItem value="light">{t.welcome.themeOptions.light}</SelectItem>
          <SelectItem value="dark">{t.welcome.themeOptions.dark}</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div className="grid min-h-20 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div>
        <Label>{t.welcome.steps.appearance.accentTitle}</Label>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {t.welcome.steps.appearance.accentDescription}
        </p>
      </div>
      <Select
        value={props.accentPreset}
        onValueChange={(value) =>
          fireAndForget(props.setAccentPreset(value as ThemeAccentPreset))
        }
      >
        <SelectTrigger className="w-40 justify-between md:justify-self-end">
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="block size-3 shrink-0 rounded-full border border-border/60"
              style={{ backgroundColor: props.selectedAccentColor }}
            />
            <span className="truncate">{props.selectedAccentLabel}</span>
          </div>
        </SelectTrigger>
        <SelectContent>
          {props.accentOptions.map((option) => (
            <SelectItem key={option.preset} value={option.preset}>
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="block size-3 shrink-0 rounded-full border border-border/60"
                  style={{ backgroundColor: option.color }}
                />
                <span>{option.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
    <div className="grid min-h-20 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div>
        <Label htmlFor="welcome-reduce-motion">
          {t.welcome.steps.appearance.reduceMotionTitle}
        </Label>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {props.motionOverride
            ? t.welcome.steps.appearance.reduceMotionSystemOverride
            : t.welcome.steps.appearance.reduceMotionDescription}
        </p>
      </div>
      <Switch
        id="welcome-reduce-motion"
        checked={props.reduceMotion}
        disabled={props.motionOverride}
        onCheckedChange={(checked) => fireAndForget(props.setReduceMotion(checked))}
      />
    </div>
    <div className="grid min-h-20 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div>
        <Label htmlFor="welcome-high-contrast">
          {t.welcome.steps.appearance.contrastTitle}
        </Label>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {t.welcome.steps.appearance.contrastDescription}
        </p>
      </div>
      <Switch
        id="welcome-high-contrast"
        checked={props.highContrast}
        onCheckedChange={(checked) => fireAndForget(props.setHighContrast(checked))}
      />
    </div>
  </div>
);

type GuidedProps = {
  appearance: AppearanceProps;
  browser: BrowserProps;
  copy: { description: string; title: string };
  openPolicy: () => void;
  presets: PresetProps;
  privacy: { checked: boolean; setChecked: (value: boolean) => void };
  scope: {
    enabled: boolean;
    openDialog: () => void;
    setEnabled: (value: boolean) => void;
  };
  step: Exclude<WizardStep, "welcome">;
};

const GuidedStep = (props: GuidedProps) => (
  <div className="gw-welcome-step-content flex flex-1 flex-col gap-6">
    {props.step === "browser" && BUILD_BROWSER_TARGET === "chromium" ? (
      <div className="flex justify-center">
        <ChromiumPreview
          enabled={props.browser.rotateVersion}
          catalogVersionDigits={props.browser.catalog}
        />
      </div>
    ) : null}
    <div>
      <h2 className="text-2xl font-semibold tracking-tight">{props.copy.title}</h2>
      {props.step === "privacy" ? (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {t.welcome.steps.privacy.descriptionBeforePolicy}{" "}
          <button
            type="button"
            className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
            onClick={props.openPolicy}
          >
            {t.welcome.steps.privacy.policyLink}
          </button>
          {t.welcome.steps.privacy.descriptionAfterPolicy}
        </p>
      ) : (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {props.copy.description}
        </p>
      )}
    </div>
    {props.step === "privacy" ? <PrivacyStep {...props.privacy} /> : null}
    {props.step === "presets" ? <PresetStep {...props.presets} /> : null}
    {props.step === "scope" ? <ScopeStep {...props.scope} /> : null}
    {props.step === "browser" ? <BrowserStep {...props.browser} /> : null}
    {props.step === "appearance" ? <AppearanceStep {...props.appearance} /> : null}
  </div>
);

type WizardViewProps = {
  appearance: AppearanceProps;
  browser: BrowserProps;
  complete: () => Promise<void>;
  copy: { description: string; title: string };
  error: string | null;
  goNext: () => void;
  goPrevious: () => void;
  onboardingCompleted: boolean;
  policyOpen: boolean;
  presets: PresetProps;
  privacy: GuidedProps["privacy"];
  reduceMotion: boolean;
  saving: boolean;
  scope: GuidedProps["scope"];
  setPolicyOpen: (value: boolean) => void;
  step: WizardStep;
  welcome: WelcomeProps;
};

export const WelcomeWizardView = (props: WizardViewProps) => (
  <div className="relative z-10 mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-[700px] flex-col items-center justify-center gap-3 px-2 py-4">
    <BrandHorizontalLogo
      className="gw-brand-logo--accent-cursor gw-brand-logo--crisp-shadow w-[300px] max-w-full"
      animateCursor
      animateIcon
      lookDirections={ONBOARDING_DIRECTIONS}
      thingTiming={ONBOARDING_THING_TIMING}
      reduceMotion={props.reduceMotion}
    />
    <div
      className="gw-animated-accent-border gw-animated-accent-halo gw-animated-accent-halo-surface gw-dialog-content--animated-border gw-dialog-surface relative z-[1] flex w-full flex-col gap-4 p-5 sm:p-6"
      data-animation-timing="steady"
    >
      <WizardProgress step={props.step} />
      {props.step === "welcome" ? (
        <WelcomeStep {...props.welcome} />
      ) : (
        <GuidedStep
          appearance={props.appearance}
          browser={props.browser}
          copy={props.copy}
          openPolicy={() => props.setPolicyOpen(true)}
          presets={props.presets}
          privacy={props.privacy}
          scope={props.scope}
          step={props.step}
        />
      )}
      {props.error ? (
        <p role="alert" className="text-sm text-destructive">
          {props.error}
        </p>
      ) : null}
      {props.step !== "welcome" ? (
        <div className="mt-auto flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={props.goPrevious} disabled={props.saving}>
            {t.welcome.previous}
          </Button>
          {props.step === "done" ? (
            <Button
              onClick={() => fireAndForget(props.complete())}
              disabled={props.saving || props.onboardingCompleted}
            >
              {props.saving ? t.welcome.saving : t.welcome.steps.done.cta}
            </Button>
          ) : (
            <Button onClick={props.goNext} disabled={props.saving}>
              {t.welcome.next}
            </Button>
          )}
        </div>
      ) : null}
    </div>
    <Button variant="ghost" onClick={() => props.setPolicyOpen(true)}>
      {t.welcome.privacyPolicy}
    </Button>
    <PrivacyPolicyDialog open={props.policyOpen} onOpenChange={props.setPolicyOpen} />
  </div>
);
