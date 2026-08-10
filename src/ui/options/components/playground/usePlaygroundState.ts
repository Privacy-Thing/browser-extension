import { useCallback, useEffect, useMemo, useState } from "react";

import type { GeoReading, SystemGeoStatus } from "./PlaygroundComparisonCards";

import { toRuntimeSnapshot } from "@/background/rules/resolver";
import { installGeolocationPatch } from "@/injection/main/early-runtime";
import {
  type BrowserFingerprintSource,
  deriveAppVersion,
} from "@/shared/browser-fingerprint";
import { createRuleSeedKey, readRuleSeedKey } from "@/shared/rule-seed";
import type { CapturedFingerprint } from "@/shared/types";
import { type LocalFingerprintState } from "@/ui/options/components/playground/fingerprint-comparison";
import {
  createSpoofedRuntime,
  getSystemValues,
  type SpoofedRuntime,
} from "@/ui/options/components/playground/snapshot-sim";
import { PAGE_ANCHORS } from "@/ui/options/navigation";
import { useSettings } from "@/ui/options/state/SettingsContext";
import { collectFingerprint } from "@/ui/shared/fingerprint-collector";

export type TracePoint = { latitude: number; longitude: number; accuracy: number };

const appendTracePoint = (
  current: TracePoint[],
  nextPoint: TracePoint,
): TracePoint[] => {
  const lastPoint = current[current.length - 1];
  if (
    lastPoint &&
    lastPoint.latitude === nextPoint.latitude &&
    lastPoint.longitude === nextPoint.longitude &&
    lastPoint.accuracy === nextPoint.accuracy
  ) {
    return current;
  }

  return [...current, nextPoint];
};

export type EffectiveTimingSummary = {
  runtimeIntervalSeconds: [number, number];
  liveSiteIntervalSeconds: [number, number];
  watchDelaySeconds: [number, number];
  callbackDelayMs: [number, number];
};

type MemoryNavigator = Navigator & { deviceMemory?: number };
type NavigatorWithClientHints = MemoryNavigator & {
  userAgentData?: {
    brands?: readonly { brand: string; version: string }[];
    mobile?: boolean;
    platform?: string;
    fullVersionList?: readonly { brand: string; version: string }[];
  };
};

const sanitizePreviewSeedInput = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 6);

const nativeGetCurrentPosition:
  | ((
      success: PositionCallback,
      error?: PositionErrorCallback | null,
      options?: PositionOptions,
    ) => void)
  | null =
  typeof navigator !== "undefined" && "geolocation" in navigator
    ? navigator.geolocation.getCurrentPosition.bind(navigator.geolocation)
    : null;

const GEO_DESCRIPTOR_KEYS = [
  "getCurrentPosition",
  "watchPosition",
  "clearWatch",
] as const;

type DescriptorBackup = {
  target: object;
  descriptors: Array<{
    key: (typeof GEO_DESCRIPTOR_KEYS)[number];
    descriptor: PropertyDescriptor | undefined;
  }>;
};

const captureGeoDescriptors = (): DescriptorBackup[] => {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return [];
  }

  const nativeGeolocation = navigator.geolocation;
  const geolocationTarget =
    typeof Geolocation !== "undefined" ? Geolocation.prototype : nativeGeolocation;
  const targets =
    geolocationTarget === nativeGeolocation
      ? [nativeGeolocation]
      : [geolocationTarget, nativeGeolocation];

  return targets.map((target) => ({
    target,
    descriptors: GEO_DESCRIPTOR_KEYS.map((key) => ({
      key,
      descriptor: Object.getOwnPropertyDescriptor(target, key),
    })),
  }));
};

const restoreGeoDescriptors = (backups: readonly DescriptorBackup[]): void => {
  for (const backup of backups) {
    for (const { key, descriptor } of backup.descriptors) {
      if (descriptor) {
        Object.defineProperty(backup.target, key, descriptor);
      } else {
        Reflect.deleteProperty(backup.target, key);
      }
    }
  }
};

const useFingerprintSource = () => {
  const [captured, setCaptured] = useState<CapturedFingerprint | null>(null);
  useEffect(() => {
    let active = true;
    collectFingerprint()
      .then((fingerprint) => {
        if (active) setCaptured(fingerprint);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  const local: LocalFingerprintState = {
    userAgent: navigator.userAgent,
    appVersion: deriveAppVersion(navigator.userAgent),
    vendor: navigator.vendor,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as MemoryNavigator).deviceMemory,
    webRTCAvailable: typeof RTCPeerConnection !== "undefined",
    capturedFingerprint: captured,
  };
  const source = useMemo<BrowserFingerprintSource>(() => {
    const browserNavigator = navigator as NavigatorWithClientHints;
    const hints = captured?.clientHints;
    const userAgentData = hints
      ? {
          ...(hints.brands ? { brands: hints.brands } : {}),
          ...(hints.fullVersionList?.length
            ? { fullVersionList: hints.fullVersionList }
            : {}),
          ...(typeof hints.mobile === "boolean" ? { mobile: hints.mobile } : {}),
          ...(typeof hints.platform === "string" ? { platform: hints.platform } : {}),
        }
      : browserNavigator.userAgentData;
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor,
      hardwareConcurrency: navigator.hardwareConcurrency,
      ...((navigator as MemoryNavigator).deviceMemory !== undefined
        ? { deviceMemory: (navigator as MemoryNavigator).deviceMemory }
        : {}),
      ...(userAgentData ? { userAgentData } : {}),
    };
  }, [captured]);
  return { localFingerprint: local, browserFingerprintSource: source };
};

const usePreviewSeed = () => {
  const [key, setKey] = useState<string>(() => createRuleSeedKey());
  const [input, setInput] = useState<string>(() => key);
  const handleChange = useCallback((value: string) => {
    const sanitized = sanitizePreviewSeedInput(value);
    setInput(sanitized);
    const resolved = readRuleSeedKey(sanitized);
    if (resolved) setKey(resolved);
  }, []);
  const randomize = useCallback(() => {
    const next = createRuleSeedKey();
    setInput(next);
    setKey(next);
  }, []);
  return { handleChange, input, key, randomize };
};

const useSpoofedGeolocation = (
  snapshot: ReturnType<typeof toRuntimeSnapshot> | null,
  useDemoInterval: boolean,
) => {
  const [tracePoints, setTracePoints] = useState<TracePoint[]>([]);
  const [spoofedGeo, setSpoofedGeo] = useState<GeoReading | null>(null);
  useEffect(() => {
    if (
      !snapshot ||
      typeof navigator === "undefined" ||
      !("geolocation" in navigator)
    ) {
      setSpoofedGeo(null);
      return;
    }
    const demoSnapshot = {
      ...snapshot,
      watchPositionDelay: useDemoInterval
        ? ([2, 5] as [number, number])
        : snapshot.watchPositionDelay,
    };
    const backups = captureGeoDescriptors();
    installGeolocationPatch(demoSnapshot);
    const geo = navigator.geolocation;
    const watchId = geo.watchPosition(
      (position) => {
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };
        setSpoofedGeo(next);
        setTracePoints((current) =>
          appendTracePoint(current, {
            latitude: next.latitude,
            longitude: next.longitude,
            accuracy: next.accuracy,
          }),
        );
      },
      null,
      { enableHighAccuracy: true },
    );
    return () => {
      geo.clearWatch(watchId);
      restoreGeoDescriptors(backups);
    };
  }, [snapshot, useDemoInterval]);
  return { setSpoofedGeo, setTracePoints, spoofedGeo, tracePoints };
};

const useSystemGeolocation = () => {
  const [status, setStatus] = useState<SystemGeoStatus>("idle");
  const [reading, setReading] = useState<GeoReading | null>(null);
  const request = useCallback(() => {
    if (!nativeGetCurrentPosition) {
      setStatus("unavailable");
      return;
    }
    setStatus("loading");
    nativeGetCurrentPosition(
      (position) => {
        setReading({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
        setStatus("granted");
      },
      () => setStatus("denied"),
      { enableHighAccuracy: true },
    );
  }, []);
  return {
    handleRequestSystemGeo: request,
    systemGeo: reading,
    systemGeoStatus: status,
  };
};

type PlaygroundLocation = ReturnType<typeof useSettings>["profiles"][number];

const usePlaygroundDerived = ({
  selectedLocation,
  snapshot,
  tracePoints,
  useDemoInterval,
}: {
  selectedLocation: PlaygroundLocation | null;
  snapshot: ReturnType<typeof toRuntimeSnapshot> | null;
  tracePoints: TracePoint[];
  useDemoInterval: boolean;
}) => {
  const effectiveTimingSummary = useMemo<EffectiveTimingSummary | null>(() => {
    if (!selectedLocation || !snapshot) return null;
    const watchDelaySeconds = snapshot.watchPositionDelay;
    return {
      runtimeIntervalSeconds: useDemoInterval ? [2, 5] : watchDelaySeconds,
      liveSiteIntervalSeconds: watchDelaySeconds,
      watchDelaySeconds,
      callbackDelayMs: [10, 50],
    };
  }, [selectedLocation, snapshot, useDemoInterval]);
  const mapDraft = useMemo(() => {
    const last = tracePoints[tracePoints.length - 1];
    if (last) return { latitude: last.latitude, longitude: last.longitude };
    if (selectedLocation) {
      return {
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
      };
    }
    return { latitude: 20, longitude: 0 };
  }, [tracePoints, selectedLocation]);
  const mapRadius = useMemo(() => {
    const last = tracePoints[tracePoints.length - 1];
    return last?.accuracy ?? selectedLocation?.accuracy ?? 0;
  }, [tracePoints, selectedLocation]);
  return { effectiveTimingSummary, mapDraft, mapRadius };
};

export const usePlaygroundState = () => {
  const {
    settingsLoaded,
    profiles,
    debugMode,
    watchPositionDelay,
    osmConsent,
    browserFingerprintSpoofingEnabled: isFingerprintSpoofingOn,
    sharedSpoofing,
    navigateToAnchor,
    openOsmDialog,
  } = useSettings();
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [useDemoInterval, setUseDemoInterval] = useState(true);
  const systemValues = getSystemValues();
  const { localFingerprint, browserFingerprintSource } = useFingerprintSource();
  const previewSeed = usePreviewSeed();

  const selectedLocation = useMemo(
    () => profiles.find((location) => location.id === selectedLocationId) ?? null,
    [profiles, selectedLocationId],
  );

  const snapshot = useMemo(() => {
    if (!selectedLocation) return null;

    return toRuntimeSnapshot({
      // The playground has no real rule or container identity, so it carries no
      // authKey and keeps the resolver's historical `native` SharedWorker mode.
      authKey: undefined,
      browserFingerprintSource,
      fingerprintEnabled: isFingerprintSpoofingOn,
      debugMode,
      profile: selectedLocation,
      ruleOverrides: undefined,
      // Seed-only fingerprint spoofing still needs an explicit stable seed to
      // show the active runtime surfaces instead of falling back to N/A.
      ruleSeedKey: previewSeed.key,
      sharedSpoofing,
      sharedWorkerHandlingMode: "native",
      watchPositionDelay,
    });
  }, [
    selectedLocation,
    debugMode,
    watchPositionDelay,
    isFingerprintSpoofingOn,
    sharedSpoofing,
    browserFingerprintSource,
    previewSeed.key,
  ]);

  const runtime = useMemo<SpoofedRuntime | null>(
    () => (snapshot ? createSpoofedRuntime(snapshot) : null),
    [snapshot],
  );
  const { setSpoofedGeo, setTracePoints, spoofedGeo, tracePoints } =
    useSpoofedGeolocation(snapshot, useDemoInterval);
  const { handleRequestSystemGeo, systemGeo, systemGeoStatus } = useSystemGeolocation();

  const { effectiveTimingSummary, mapDraft, mapRadius } = usePlaygroundDerived({
    selectedLocation,
    snapshot,
    tracePoints,
    useDemoInterval,
  });

  useEffect(() => {
    if (selectedLocationId && !selectedLocation) {
      setSelectedLocationId(null);
      setTracePoints([]);
    }
  }, [selectedLocationId, selectedLocation, setTracePoints]);

  const handleSelectLocation = useCallback(
    (locationId: string | null): void => {
      setSelectedLocationId(locationId);
      setSpoofedGeo(null);
      if (!locationId) {
        setTracePoints([]);
        return;
      }

      const location = profiles.find((profile) => profile.id === locationId);
      if (!location) {
        setTracePoints([]);
        return;
      }

      setTracePoints([
        {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
        },
      ]);
    },
    [profiles, setSpoofedGeo, setTracePoints],
  );

  return {
    loaded: settingsLoaded,
    locations: profiles,
    selectedLocation,
    selectedLocationId,
    tracePoints,
    useDemoInterval,
    systemValues,
    localFingerprint,
    runtime,
    snapshot,
    spoofedGeo,
    systemGeoStatus,
    systemGeo,
    effectiveTimingSummary,
    mapDraft,
    mapRadius,
    previewSeedInput: previewSeed.input,
    watchPositionDelay,
    osmConsent,
    hasNativeGeolocation: Boolean(nativeGetCurrentPosition),
    handleSelectLocation,
    handleClearTrace: () => setTracePoints([]),
    handlePreviewSeedChange: previewSeed.handleChange,
    randomizePreviewSeed: previewSeed.randomize,
    handleRequestSystemGeo,
    setUseDemoInterval,
    requestOsmConsent: () => openOsmDialog({ type: "generator" }),
    openSettings: () => navigateToAnchor(PAGE_ANCHORS.profiles, { highlight: false }),
  };
};
