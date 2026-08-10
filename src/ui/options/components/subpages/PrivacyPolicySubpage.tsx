import "@/ui/options/components/subpages/privacy-policy-content.css";

import { useEffect, useMemo, useRef } from "react";

import privacyPolicyMarkdown from "../../../../../PRIVACY.md?raw";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import {
  applyPrivacyPolicySemantics,
  renderPrivacyPolicyMarkdown,
} from "@/ui/options/components/subpages/privacy-policy-render";
import { PAGE_ANCHORS, SETTINGS_SUBPAGE_ANCHORS } from "@/ui/options/navigation";
import { AppSubpageHeader } from "@/ui/shared/AppSubpageHeader";

export const PrivacyPolicySubpage = () => {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const renderedMarkup = useMemo(
    () => renderPrivacyPolicyMarkdown(privacyPolicyMarkdown),
    [],
  );

  useEffect(() => {
    pageRef.current?.scrollIntoView({ block: "start", inline: "nearest" });
  }, []);

  useEffect(() => {
    if (!rootRef.current) {
      return;
    }

    applyPrivacyPolicySemantics(rootRef.current);
  }, []);

  return (
    <div
      id={SETTINGS_SUBPAGE_ANCHORS.privacyPolicy}
      ref={pageRef}
      className="flex flex-col gap-6"
    >
      <AppSubpageHeader
        title="Privacy Policy"
        lead={`How ${BRAND_DISPLAY_NAME} handles settings, diagnostics, and network requests.`}
        backLabel="Back"
        backAriaLabel="Back"
        backIconOnly
        backHref={`#${PAGE_ANCHORS.about}`}
      />

      <div className="mx-auto w-full max-w-[920px]">
        <article
          ref={rootRef}
          className="gw-policy-doc"
          dangerouslySetInnerHTML={{ __html: renderedMarkup }}
        />
      </div>
    </div>
  );
};
