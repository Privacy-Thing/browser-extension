import "@/ui/options/components/subpages/privacy-policy-content.css";

import { useEffect, useMemo, useRef, useState } from "react";

import licenseMarkdown from "../../../../../LICENSE.md?raw";
import thirdPartyNoticesMarkdown from "../../../../../licenses/privacything/THIRD_PARTY_NOTICES.md?raw";
import noticeMarkdown from "../../../../../NOTICE.md?raw";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { bundledLicenseTexts } from "@/ui/options/components/subpages/legal-document-assets";
import {
  applyLegalSemantics,
  renderLegalMarkdown,
} from "@/ui/options/components/subpages/legal-document-render";
import { LegalDocumentTextDialog } from "@/ui/options/components/subpages/LegalDocumentTextDialog";
import { PAGE_ANCHORS, SETTINGS_SUBPAGE_ANCHORS } from "@/ui/options/navigation";
import { AppSubpageHeader } from "@/ui/shared/AppSubpageHeader";

const bundledDocumentTexts = new Map<string, string>([
  ["NOTICE.md", noticeMarkdown],
  ["licenses/privacything/NOTICE.md", noticeMarkdown],
  ["licenses/privacything/THIRD_PARTY_NOTICES.md", thirdPartyNoticesMarkdown],
]);

export const LicenseSubpage = () => {
  const [activeLicensePath, setActiveLicensePath] = useState<string | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const renderedMarkup = useMemo(
    () =>
      renderLegalMarkdown(licenseMarkdown, {
        renderLicenseButtons: true,
        stripReferenceDirs: true,
        legalReferenceHrefByPath: {
          "licenses/privacything/THIRD_PARTY_NOTICES.md": `#${SETTINGS_SUBPAGE_ANCHORS.thirdPartyNotices}`,
        },
      }),
    [],
  );

  const activeLicenseText = activeLicensePath
    ? (bundledLicenseTexts.get(activeLicensePath) ??
      bundledDocumentTexts.get(activeLicensePath) ??
      null)
    : null;

  useEffect(() => {
    pageRef.current?.scrollIntoView({ block: "start", inline: "nearest" });
  }, []);

  return (
    <>
      <div
        id={SETTINGS_SUBPAGE_ANCHORS.license}
        ref={pageRef}
        className="flex flex-col gap-6"
      >
        <AppSubpageHeader
          title="License"
          lead={`Review the public license, additional terms, and bundled license texts shipped with ${BRAND_DISPLAY_NAME}.`}
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
                applyLegalSemantics(node, "license");
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
        missingMessage={`Bundled document not found for ${activeLicensePath}.`}
        onOpenChange={(open) => {
          if (!open) {
            setActiveLicensePath(null);
          }
        }}
      />
    </>
  );
};
