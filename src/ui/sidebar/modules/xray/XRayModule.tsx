import { useEffect, useMemo, useRef, useState } from "react";

import type { SidebarModuleContext } from "../types";

import { createInspectorApi } from "./inspector/inspector-api";
import { useXRayInspector } from "./inspector/useXRayInspector";
import { XRayAccessAccordion, type XRayInspectorBinding } from "./XRayAccessAccordion";
import { XRayDiagnosticReport } from "./XRayDiagnosticReport";
import { XRaySurfacesSection } from "./XRaySurfacesSection";
import { XRayWhySection } from "./XRayWhySection";

import { BUILD_BROWSER_TARGET, BUILD_CHANNEL } from "@/shared/build-flags";
import { t } from "@/ui/i18n";
import { SidebarStatusBox } from "@/ui/sidebar/SidebarStatusBox";

// Inspector traps are an analyst tool; release builds keep X-Ray unchanged.
const INSPECTOR_ENABLED = BUILD_CHANNEL !== "release";

const XRayStateDetails = ({
  xRayState: state,
  xRayLoading: loading,
  xRaySurfaceSyncPending: surfaceSyncPending,
  locationId,
  onOpenLocation,
  inspector,
}: SidebarModuleContext & { inspector: XRayInspectorBinding | undefined }) => {
  if (loading && !state) {
    return (
      <SidebarStatusBox>
        <i
          className="fa-solid fa-circle-notch fa-spin text-muted-foreground text-3xl"
          aria-hidden="true"
        />
        <p className="text-xs text-muted-foreground">{t.sidebar.loading}</p>
      </SidebarStatusBox>
    );
  }

  if (!state) {
    return null;
  }

  if (!state.ok) {
    return (
      <SidebarStatusBox tone="error">
        <i
          className="fa-solid fa-triangle-exclamation text-[hsl(var(--tone-error-text))] text-3xl"
          aria-hidden="true"
        />
        <p className="text-xs text-[hsl(var(--tone-error-text))] font-medium">
          {t.sidebar.errorPrefix}
        </p>
        <p className="text-xs text-[hsl(var(--tone-error-text))]/80">{state.error}</p>
      </SidebarStatusBox>
    );
  }

  if (!state.hostname) {
    return (
      <SidebarStatusBox>
        <i
          className="fa-solid fa-compass text-muted-foreground text-3xl"
          aria-hidden="true"
        />
        <p className="text-xs text-muted-foreground">{t.sidebar.unsupportedTab}</p>
      </SidebarStatusBox>
    );
  }

  if (!state.snapshot) {
    const isTrustedSite = state.explanation?.winningSource === "trusted-site";

    if (isTrustedSite) {
      return (
        <SidebarStatusBox>
          <i
            className="fa-solid fa-shield-check text-muted-foreground text-3xl"
            aria-hidden="true"
          />
          <p className="text-xs text-muted-foreground font-medium">
            {t.sidebar.trustedSite}
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            {t.sidebar.trustedSiteHint}
          </p>
        </SidebarStatusBox>
      );
    }

    return (
      <SidebarStatusBox>
        <i
          className="fa-solid fa-shield-slash text-muted-foreground text-3xl"
          aria-hidden="true"
        />
        <p className="text-xs text-muted-foreground">{t.sidebar.noSpoofing}</p>
      </SidebarStatusBox>
    );
  }

  const { snapshot, assessments, explanation, displayedProfileLabel } = state;

  return (
    <div className="flex flex-col gap-6">
      <XRayAccessAccordion
        assessments={assessments}
        surfaceSyncPending={surfaceSyncPending}
        {...(inspector ? { inspector } : {})}
      />
      <XRaySurfacesSection
        snapshot={snapshot}
        {...(state.sharedWorkerStatus
          ? { sharedWorkerStatus: state.sharedWorkerStatus }
          : {})}
        displayedProfileLabel={displayedProfileLabel}
        locationId={locationId}
        {...(onOpenLocation ? { onOpenLocation } : {})}
      />
      {explanation ? (
        <XRayWhySection explanation={explanation} />
      ) : (
        <p className="text-xs text-muted-foreground">{t.sidebar.why.noExplanation}</p>
      )}
    </div>
  );
};

/** Bumps whenever an X-Ray refresh completes, e.g. after a navigation or reload. */
const useRefreshKey = (loading: boolean): number => {
  const [key, setKey] = useState(0);
  const wasLoading = useRef(loading);
  useEffect(() => {
    if (wasLoading.current && !loading) setKey((current) => current + 1);
    wasLoading.current = loading;
  }, [loading]);
  return key;
};

export const XRayModule = (context: SidebarModuleContext) => {
  const { xRayInspectorApi } = context;
  const api = useMemo(
    () => xRayInspectorApi ?? createInspectorApi(),
    [xRayInspectorApi],
  );
  // Inspector mode is sidebar UI state; arming itself lives in the background.
  // Both stay here so a reload that briefly unmounts the details keeps them.
  const [inspectorActive, setInspectorActive] = useState(false);
  const controller = useXRayInspector({
    api,
    tabId: INSPECTOR_ENABLED ? context.tabId : undefined,
    refreshKey: useRefreshKey(context.xRayLoading),
  });
  const inspector: XRayInspectorBinding | undefined = INSPECTOR_ENABLED
    ? {
        active: inspectorActive,
        onActiveChange: setInspectorActive,
        controller,
        showFirefoxHint: (context.browserTarget ?? BUILD_BROWSER_TARGET) === "firefox",
      }
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <XRayDiagnosticReport
        state={context.xRayState}
        collectionPending={context.xRayLoading || context.xRaySurfaceSyncPending}
      />
      <XRayStateDetails {...context} inspector={inspector} />
    </div>
  );
};
