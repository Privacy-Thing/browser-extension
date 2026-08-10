import React from "react";

import type { ProfileDraftMapProps } from "./ProfileDraftMap";

import { t } from "@/ui/i18n";

const ProfileDraftMap = React.lazy(async () => {
  const module = await import("./ProfileDraftMap");
  return { default: module.ProfileDraftMap };
});

const MapFrame = ({
  children,
  busy = false,
}: {
  children: React.ReactNode;
  busy?: boolean;
}) => (
  <div
    id="profile-generator-map"
    className="profile-generator-map gw-map-placeholder"
    aria-busy={busy}
  >
    {children}
  </div>
);

const defaultLoadingFallback = (
  <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-muted-foreground">
    <span
      aria-hidden="true"
      className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary"
    />
    <p className="text-sm font-medium">{t.popup.loading}</p>
  </div>
);

export type LazyProfileDraftMapProps = ProfileDraftMapProps & {
  loadWhen?: boolean;
  loadingFallback?: React.ReactNode;
};

export const LazyProfileDraftMap = ({
  enabled = true,
  placeholder = null,
  loadWhen = true,
  loadingFallback = defaultLoadingFallback,
  ...props
}: LazyProfileDraftMapProps) => {
  if (!enabled) {
    return <MapFrame>{placeholder}</MapFrame>;
  }

  if (!loadWhen) {
    return <MapFrame busy>{loadingFallback}</MapFrame>;
  }

  return (
    <React.Suspense fallback={<MapFrame busy>{loadingFallback}</MapFrame>}>
      <ProfileDraftMap {...props} enabled={enabled} placeholder={placeholder} />
    </React.Suspense>
  );
};
