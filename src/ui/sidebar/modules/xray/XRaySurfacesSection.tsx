import { isFpSurfaceEnabled } from "@privacy-brand/refract-core";
import type { SharedWorkerStatus } from "@privacy-brand/xray-protocol";
import { useState } from "react";

import {
  XRayExpandableGroupRow,
  XRayExpandableValueRow,
  XRayStatusDot,
  XRayValueRow,
} from "./XRayRows";

import type {
  BrowserClientHints,
  BrowserFingerprint,
} from "@/shared/fingerprint-types";
import { getTimeZoneOffsetMinutes } from "@/shared/time-zone-offset";
import type { RuntimeSnapshot } from "@/shared/types";
import { Button } from "@/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/components/ui/tooltip";
import { t } from "@/ui/i18n";
import { getLocationModalAnchor } from "@/ui/options/navigation";

const OffRow = ({ label }: { label: string }) => (
  <XRayValueRow label={label} value={t.sidebar.surfaces.off} />
);

const ChLabel = ({ suffix }: { suffix: string }) => (
  <TooltipProvider delayDuration={300}>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-default">
          <span className="underline decoration-dotted decoration-muted-foreground/50 underline-offset-2">
            CH
          </span>{" "}
          {suffix}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">Client Hints</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const SharedWorkerLabel = () => (
  <TooltipProvider delayDuration={300}>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-default underline decoration-dotted decoration-muted-foreground/50 underline-offset-2">
          {t.sidebar.surfaces.sharedWorker}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        {t.sidebar.surfaces.sharedWorkerCompatibilityHelp}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const getDefaultWorkerStatus = (
  mode: "native" | "spoof" | "strict",
): SharedWorkerStatus => {
  if (mode === "native") {
    return "native-compatibility";
  }
  if (mode === "strict") {
    return "blocked-strict";
  }
  return "blob-wrapper-dedup-disabled";
};

const formatTimeZoneOffset = (timeZone: string): string => {
  const totalMin = -getTimeZoneOffsetMinutes(timeZone, Date.now());
  const sign = totalMin >= 0 ? "+" : "-";
  const abs = Math.abs(totalMin);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const NoiseDot = ({ active, label }: { active: boolean; label: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <XRayStatusDot
        className={active ? "bg-green-500" : "bg-red-500/60"}
        label={label}
      />
    </TooltipTrigger>
    <TooltipContent side="top">{label}</TooltipContent>
  </Tooltip>
);

const NoiseGroupRow = ({
  canvas,
  audio,
  gpu,
}: {
  canvas: boolean;
  audio: boolean;
  gpu: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <div className="py-1 border-b border-border/30">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground shrink-0">
            {t.sidebar.surfaces.noise}
          </span>
          <div className="flex items-center gap-1.5">
            <TooltipProvider delayDuration={300}>
              <NoiseDot active={canvas} label={t.sidebar.surfaces.canvas} />
              <NoiseDot active={audio} label={t.sidebar.surfaces.audio} />
              <NoiseDot active={gpu} label={t.sidebar.surfaces.gpu} />
            </TooltipProvider>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-label={
                expanded ? t.sidebar.surfaces.collapse : t.sidebar.surfaces.expand
              }
              className="ml-0.5 flex items-center cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
            >
              <i
                className={`fa-solid ${expanded ? "fa-chevron-up" : "fa-chevron-down"} text-[9px]`}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </div>
      {expanded && (
        <>
          <XRayValueRow
            label={t.sidebar.surfaces.canvas}
            value={canvas ? t.sidebar.surfaces.yes : t.sidebar.surfaces.off}
          />
          <XRayValueRow
            label={t.sidebar.surfaces.audio}
            value={audio ? t.sidebar.surfaces.yes : t.sidebar.surfaces.off}
          />
          <XRayValueRow
            label={t.sidebar.surfaces.gpu}
            value={gpu ? t.sidebar.surfaces.yes : t.sidebar.surfaces.off}
          />
        </>
      )}
    </>
  );
};

const ChSection = ({
  ch,
  brands,
}: {
  ch: BrowserClientHints | undefined;
  brands: string | undefined;
}) => {
  if (brands) {
    return (
      <XRayExpandableGroupRow
        label={<ChLabel suffix={t.sidebar.surfaces.clientHintsBrands} />}
        value={brands}
      >
        {ch?.platform ? (
          <XRayValueRow
            label={<ChLabel suffix={t.sidebar.surfaces.clientHintsPlatform} />}
            value={ch.platform}
          />
        ) : null}
      </XRayExpandableGroupRow>
    );
  }
  if (ch?.platform) {
    return (
      <XRayValueRow
        label={<ChLabel suffix={t.sidebar.surfaces.clientHintsPlatform} />}
        value={ch.platform}
      />
    );
  }
  return null;
};

// Hide values for surfaces whose per-surface spoofing toggle is off — otherwise
// XRay would print would-be spoofed values that the runtime deliberately does
// NOT inject (the page keeps its native values). The fingerprint XRay
// categories map 1:1 to the spoofing-surface keys, so the checks are direct.
const formatCpuRam = (fp: BrowserFingerprint, enabled: boolean): string | undefined => {
  if (!enabled) {
    return undefined;
  }
  return (
    [
      fp.hardwareConcurrency !== undefined ? String(fp.hardwareConcurrency) : null,
      fp.deviceMemory !== undefined
        ? `${fp.deviceMemory} ${t.sidebar.surfaces.GB}`
        : null,
    ]
      .filter(Boolean)
      .join(" / ") || undefined
  );
};

const formatScreenSize = (
  fp: BrowserFingerprint,
  enabled: boolean,
): string | undefined => {
  if (!enabled || !fp.screen?.width || !fp.screen.height) {
    return undefined;
  }
  return `${fp.screen.width}×${fp.screen.height}`;
};

const deriveFingerprintDisplay = (fp: BrowserFingerprint) => {
  const navigatorOn = isFpSurfaceEnabled(fp, "navigator");
  const screenOn = isFpSurfaceEnabled(fp, "screen");
  const webGLOn = isFpSurfaceEnabled(fp, "webGL");
  const ch = isFpSurfaceEnabled(fp, "clientHints") ? fp.clientHints : undefined;

  return {
    platform: navigatorOn ? fp.platform : undefined,
    userAgent: navigatorOn ? fp.userAgent : undefined,
    cpuRam: formatCpuRam(fp, navigatorOn),
    screenStr: formatScreenSize(fp, screenOn),
    gpuDebugBlocked: Boolean(webGLOn && fp.webGL?.suppressDebugInfo),
    canvasNoise: isFpSurfaceEnabled(fp, "canvas") && fp.canvasNoiseSeed !== undefined,
    audioNoise: isFpSurfaceEnabled(fp, "audio") && fp.audioNoiseSeed !== undefined,
    gpuNoise: Boolean(webGLOn && fp.webGL?.readPixelsNoiseSeed !== undefined),
    ch,
    brands: ch?.brands?.map((b) => `${b.brand} ${b.version}`).join(", "),
  };
};

const FingerprintRows = ({ fp }: { fp: BrowserFingerprint }) => {
  const d = deriveFingerprintDisplay(fp);

  return (
    <>
      {d.platform ? (
        <XRayValueRow label={t.sidebar.surfaces.platform} value={d.platform} />
      ) : null}
      {d.cpuRam ? (
        <XRayValueRow label={t.sidebar.surfaces.cpuRam} value={d.cpuRam} />
      ) : null}
      {d.screenStr ? (
        <XRayValueRow label={t.sidebar.surfaces.screen} value={d.screenStr} />
      ) : null}
      <NoiseGroupRow canvas={d.canvasNoise} audio={d.audioNoise} gpu={d.gpuNoise} />
      {d.gpuDebugBlocked ? (
        <XRayValueRow
          label={t.sidebar.surfaces.gpuDebug}
          value={t.sidebar.surfaces.blocked}
        />
      ) : null}
      <ChSection ch={d.ch} brands={d.brands} />
      {d.userAgent ? (
        <XRayExpandableValueRow
          label={t.sidebar.surfaces.userAgent}
          value={d.userAgent}
        />
      ) : null}
    </>
  );
};

const openOptionsAnchor = async (anchorId: string): Promise<void> => {
  await chrome.tabs.create({
    url: chrome.runtime.getURL(`src/ui/options/index.html#${anchorId}`),
  });
};

const SHARED_WORKER_LABELS: Record<SharedWorkerStatus, string> = {
  "native-compatibility": t.sidebar.surfaces.sharedWorkerNativeCompatibility,
  "blob-wrapper-dedup-disabled": t.sidebar.surfaces.sharedWorkerBlobSpoofing,
  "response-rewrite-preserved-identity":
    t.sidebar.surfaces.sharedWorkerResponseRewriteSpoofing,
  "response-rewrite-cache-sensitive":
    t.sidebar.surfaces.sharedWorkerResponseRewriteCacheSensitive,
  "module-rewrite-unsupported": t.sidebar.surfaces.sharedWorkerModuleUnsupported,
  "identity-conflict": t.sidebar.surfaces.sharedWorkerIdentityConflict,
  "response-rewrite-unavailable": t.sidebar.surfaces.sharedWorkerRewriteUnavailable,
  "blocked-strict": t.sidebar.surfaces.sharedWorkerBlockedStrict,
  "strict-rewrite-required": t.sidebar.surfaces.sharedWorkerStrictRewriteRequired,
  "strict-blocked-cache-sensitive":
    t.sidebar.surfaces.sharedWorkerStrictBlockedCacheSensitive,
};

const ProfileRow = ({
  label,
  locationId,
  onOpenLocation,
}: {
  label: string;
  locationId: string | null;
  onOpenLocation: ((locationId: string) => void) | undefined;
}) => (
  <div className="flex justify-between items-center gap-2 py-1 border-b border-border/30">
    <span className="text-xs text-muted-foreground shrink-0">{t.sidebar.region}</span>
    <div className="flex items-center gap-1 min-w-0">
      <span className="text-xs font-mono text-right truncate max-w-[140px]">
        {label}
      </span>
      {locationId ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0"
          onClick={() => {
            if (onOpenLocation) {
              onOpenLocation(locationId);
              return;
            }
            void openOptionsAnchor(getLocationModalAnchor(locationId));
          }}
          title={t.sidebar.openLocation}
        >
          <i
            className="fa-solid fa-arrow-up-right-from-square text-[9px]"
            aria-hidden="true"
          />
          <span className="sr-only">{t.sidebar.openLocation}</span>
        </Button>
      ) : null}
    </div>
  </div>
);

export const XRaySurfacesSection = ({
  snapshot,
  sharedWorkerStatus,
  displayedProfileLabel,
  locationId,
  onOpenLocation,
}: {
  snapshot: RuntimeSnapshot;
  sharedWorkerStatus?: SharedWorkerStatus;
  displayedProfileLabel: string | null;
  locationId: string | null;
  onOpenLocation?: (locationId: string) => void;
}) => {
  const geoOn = snapshot.geolocationEnabled !== false;
  const timeLocaleOn = snapshot.timeLocaleEnabled !== false;
  const sharedWorkerHandlingMode =
    snapshot.sharedWorkerHandlingMode ??
    (snapshot.sharedWorkerCompatibilityMode === false ? "spoof" : "native");
  const resolvedWorkerStatus =
    sharedWorkerStatus ?? getDefaultWorkerStatus(sharedWorkerHandlingMode);
  const fp = snapshot.fingerprint;

  return (
    <section className="flex flex-col gap-0" data-xray-section="spoofing-snapshot">
      <h3 className="text-xs font-semibold uppercase tracking-wide mb-2">
        {t.sidebar.surfaces.title}
      </h3>

      <XRayValueRow
        label={<SharedWorkerLabel />}
        value={SHARED_WORKER_LABELS[resolvedWorkerStatus]}
      />

      {displayedProfileLabel ? (
        <ProfileRow
          label={displayedProfileLabel}
          locationId={locationId}
          onOpenLocation={onOpenLocation}
        />
      ) : null}

      {timeLocaleOn ? (
        <>
          <XRayValueRow
            label={t.sidebar.surfaces.timezone}
            value={`${snapshot.locale.timeZone} (${formatTimeZoneOffset(snapshot.locale.timeZone)})`}
          />
          <XRayExpandableGroupRow
            label={t.sidebar.surfaces.language}
            value={snapshot.locale.language}
          >
            <XRayValueRow
              label={t.sidebar.surfaces.languages}
              value={snapshot.locale.languages.join(", ")}
            />
            <XRayValueRow
              label={t.sidebar.surfaces.acceptLanguage}
              value={snapshot.locale.acceptLanguage}
            />
          </XRayExpandableGroupRow>
        </>
      ) : (
        <OffRow label={t.sidebar.surfaces.timezone} />
      )}

      {geoOn ? (
        <>
          <XRayValueRow
            label={t.sidebar.surfaces.geolocation}
            value={`${snapshot.geo.latitude.toFixed(5)}, ${snapshot.geo.longitude.toFixed(5)}`}
          />
          <XRayValueRow
            label={t.sidebar.surfaces.accuracyNoise}
            value={`${snapshot.geo.accuracy}${t.sidebar.surfaces.m} / ±${snapshot.geo.noiseRadius}${t.sidebar.surfaces.m}`}
          />
        </>
      ) : (
        <OffRow label={t.sidebar.surfaces.geolocation} />
      )}

      {fp ? (
        <FingerprintRows fp={fp} />
      ) : (
        <OffRow label={t.sidebar.surfaces.fingerprint} />
      )}
    </section>
  );
};
