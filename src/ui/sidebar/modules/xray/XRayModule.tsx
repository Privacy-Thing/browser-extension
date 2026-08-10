import type { SidebarModuleContext } from "../types";

import { XRayAccessAccordion } from "./XRayAccessAccordion";
import { XRaySurfacesSection } from "./XRaySurfacesSection";
import { XRayWhySection } from "./XRayWhySection";

import { t } from "@/ui/i18n";
import { SidebarStatusBox } from "@/ui/sidebar/SidebarStatusBox";

export const XRayModule = ({
  xRayState: state,
  xRayLoading: loading,
  xRaySurfaceSyncPending: surfaceSyncPending,
  locationId,
  onOpenLocation,
}: SidebarModuleContext) => {
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
