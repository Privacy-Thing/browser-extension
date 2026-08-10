import "@/ui/options/components/subpages/privacy-policy-content.css";

import { useEffect, useMemo, useRef, useState } from "react";

import thirdPartyNoticesMarkdown from "../../../../../licenses/privacything/THIRD_PARTY_NOTICES.md?raw";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { bundledLicenseTexts } from "@/ui/options/components/subpages/legal-document-assets";
import {
  applyLegalSemantics,
  renderLegalMarkdown,
} from "@/ui/options/components/subpages/legal-document-render";
import { LegalDocumentTextDialog } from "@/ui/options/components/subpages/LegalDocumentTextDialog";
import { PAGE_ANCHORS, SETTINGS_SUBPAGE_ANCHORS } from "@/ui/options/navigation";
import { AppSubpageHeader } from "@/ui/shared/AppSubpageHeader";

export const ThirdPartyNoticesSubpage = () => {
  const [activeLicensePath, setActiveLicensePath] = useState<string | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const renderedMarkup = useMemo(
    () =>
      renderLegalMarkdown(thirdPartyNoticesMarkdown, {
        renderLicenseButtons: true,
        stripReferenceDirs: true,
      }),
    [],
  );

  const activeLicenseText = activeLicensePath
    ? (bundledLicenseTexts.get(activeLicensePath) ?? null)
    : null;

  useEffect(() => {
    pageRef.current?.scrollIntoView({ block: "start", inline: "nearest" });
  }, []);

  return (
    <>
      <div
        id={SETTINGS_SUBPAGE_ANCHORS.thirdPartyNotices}
        ref={pageRef}
        className="flex flex-col gap-6"
      >
        <AppSubpageHeader
          title="Third-Party Notices"
          lead={`Review the bundled third-party components and their license texts shipped with ${BRAND_DISPLAY_NAME}.`}
          backLabel="Back"
          backAriaLabel="Back"
          backIconOnly
          backHref={`#${PAGE_ANCHORS.about}`}
        />

        <div className="mx-auto w-full max-w-[920px]">
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events -- delegated click handles in-page license expansion links injected via dangerouslySetInnerHTML; keyboard access provided by those links themselves */}
          <article
            ref={(node) => {
              if (node) {
                applyLegalSemantics(node, "third-party-notices");
              }
            }}
            className="gw-policy-doc"
            dangerouslySetInnerHTML={{ __html: renderedMarkup }}
            onClick={(event) => {
              const target = event.target as HTMLElement | null;
              const trigger = target?.closest<HTMLButtonElement>("[data-license-path]");
              const licensePath = trigger?.dataset.licensePath?.trim();

              if (!licensePath) {
                return;
              }

              setActiveLicensePath(licensePath);
            }}
          />
        </div>
      </div>

      <LegalDocumentTextDialog
        activePath={activeLicensePath}
        content={activeLicenseText}
        missingMessage={`Bundled license text not found for ${activeLicensePath}.`}
        onOpenChange={(open) => {
          if (!open) {
            setActiveLicensePath(null);
          }
        }}
      />
    </>
  );
};
