import { fireAndForget } from "@/shared/async";
import type { ThemeAccentPreset } from "@/shared/types";
import { cn } from "@/ui/components/lib/utils";
import {
  getSettingDescriptionId,
  getSettingTitleId,
  joinAriaIds,
} from "@/ui/components/settings-control-metadata";
import { SettingsControlCard } from "@/ui/components/SettingsControlCard";
import { SettingsHelpCard } from "@/ui/components/SettingsHelpCard";
import { SettingsSectionCard } from "@/ui/components/SettingsSectionCard";
import { SettingsSubcard } from "@/ui/components/SettingsSubcard";
import { Badge } from "@/ui/components/ui/badge";
import { Button } from "@/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/components/ui/select";
import { Switch } from "@/ui/components/ui/switch";
import { t } from "@/ui/i18n";
import type { OptionsModel } from "@/ui/options/components/tabs/options-model";
import { renderOsmConsentState } from "@/ui/options/components/tabs/options-surface-data";
import {
  SECTION_ANCHORS,
  SETTINGS_SUBPAGE_ANCHORS,
  SETTING_ANCHORS,
} from "@/ui/options/navigation";
import { icon } from "@/ui/options/utils";
import { getThemeAccentTokens } from "@/ui/shared/theme";
import { THEME_ACCENT_OPTIONS } from "@/ui/shared/theme-accent-options";

export const PrivacySection = ({ model }: { model: OptionsModel }) => (
  <SettingsSectionCard
    anchorId={SECTION_ANCHORS.options.privacy}
    copyLabel={t.common.copyLinkTo(t.advanced.privacy.copyLinkLabel)}
    title={<h2 className="text-xl font-semibold">{t.advanced.privacy.title}</h2>}
    description={t.advanced.privacy.description}
    highlighted={model.settings.highlightedAnchorId === SECTION_ANCHORS.options.privacy}
    headerActions={
      <Button
        variant="secondary"
        className="shrink-0"
        onClick={() =>
          model.settings.navigateToAnchor(SETTINGS_SUBPAGE_ANCHORS.privacyPolicy, {
            highlight: false,
          })
        }
      >
        {t.common.actions.openPrivacyPolicy}
      </Button>
    }
    contentClassName="flex flex-col gap-6 pt-6"
  >
    <SettingsControlCard
      anchorId={SETTING_ANCHORS.advanced.osmConsent}
      copyLabel={t.common.copyLinkTo(t.advanced.privacy.osmConsent.copyLinkLabel)}
      title={
        <h3 className="text-sm font-semibold">{t.advanced.privacy.osmConsent.title}</h3>
      }
      description={t.advanced.privacy.osmConsent.description}
      focusControlOnTitleClick
      highlighted={
        model.settings.highlightedAnchorId === SETTING_ANCHORS.advanced.osmConsent
      }
      contentClassName="flex flex-col gap-3 pt-4"
      action={
        <Switch
          aria-labelledby={getSettingTitleId(SETTING_ANCHORS.advanced.osmConsent)}
          aria-describedby={joinAriaIds(
            getSettingDescriptionId(SETTING_ANCHORS.advanced.osmConsent),
          )}
          checked={model.settings.osmConsent === "granted"}
          disabled={model.simpleDisabled}
          onCheckedChange={(checked) => {
            const next = checked ? "granted" : "denied";
            model.settings.setOsmConsent(next);
            model.settings.scheduleAutosave({ osmConsent: next });
          }}
        />
      }
    >
      <p className="text-sm text-muted-foreground">
        {renderOsmConsentState(model.settings.osmConsent)}
      </p>
    </SettingsControlCard>
  </SettingsSectionCard>
);

const AccentChip = ({
  disabled,
  label,
  onSelect,
  preset,
  previewColor,
  selected,
}: {
  disabled: boolean;
  label: string;
  onSelect: (preset: ThemeAccentPreset) => void;
  preset: ThemeAccentPreset;
  previewColor: string;
  selected: boolean;
}) => (
  <Button
    type="button"
    variant="outline"
    aria-label={t.advanced.display.accentColor.optionAriaLabel(label)}
    aria-pressed={selected}
    disabled={disabled}
    className={cn(
      "h-auto justify-start rounded-xl px-3 py-2 text-left",
      selected
        ? "border-primary bg-primary/10 text-foreground shadow-sm ring-1 ring-primary/30 hover:bg-primary/15"
        : "bg-card/35 text-foreground hover:bg-accent/70",
    )}
    onClick={() => onSelect(preset)}
  >
    <span className="flex w-full items-center gap-3">
      <span
        aria-hidden="true"
        className={cn(
          "block h-4 w-4 rounded-full border border-border/60",
          selected && "ring-2 ring-primary/35 ring-offset-2 ring-offset-background",
        )}
        style={{ backgroundColor: previewColor }}
      />
      <span className="flex-1 text-sm font-medium">{label}</span>
      {selected ? (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary">
          {icon("fa-check", "text-[11px]")}
        </span>
      ) : null}
    </span>
  </Button>
);

const LanguageCard = () => (
  <SettingsControlCard
    anchorId={SETTING_ANCHORS.options.language}
    copyLabel={t.common.copyLinkTo(t.advanced.display.language.copyLinkLabel)}
    title={
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        {t.advanced.display.language.title}
        <Badge variant="outline">{t.advanced.display.language.soon}</Badge>
      </h3>
    }
    description={t.advanced.display.language.description}
    actionClassName="w-full sm:w-44"
    action={
      <Select value="en" disabled>
        <SelectTrigger
          id="language-trigger"
          aria-label={t.advanced.display.language.title}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en">{t.advanced.display.language.option}</SelectItem>
        </SelectContent>
      </Select>
    }
  />
);

const ThemeCard = ({ model }: { model: OptionsModel }) => (
  <SettingsControlCard
    anchorId={SETTING_ANCHORS.advanced.themeMode}
    copyLabel={t.common.copyLinkTo(t.advanced.themeMode.copyLinkLabel)}
    title={<h3 className="text-sm font-semibold">{t.advanced.themeMode.title}</h3>}
    description={t.advanced.themeMode.description}
    focusControlOnTitleClick
    highlighted={
      model.settings.highlightedAnchorId === SETTING_ANCHORS.advanced.themeMode
    }
    actionClassName="w-full sm:w-44"
    action={
      <Select
        value={model.settings.themeMode}
        disabled={model.simpleDisabled}
        onValueChange={(value) => {
          const mode = value as typeof model.settings.themeMode;
          model.settings.setThemeMode(mode);
          fireAndForget(model.themeState.setPreference(mode));
        }}
      >
        <SelectTrigger
          id="theme-mode-trigger"
          aria-labelledby={getSettingTitleId(SETTING_ANCHORS.advanced.themeMode)}
          aria-describedby={getSettingDescriptionId(SETTING_ANCHORS.advanced.themeMode)}
        >
          <SelectValue placeholder={t.advanced.themeMode.label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="system">{t.advanced.themeMode.options.system}</SelectItem>
          <SelectItem value="light">{t.advanced.themeMode.options.light}</SelectItem>
          <SelectItem value="dark">{t.advanced.themeMode.options.dark}</SelectItem>
        </SelectContent>
      </Select>
    }
  />
);

const AccentCard = ({ model }: { model: OptionsModel }) => (
  <SettingsControlCard
    anchorId={SETTING_ANCHORS.advanced.accentColor}
    copyLabel={t.common.copyLinkTo(t.advanced.display.accentColor.copyLinkLabel)}
    title={
      <h3 className="text-sm font-semibold">{t.advanced.display.accentColor.title}</h3>
    }
    description={t.advanced.display.accentColor.description}
    focusControlOnTitleClick
    highlighted={
      model.settings.highlightedAnchorId === SETTING_ANCHORS.advanced.accentColor
    }
  >
    <div
      role="group"
      aria-labelledby={getSettingTitleId(SETTING_ANCHORS.advanced.accentColor)}
      aria-describedby={getSettingDescriptionId(SETTING_ANCHORS.advanced.accentColor)}
      className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
    >
      {THEME_ACCENT_OPTIONS.map(({ preset, label }) => (
        <AccentChip
          key={preset}
          preset={preset}
          label={label}
          previewColor={`hsl(${getThemeAccentTokens(preset, model.themeState.theme, model.themeState.highContrast).primary})`}
          selected={model.settings.themeAccentPreset === preset}
          disabled={model.simpleDisabled}
          onSelect={(next) => {
            model.settings.setThemeAccentPreset(next);
            fireAndForget(model.themeState.setAccentPreset(next));
          }}
        />
      ))}
    </div>
  </SettingsControlCard>
);

const MotionCards = ({ model }: { model: OptionsModel }) => (
  <>
    <SettingsControlCard
      anchorId={SETTING_ANCHORS.advanced.reduceMotion}
      copyLabel={t.common.copyLinkTo(t.advanced.display.reduceMotion.copyLinkLabel)}
      title={
        <h3 className="text-sm font-semibold">
          {t.advanced.display.reduceMotion.title}
        </h3>
      }
      description={
        model.themeState.motionOverride
          ? t.advanced.display.reduceMotion.systemOverride
          : t.advanced.display.reduceMotion.description
      }
      focusControlOnTitleClick
      highlighted={
        model.settings.highlightedAnchorId === SETTING_ANCHORS.advanced.reduceMotion
      }
      action={
        <Switch
          aria-labelledby={getSettingTitleId(SETTING_ANCHORS.advanced.reduceMotion)}
          aria-describedby={getSettingDescriptionId(
            SETTING_ANCHORS.advanced.reduceMotion,
          )}
          checked={model.themeState.reduceMotion}
          disabled={model.simpleDisabled || model.themeState.motionOverride}
          onCheckedChange={(checked) =>
            fireAndForget(model.themeState.setReduceMotion(checked))
          }
        />
      }
    />
    <SettingsControlCard
      anchorId={SETTING_ANCHORS.advanced.highContrastMode}
      copyLabel={t.common.copyLinkTo(t.advanced.display.highContrast.copyLinkLabel)}
      title={
        <h3 className="text-sm font-semibold">
          {t.advanced.display.highContrast.title}
        </h3>
      }
      description={t.advanced.display.highContrast.description}
      focusControlOnTitleClick
      highlighted={
        model.settings.highlightedAnchorId === SETTING_ANCHORS.advanced.highContrastMode
      }
      action={
        <Switch
          aria-labelledby={getSettingTitleId(SETTING_ANCHORS.advanced.highContrastMode)}
          aria-describedby={getSettingDescriptionId(
            SETTING_ANCHORS.advanced.highContrastMode,
          )}
          checked={Boolean(model.settings.highContrastMode)}
          disabled={model.simpleDisabled}
          onCheckedChange={(checked) => {
            model.settings.setHighContrastMode(checked);
            fireAndForget(model.themeState.setHighContrast(checked));
          }}
        />
      }
    />
  </>
);

const BadgeCard = ({ model }: { model: OptionsModel }) => (
  <SettingsControlCard
    anchorId={SETTING_ANCHORS.advanced.badgeQueryCount}
    copyLabel={t.common.copyLinkTo(t.optionsPage.badgeQueryCount.label)}
    title={
      <h3 className="text-sm font-semibold">{t.optionsPage.badgeQueryCount.label}</h3>
    }
    description={t.optionsPage.badgeQueryCount.description}
    focusControlOnTitleClick
    highlighted={
      model.settings.highlightedAnchorId === SETTING_ANCHORS.advanced.badgeQueryCount
    }
    action={
      <Switch
        aria-labelledby={getSettingTitleId(SETTING_ANCHORS.advanced.badgeQueryCount)}
        aria-describedby={getSettingDescriptionId(
          SETTING_ANCHORS.advanced.badgeQueryCount,
        )}
        checked={Boolean(model.settings.showBadgeQueryCount)}
        disabled={model.simpleDisabled}
        onCheckedChange={(checked) => {
          model.settings.setShowBadgeQueryCount(checked);
          model.settings.scheduleAutosave({ showBadgeQueryCount: checked });
        }}
      />
    }
  >
    <SettingsSubcard
      anchorId={SETTING_ANCHORS.advanced.badgeDateCallCount}
      title={
        <h4 className="min-w-0 text-sm font-medium leading-5 text-foreground">
          {t.optionsPage.badgeQueryCount.includeDateCalls.label}
        </h4>
      }
      description={t.optionsPage.badgeQueryCount.includeDateCalls.description}
      focusControlOnTitleClick
      action={
        <Switch
          aria-labelledby={getSettingTitleId(
            SETTING_ANCHORS.advanced.badgeDateCallCount,
          )}
          aria-describedby={getSettingDescriptionId(
            SETTING_ANCHORS.advanced.badgeDateCallCount,
          )}
          className="mt-0.5 origin-left scale-90"
          checked={model.settings.includeDateCallsInBadgeCount}
          disabled={model.simpleDisabled || !model.settings.showBadgeQueryCount}
          onCheckedChange={(checked) => {
            model.settings.setCountDateCalls(checked);
            model.settings.scheduleAutosave({ includeDateCallsInBadgeCount: checked });
          }}
        />
      }
    />
  </SettingsControlCard>
);

export const AppearanceSection = ({ model }: { model: OptionsModel }) => (
  <SettingsSectionCard
    anchorId={SECTION_ANCHORS.options.appearance}
    copyLabel={t.common.copyLinkTo(t.advanced.display.copyLinkLabel)}
    title={<h2 className="text-xl font-semibold">{t.advanced.display.title}</h2>}
    description={t.advanced.display.description}
    highlighted={
      model.settings.highlightedAnchorId === SECTION_ANCHORS.options.appearance
    }
    contentClassName="flex flex-col gap-6 pt-6"
  >
    <LanguageCard />
    <ThemeCard model={model} />
    <AccentCard model={model} />
    <MotionCards model={model} />
    <BadgeCard model={model} />
  </SettingsSectionCard>
);

export const OptionsSidebar = ({ model }: { model: OptionsModel }) => (
  <div className="col-span-12 lg:col-span-4">
    <SettingsSectionCard
      anchorId={SECTION_ANCHORS.options.fallback}
      copyLabel={t.common.copyLinkTo(t.rules.globalFallback.copyLinkLabel)}
      title={<h2 className="text-lg font-semibold">{t.rules.globalFallback.title}</h2>}
      description={t.rules.globalFallback.description}
      highlighted={
        model.settings.highlightedAnchorId === SECTION_ANCHORS.options.fallback
      }
      className="mb-5"
      headerActions={
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() =>
            model.settings.navigateToAnchor(SECTION_ANCHORS.rules.globalFallback, {
              highlight: true,
            })
          }
        >
          {t.rules.globalFallback.openInRules}
        </Button>
      }
    />
    <SettingsHelpCard
      anchorId={SECTION_ANCHORS.options.help}
      copyLabel={t.common.copyLinkTo(t.optionsPage.copyLinkHelpLabel)}
      title={t.optionsPage.help.title}
      highlighted={model.settings.highlightedAnchorId === SECTION_ANCHORS.options.help}
    >
      <p>{t.optionsPage.help.body1}</p>
      <p>{t.optionsPage.help.body2}</p>
    </SettingsHelpCard>
  </div>
);
