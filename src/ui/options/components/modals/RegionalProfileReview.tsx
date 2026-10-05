import { useMemo } from "react";

import { detectLanguagePolicy } from "@/shared/accept-language";
import type { BrowserFingerprintSource } from "@/shared/browser-fingerprint";
import {
  buildRegionalPreview,
  getSuggestedTimeZone,
  type RegionalProfile,
} from "@/shared/regional-profile";
import { Button } from "@/ui/components/ui/button";
import { t } from "@/ui/i18n";

type ReviewProps = {
  profile: RegionalProfile;
  disabled: boolean;
  applyTimeZone?: ((timeZone: string) => void) | undefined;
};

const readLanguagePolicy = () => {
  const source = navigator as Navigator &
    Pick<BrowserFingerprintSource, "userAgentData">;
  return detectLanguagePolicy({
    userAgent: source.userAgent,
    ...(source.userAgentData ? { userAgentData: source.userAgentData } : {}),
  });
};

const PreviewValues = ({
  preview,
}: {
  preview: NonNullable<ReturnType<typeof buildRegionalPreview>>;
}) => {
  const values = [
    [t.locations.regionalReview.browserLanguage, preview.language],
    [t.locations.regionalReview.preferredLanguages, preview.languages.join(", ")],
    [t.locations.regionalReview.languageHeader, preview.acceptLanguage],
    [t.locations.regionalReview.formattingLocale, preview.resolvedFormattingLocale],
    [t.common.fields.timeZone, preview.timeZone],
    [t.locations.regionalReview.january, preview.dates[0]],
    [t.locations.regionalReview.july, preview.dates[1]],
    [t.locations.regionalReview.number, preview.number],
  ];
  return (
    <dl className="mt-3 space-y-2 text-xs" data-regional-preview>
      {values.map(([label, value]) => (
        <div key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="break-words font-mono">{value}</dd>
        </div>
      ))}
    </dl>
  );
};

export const RegionalProfileReview = ({
  profile,
  disabled,
  applyTimeZone,
}: ReviewProps) => {
  const { latitude, longitude, timeZone, language, languages, preferEnglishContent } =
    profile;
  const suggestedTimeZone = useMemo(
    () => getSuggestedTimeZone({ latitude, longitude, timeZone }),
    [latitude, longitude, timeZone],
  );
  const preview = useMemo(
    () =>
      buildRegionalPreview(
        {
          timeZone,
          language,
          languages,
          ...(preferEnglishContent === undefined ? {} : { preferEnglishContent }),
        },
        readLanguagePolicy(),
      ),
    [timeZone, language, languages, preferEnglishContent],
  );
  return (
    <section className="space-y-3" data-regional-review>
      {suggestedTimeZone ? (
        <div
          role="status"
          data-regional-warning="timeZone"
          className="rounded-md border border-tone-warning-border bg-tone-warning-bg p-3 text-sm text-tone-warning-text"
        >
          <p>
            {t.locations.regionalReview.mismatch(profile.timeZone, suggestedTimeZone)}
          </p>
          <p className="mt-1 text-xs">{t.locations.regionalReview.approximation}</p>
          {applyTimeZone ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2 h-auto min-h-8 max-w-full whitespace-normal break-words py-2"
              disabled={disabled}
              data-regional-apply-timezone
              onClick={() => applyTimeZone(suggestedTimeZone)}
            >
              {t.locations.regionalReview.applyTimeZone(suggestedTimeZone)}
            </Button>
          ) : null}
        </div>
      ) : null}
      <details className="rounded-md border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          {t.locations.regionalReview.title}
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">
          {t.locations.regionalReview.scope}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {t.locations.regionalReview.samples}
        </p>
        {preview ? (
          <PreviewValues preview={preview} />
        ) : (
          <p
            className="mt-2 text-sm text-destructive"
            data-regional-preview-unavailable
          >
            {t.locations.regionalReview.unavailable}
          </p>
        )}
      </details>
    </section>
  );
};
