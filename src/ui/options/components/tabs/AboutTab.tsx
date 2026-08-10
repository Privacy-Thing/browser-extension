import React from "react";

import { WebhWordmark } from "@/ui/branding/WebhWordmark";
import { cn } from "@/ui/components/lib/utils";
import { SettingsHelpCard } from "@/ui/components/SettingsHelpCard";
import { Button } from "@/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/ui/card";
import { Separator } from "@/ui/components/ui/separator";
import { TabsContent } from "@/ui/components/ui/tabs";
import { t } from "@/ui/i18n";
import { AnchorHeading } from "@/ui/options/components/AnchorHeading";
import {
  PAGE_ANCHORS,
  SECTION_ANCHORS,
  SETTINGS_SUBPAGE_ANCHORS,
} from "@/ui/options/navigation";
import { useSettings } from "@/ui/options/state/SettingsContext";
import { capabilities, icon } from "@/ui/options/utils";

const LazyPrivacyPolicySubpage = React.lazy(async () => ({
  default: (await import("@/ui/options/components/subpages/PrivacyPolicySubpage"))
    .PrivacyPolicySubpage,
}));
const LazyNoticesSubpage = React.lazy(async () => ({
  default: (await import("@/ui/options/components/subpages/ThirdPartyNoticesSubpage"))
    .ThirdPartyNoticesSubpage,
}));
const LazyLicenseSubpage = React.lazy(async () => ({
  default: (await import("@/ui/options/components/subpages/LicenseSubpage"))
    .LicenseSubpage,
}));

const getReleaseChannelLabel = (channel: "local" | "beta" | "stable"): string => {
  if (channel === "local") return t.about.releaseChannels.local;
  if (channel === "beta") return t.about.releaseChannels.beta;
  return t.about.releaseChannels.stable;
};

const renderAboutSubpage = (
  view: "privacyPolicy" | "thirdPartyNotices" | "license" | "none" | "logs" | null,
) => {
  if (view === "privacyPolicy")
    return (
      <React.Suspense fallback={null}>
        <LazyPrivacyPolicySubpage />
      </React.Suspense>
    );
  if (view === "thirdPartyNotices")
    return (
      <React.Suspense fallback={null}>
        <LazyNoticesSubpage />
      </React.Suspense>
    );
  if (view === "license")
    return (
      <React.Suspense fallback={null}>
        <LazyLicenseSubpage />
      </React.Suspense>
    );
  return null;
};

const AboutIntro = () => (
  <>
    <div>
      <AnchorHeading
        anchorId={SECTION_ANCHORS.about.overview}
        label={t.common.copyLinkTo(t.about.copyLinkLabel)}
      >
        <h2 className="text-xl font-semibold">{t.about.title}</h2>
      </AnchorHeading>
      <p className="mt-1 text-sm text-muted-foreground">{t.about.description}</p>
    </div>
    <p className="text-sm text-muted-foreground">
      <span>{t.about.body1}</span> <span>{t.about.body2}</span>{" "}
      <span>{t.about.body3Prefix}</span>{" "}
      <a
        href={`#${SECTION_ANCHORS.options.overview}`}
        className="font-medium text-foreground underline underline-offset-4"
      >
        {t.about.body3LinkLabel}
      </a>
      <span>{t.about.body3Suffix}</span>
    </p>
    <p className="text-sm text-muted-foreground">
      {t.about.website.prefix}
      <a
        href={t.about.website.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground underline underline-offset-4"
      >
        {t.about.website.linkLabel}
      </a>
      {t.about.website.suffix}
    </p>
  </>
);

const Limitations = () => {
  const { highlightedAnchorId } = useSettings();
  return (
    <>
      <Separator />
      <div
        id={SECTION_ANCHORS.about.limitations}
        data-anchor-id={SECTION_ANCHORS.about.limitations}
        className={cn(
          "gw-anchor-target scroll-mt-7",
          highlightedAnchorId === SECTION_ANCHORS.about.limitations &&
            "gw-anchor-highlighted",
        )}
      >
        <AnchorHeading
          anchorId={SECTION_ANCHORS.about.limitations}
          label={t.common.copyLinkTo(t.about.copyLinkLimitationsLabel)}
        >
          <h3 className="text-base font-semibold">{t.about.limitations.title}</h3>
        </AnchorHeading>
        <div className="mt-2 flex flex-col gap-3 text-sm text-muted-foreground">
          <p>{t.about.limitations.intro}</p>
          <ul className="list-disc space-y-2 pl-5 marker:text-primary">
            <li>{t.about.limitations.body1}</li>
            <li>{t.about.limitations.body2}</li>
            <li>{t.about.limitations.body3}</li>
          </ul>
          <p className="font-medium text-foreground">{t.about.limitations.outro}</p>
        </div>
      </div>
      <div className="grid gap-4 rounded-2xl border border-border/60 bg-muted/20 p-4 sm:grid-cols-[minmax(0,6.75rem)_1fr] sm:items-center">
        <a
          href={t.about.support.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.about.support.logoLinkAriaLabel}
          className="block w-fit rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <WebhWordmark className="w-[84px] max-w-full sm:w-[96px]" />
        </a>
        <p className="text-sm text-muted-foreground">
          {t.about.support.bodyPrefix}
          <a
            href={t.about.support.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline underline-offset-4"
          >
            {t.about.support.linkLabel}
          </a>
          {t.about.support.bodySuffix}
        </p>
      </div>
    </>
  );
};

const BuildMetadata = () => {
  const { releaseChannel, version } = useSettings();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t.about.versionLabel}
        </p>
        <p id="about-version" className="text-sm">
          {version}
        </p>
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t.about.browserTargetLabel}
        </p>
        <p id="about-browser-target" className="text-sm">
          {capabilities.target}
        </p>
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t.about.releaseChannelLabel}
        </p>
        <p id="about-release-channel" className="text-sm">
          {getReleaseChannelLabel(releaseChannel)}
        </p>
      </div>
    </div>
  );
};

const TermsSection = () => {
  const { highlightedAnchorId } = useSettings();
  return (
    <>
      <Separator />
      <div
        id={SECTION_ANCHORS.about.terms}
        data-anchor-id={SECTION_ANCHORS.about.terms}
        className={cn(
          "gw-anchor-target scroll-mt-7",
          highlightedAnchorId === SECTION_ANCHORS.about.terms &&
            "gw-anchor-highlighted",
        )}
      >
        <AnchorHeading
          anchorId={SECTION_ANCHORS.about.terms}
          label={t.common.copyLinkTo(t.about.copyLinkTermsLabel)}
        >
          <h3 className="text-base font-semibold">{t.about.terms.title}</h3>
        </AnchorHeading>
        <div className="mt-2 flex flex-col gap-3 text-sm text-muted-foreground">
          <p>{t.about.terms.body1}</p>
          <p>{t.about.terms.body2}</p>
          <p>{t.about.terms.body3}</p>
        </div>
      </div>
    </>
  );
};

const PolicySections = () => {
  const { highlightedAnchorId, navigateToAnchor } = useSettings();
  return (
    <>
      <Separator />
      <div
        id={SECTION_ANCHORS.about.license}
        data-anchor-id={SECTION_ANCHORS.about.license}
        className={cn(
          "gw-anchor-target scroll-mt-7",
          highlightedAnchorId === SECTION_ANCHORS.about.license &&
            "gw-anchor-highlighted",
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <AnchorHeading
            anchorId={SECTION_ANCHORS.about.license}
            label={t.common.copyLinkTo(t.about.copyLinkLicenseLabel)}
          >
            <h3 className="text-base font-semibold">{t.about.license.title}</h3>
          </AnchorHeading>
          <Button
            variant="secondary"
            className="w-fit shrink-0 self-start"
            onClick={() =>
              navigateToAnchor(SETTINGS_SUBPAGE_ANCHORS.license, { highlight: false })
            }
          >
            {t.about.license.openLicenseButton}
          </Button>
        </div>
        <div className="mt-2 flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            {t.about.license.creatorPrefix}
            <a
              href={t.about.license.creatorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline underline-offset-4"
            >
              {t.about.license.creatorLabel}
            </a>
            {t.about.license.creatorSuffix} {t.about.license.copyright}
          </p>
          <p>{t.about.license.body}</p>
        </div>
      </div>
      <Separator />
      <div
        id={SECTION_ANCHORS.about.privacy}
        data-anchor-id={SECTION_ANCHORS.about.privacy}
        className={cn(
          "gw-anchor-target scroll-mt-7",
          highlightedAnchorId === SECTION_ANCHORS.about.privacy &&
            "gw-anchor-highlighted",
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <AnchorHeading
            anchorId={SECTION_ANCHORS.about.privacy}
            label={t.common.copyLinkTo(t.about.copyLinkPrivacyLabel)}
          >
            <h3 className="text-base font-semibold">{t.about.privacy.title}</h3>
          </AnchorHeading>
          <Button
            variant="secondary"
            className="w-fit shrink-0 self-start"
            onClick={() =>
              navigateToAnchor(SETTINGS_SUBPAGE_ANCHORS.privacyPolicy, {
                highlight: false,
              })
            }
          >
            {t.about.privacy.openPolicyButton}
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t.about.privacy.body}</p>
      </div>
    </>
  );
};

const AssetParagraphs = () => (
  <div className="mt-2 flex flex-col gap-3 text-sm text-muted-foreground">
    <p>{t.about.assets.body}</p>
    <p data-asset="font-awesome">
      <a
        href={t.about.assets.fontAwesome.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground underline underline-offset-4"
      >
        {t.about.assets.fontAwesome.label}
      </a>
      {t.about.assets.fontAwesome.body}
    </p>
    <p>
      <a
        href={t.about.assets.mapLibre.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground underline underline-offset-4"
      >
        {t.about.assets.mapLibre.label}
      </a>
      {t.about.assets.mapLibre.body}
    </p>
    <p>
      <a
        href={t.about.assets.osmWikiCountryCodes.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground underline underline-offset-4"
      >
        {t.about.assets.osmWikiCountryCodes.label}
      </a>
      {t.about.assets.osmWikiCountryCodes.body}{" "}
      <a
        href={t.about.assets.osmWikiCountryCodes.licenseUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground underline underline-offset-4"
      >
        {t.about.assets.osmWikiCountryCodes.licenseLabel}
      </a>
      {t.about.assets.osmWikiCountryCodes.licenseBody}
    </p>
    <p>
      {t.about.assets.mapPreviewsPrefix}
      <a
        href={t.about.assets.openFreeMap.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground underline underline-offset-4"
      >
        {t.about.assets.openFreeMap.label}
      </a>
      {t.about.assets.mapPreviewsMiddle}
      <a
        href={t.about.assets.openStreetMap.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground underline underline-offset-4"
      >
        {t.about.assets.openStreetMap.label}
      </a>
      {t.about.assets.mapPreviewsSuffix}
    </p>
    <h4 className="pt-1 text-sm font-semibold text-foreground">
      {t.about.assets.localData.title}
    </h4>
    <p>{t.about.assets.localData.body}</p>
    <p>
      <a
        href={t.about.assets.localData.steam.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground underline underline-offset-4"
      >
        {t.about.assets.localData.steam.label}
      </a>
      {t.about.assets.localData.steam.body}
    </p>
    <p>
      <a
        href={t.about.assets.localData.chromiumDash.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground underline underline-offset-4"
      >
        {t.about.assets.localData.chromiumDash.label}
      </a>
      {t.about.assets.localData.chromiumDash.body}
    </p>
    <p>
      {t.about.assets.localData.localeCatalog.prefix}
      <a
        href={t.about.assets.localData.localeCatalog.mozilla.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground underline underline-offset-4"
      >
        {t.about.assets.localData.localeCatalog.mozilla.label}
      </a>
      {t.about.assets.localData.localeCatalog.middle}
      <a
        href={t.about.assets.localData.localeCatalog.chromium.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground underline underline-offset-4"
      >
        {t.about.assets.localData.localeCatalog.chromium.label}
      </a>
      {t.about.assets.localData.localeCatalog.body}
    </p>
  </div>
);

const AssetsSection = () => {
  const { highlightedAnchorId, navigateToAnchor } = useSettings();
  return (
    <>
      <Separator />
      <div
        id={SECTION_ANCHORS.about.assets}
        data-anchor-id={SECTION_ANCHORS.about.assets}
        className={cn(
          "gw-anchor-target scroll-mt-7",
          highlightedAnchorId === SECTION_ANCHORS.about.assets &&
            "gw-anchor-highlighted",
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <AnchorHeading
            anchorId={SECTION_ANCHORS.about.assets}
            label={t.common.copyLinkTo(t.about.copyLinkAssetsLabel)}
          >
            <h3 className="text-base font-semibold">{t.about.assets.title}</h3>
          </AnchorHeading>
          <Button
            variant="secondary"
            className="w-fit shrink-0 self-start"
            onClick={() =>
              navigateToAnchor(SETTINGS_SUBPAGE_ANCHORS.thirdPartyNotices, {
                highlight: false,
              })
            }
          >
            {t.about.assets.openNoticesButton}
          </Button>
        </div>
        <AssetParagraphs />
      </div>
    </>
  );
};

const AboutSidebar = () => {
  const { highlightedAnchorId, navigateToAnchor } = useSettings();
  return (
    <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.about.playground.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {t.about.playground.description}
          </p>
          <Button
            className="w-fit self-center"
            onClick={() =>
              navigateToAnchor(PAGE_ANCHORS.playground, { highlight: false })
            }
          >
            {icon("fa-rocket")}
            {t.about.playground.openButton}
          </Button>
        </CardContent>
      </Card>
      <SettingsHelpCard
        anchorId={SECTION_ANCHORS.about.usage}
        copyLabel={t.common.copyLinkTo(t.about.copyLinkUsageLabel)}
        title={t.about.usage.title}
        highlighted={highlightedAnchorId === SECTION_ANCHORS.about.usage}
      >
        <ul className="list-disc space-y-3 pl-5 marker:text-tone-info-text">
          <li>{t.about.usage.body1}</li>
          <li>{t.about.usage.body2}</li>
          <li>{t.about.usage.body3}</li>
          <li>{t.about.usage.body4}</li>
        </ul>
      </SettingsHelpCard>
    </div>
  );
};

const AboutOverview = () => {
  const { highlightedAnchorId } = useSettings();
  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-12 lg:col-span-8">
        <Card
          id={SECTION_ANCHORS.about.overview}
          data-anchor-id={SECTION_ANCHORS.about.overview}
          className={cn(
            "gw-anchor-target scroll-mt-7",
            highlightedAnchorId === SECTION_ANCHORS.about.overview &&
              "gw-anchor-highlighted",
          )}
        >
          <CardContent className="pt-6 flex flex-col gap-6">
            <AboutIntro />
            <Limitations />
            <BuildMetadata />
            <TermsSection />
            <PolicySections />
            <AssetsSection />
          </CardContent>
        </Card>
      </div>
      <AboutSidebar />
    </div>
  );
};

export const AboutTab = () => {
  const { settingsSubpageView } = useSettings();
  const subpage = renderAboutSubpage(settingsSubpageView);
  return (
    <TabsContent value="about" data-panel="about" id={PAGE_ANCHORS.about}>
      {subpage ?? <AboutOverview />}
    </TabsContent>
  );
};
