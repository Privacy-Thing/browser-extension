import type { CSSProperties } from "react";

import { PopupButton } from "./PopupButton";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/components/ui/tooltip";
import type { PopupBorderTiming } from "@/ui/popup/popup-border-timing";

type PopupRuleCardProps = {
  /**
   * The popup's presentation discriminant, published so tests can assert the
   * state the card is in instead of the sentence rendered for that state.
   */
  presentationKind?: string;
  protectionStatus?: string;
  title: string;
  tone: "active" | "disabled" | "warning" | "danger";
  accentColor?: string;
  animatedBorderColor?: string;
  animationTiming?: PopupBorderTiming;
  summarySource: string;
  summarySourcePattern?: string;
  summaryProfile?: string;
  summaryLanguage?: string;
  summaryLanguageTitle?: string;
  summaryCounts?: string;
  summaryProtectedCount?: number;
  summaryException?: string;
  detailsLabel?: string;
  onDetails?: () => void;
};

type PopupRuleCardStyle = CSSProperties &
  Record<`--gw-popup-rule-${string}`, string | undefined>;

const withAlpha = (color: string, alphaHex: string): string => {
  if (/^#(?:[0-9a-fA-F]{6})$/.test(color)) {
    return `${color}${alphaHex}`;
  }

  const alphaPercent = Math.round((parseInt(alphaHex, 16) / 255) * 100);
  return `color-mix(in srgb, ${color} ${alphaPercent}%, transparent)`;
};

const lightenColor = (color: string, amount: number): string =>
  `color-mix(in srgb, ${color} ${Math.max(0, Math.min(100, 100 - amount))}%, white)`;

export const getPopupRuleToneAccent = (tone: PopupRuleCardProps["tone"]): string => {
  if (tone === "active") return "var(--gw-popup-success-accent)";
  if (tone === "warning") return "var(--gw-popup-warning-accent)";
  if (tone === "danger") return "hsl(var(--tone-error-text))";
  return "var(--gw-popup-disabled-accent)";
};

export const getLanguagePriorityLines = (title: string): string[] =>
  title.split("\n").filter(Boolean);

const LanguagePriorityTooltip = ({ title }: { title: string }) => {
  const [heading, ...priorities] = getLanguagePriorityLines(title);

  return (
    <TooltipContent side="bottom" align="start" className="gw-popup-language-tooltip">
      {heading ? (
        <span className="gw-popup-language-tooltip-heading">{heading}</span>
      ) : null}
      <ol className="gw-popup-language-tooltip-list">
        {priorities.map((priority, index) => (
          <li key={priority} className="gw-popup-language-tooltip-item">
            <span className="gw-popup-language-tooltip-rank">{index + 1}</span>
            <span>{priority.replace(/^\d+\.\s*/, "")}</span>
          </li>
        ))}
      </ol>
    </TooltipContent>
  );
};

const getCardStyle = ({
  accentColor,
  animatedBorderAccent,
}: {
  accentColor: string | undefined;
  animatedBorderAccent: string;
}): PopupRuleCardStyle => {
  const accentWash = accentColor
    ? withAlpha(accentColor, "12")
    : withAlpha(animatedBorderAccent, "12");
  const animatedBorderGlow = withAlpha(animatedBorderAccent, "4d");

  return {
    "--gw-popup-rule-accent-source": animatedBorderAccent,
    "--gw-popup-rule-accent-base": withAlpha(animatedBorderAccent, "26"),
    "--gw-popup-rule-accent-trail": withAlpha(animatedBorderAccent, "59"),
    "--gw-popup-rule-accent-light": animatedBorderAccent,
    "--gw-popup-rule-accent-peak": lightenColor(animatedBorderAccent, 10),
    "--gw-popup-rule-accent-wash": accentWash,
    "--gw-popup-rule-accent-glow": animatedBorderGlow,
  };
};

/**
 * Model-level state published for assertions, so tests can check which state the
 * card is in instead of the sentence rendered for that state.
 *
 * `data-compatibility-warning` is its own signal, not a view of the protection
 * status: a page can warn about compatibility while the status is fine, and can
 * need attention without warning.
 */
const buildModelAttributes = (
  presentationKind: string | undefined,
  protectionStatus: string | undefined,
  summaryException: string | undefined,
): Record<string, string> => ({
  ...(presentationKind ? { "data-presentation": presentationKind } : {}),
  ...(protectionStatus ? { "data-protection-status": protectionStatus } : {}),
  "data-compatibility-warning": summaryException ? "true" : "false",
});

const buildCountAttributes = (
  summaryProtectedCount: number | undefined,
): Record<string, string> =>
  summaryProtectedCount === undefined
    ? {}
    : { "data-protected-count": String(summaryProtectedCount) };

export const PopupRuleCard = ({
  presentationKind,
  protectionStatus,
  title,
  tone,
  accentColor,
  animatedBorderColor,
  animationTiming,
  summarySource,
  summarySourcePattern,
  summaryProfile,
  summaryLanguage,
  summaryLanguageTitle,
  summaryCounts,
  summaryProtectedCount,
  summaryException,
  detailsLabel,
  onDetails,
}: PopupRuleCardProps) => {
  const animatedBorderAccent =
    animatedBorderColor ?? accentColor ?? getPopupRuleToneAccent(tone);
  const resolvedAnimationTiming =
    animationTiming ?? (tone === "warning" || tone === "danger" ? "urgent" : "steady");

  const modelAttributes = buildModelAttributes(
    presentationKind,
    protectionStatus,
    summaryException,
  );
  const countAttributes = buildCountAttributes(summaryProtectedCount);

  return (
    <section
      id="current-rule"
      className="gw-popup-rule-card gw-popup-rule-card--animated-border gw-animated-accent-surface"
      {...modelAttributes}
      data-tone={tone}
      data-animation-timing={resolvedAnimationTiming}
      style={getCardStyle({ accentColor, animatedBorderAccent })}
    >
      <div className="gw-popup-rule-card-content">
        <div className="gw-popup-rule-heading">
          <h2 className="gw-popup-rule-title">{title}</h2>
          {detailsLabel && onDetails ? (
            <PopupButton
              variant="link"
              size="sm"
              className="gw-popup-rule-details-link"
              onClick={onDetails}
            >
              {detailsLabel}
            </PopupButton>
          ) : null}
          <p className="gw-popup-rule-source">
            {summarySourcePattern ? (
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="gw-popup-tooltip-value">{summarySource}</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start">
                    {summarySourcePattern}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <span>{summarySource}</span>
            )}
            {summaryProfile ? (
              <>
                <span aria-hidden="true"> · </span>
                <span id="current-profile">{summaryProfile}</span>
              </>
            ) : null}
            {summaryLanguage ? (
              <>
                <span aria-hidden="true"> · </span>
                {summaryLanguageTitle ? (
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopupButton
                          variant="link"
                          size="sm"
                          className="gw-popup-language-trigger"
                          aria-label={summaryLanguageTitle}
                        >
                          {summaryLanguage}
                        </PopupButton>
                      </TooltipTrigger>
                      <LanguagePriorityTooltip title={summaryLanguageTitle} />
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <span>{summaryLanguage}</span>
                )}
              </>
            ) : null}
          </p>
        </div>
        {summaryException || summaryCounts ? (
          <div className="gw-popup-rule-footer">
            {summaryException ? (
              <p className="gw-popup-rule-exception">{summaryException}</p>
            ) : null}
            {summaryCounts ? (
              <p className="gw-popup-protection-counts" {...countAttributes}>
                {summaryCounts}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
};
