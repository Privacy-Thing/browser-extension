import {
  EVIDENCE_VERSION,
  type GetXRayStateResponse,
  type RuntimeSnapshot,
  type SharedWorkerStatus,
  type XRayAccessedCategories,
  type SurfaceMethodQueryCounts,
  type SurfaceQueryCounts,
} from "@privacy-brand/xray-protocol";

import { buildSurfaceAssessments } from "@/background/surface-assessments";
import type { SurfaceEvidenceByRealm } from "@/background/surface-evidence-tracker";
import { resolveRuleSources } from "@/shared/rule-resolution";
import { explainRuleResolution } from "@/shared/rule-resolution-explanation";
import { deriveLegacyXRayActivity } from "@/shared/surface-assessments";
import type {
  ContainerAssignment,
  DomainRule,
  GlobalFallbackRule,
  Location,
  PopupEffectiveSource,
  TrustedSite,
} from "@/shared/types";

export type XRayCommandDeps = {
  isSupportedWebUrl: (url: string | undefined) => url is string;
  getExactHostname: (url: string) => string;
  getPopupTabById: (
    tabId: number | undefined,
  ) => Promise<(chrome.tabs.Tab & { cookieStoreId?: string }) | undefined>;
  readSnapshotCache: (
    tabId: number,
    frameId: number,
    hostname: string,
    cookieStoreId?: string,
  ) => RuntimeSnapshot | null | undefined;
  /** Fallback: resolve fresh snapshot when cache misses (same path as content bootstrap). */
  resolveSnapshot: (
    hostname: string,
    cookieStoreId?: string,
  ) => Promise<RuntimeSnapshot | null>;
  getLastKnownProfiles: () => Location[] | null;
  getLastKnownRules: () => DomainRule[] | null;
  getKnownContainers: () => ContainerAssignment[] | null;
  getKnownFallback: () => GlobalFallbackRule | undefined;
  getLastKnownTrustedSites: () => TrustedSite[] | null;
  getSurfaceAccess: (tabId: number) => XRayAccessedCategories;
  getSurfaceErrors: (tabId: number) => XRayAccessedCategories;
  getRealmEvidence: (tabId: number) => SurfaceEvidenceByRealm;
  getSurfaceCounts: (tabId: number) => SurfaceQueryCounts;
  getSurfaceMethodCounts: (tabId: number) => SurfaceMethodQueryCounts;
  getSharedWorkerStatus: (
    tabId: number,
    snapshot: RuntimeSnapshot | null,
  ) => SharedWorkerStatus | undefined;
  getFingerprintEnabled: () => boolean;
  resolveFallbackId: (
    profiles: Location[],
    globalFallbackRule: GlobalFallbackRule | undefined,
  ) => string | null;
};

const findProfileLabel = (
  locationId: string | null | undefined,
  profiles: readonly Location[],
): string | null => {
  if (!locationId) return null;
  return profiles.find((p) => p.id === locationId)?.label ?? null;
};

const resolveAssessmentSource = (
  source: ReturnType<typeof explainRuleResolution>["winningSource"],
): PopupEffectiveSource => {
  if (source === "rule") return "site-rule";
  if (source === "fallback") return "default-rule";
  return source;
};

export const createXRayHandlers = (deps: XRayCommandDeps) => {
  const getXRayState = async (tabId?: number): Promise<GetXRayStateResponse> => {
    try {
      const tab = await deps.getPopupTabById(tabId);
      if (!tab?.url || !deps.isSupportedWebUrl(tab.url)) {
        const assessments = buildSurfaceAssessments({
          source: "none",
          snapshot: null,
          runtimeExpected: false,
        });
        return {
          ok: true,
          hostname: null,
          snapshot: null,
          displayedProfileLabel: null,
          locationId: null,
          rulePattern: null,
          assessments,
          accessedCategories: {},
          failedCategories: {},
          explanation: null,
        };
      }

      const hostname = deps.getExactHostname(tab.url);
      const cookieStoreId = tab.cookieStoreId;
      const activeTabId = tab.id ?? tabId ?? 0;

      const cachedSnapshot = deps.readSnapshotCache(
        activeTabId,
        0,
        hostname,
        cookieStoreId,
      );
      const snapshot =
        cachedSnapshot !== undefined
          ? cachedSnapshot
          : await deps.resolveSnapshot(hostname, cookieStoreId);

      const profiles = deps.getLastKnownProfiles() ?? [];
      const rules = deps.getLastKnownRules() ?? [];
      const containerAssignments = deps.getKnownContainers() ?? [];
      const globalFallbackRule = deps.getKnownFallback();
      const trustedSites = deps.getLastKnownTrustedSites() ?? [];

      const matchedContainer = cookieStoreId
        ? (containerAssignments.find((ca) => ca.cookieStoreId === cookieStoreId) ??
          null)
        : null;

      const fallbackLocationId = deps.resolveFallbackId(profiles, globalFallbackRule);

      const resolved = resolveRuleSources({
        hostname,
        cookieStoreId,
        rules,
        containerAssignments: matchedContainer ? [matchedContainer] : [],
        globalFallbackRule,
        trustedSites,
      });

      const explanation = explainRuleResolution({
        hostname,
        resolved,
        rules,
        globalFallbackRule,
        trustedSites,
        fallbackLocationId,
        fingerprintEnabled: deps.getFingerprintEnabled(),
      });

      const effectiveLocationId =
        resolved.effectiveLocationId ?? fallbackLocationId ?? null;
      const displayedProfileLabel = findProfileLabel(effectiveLocationId, profiles);
      const rulePattern = resolved.activeRule?.pattern ?? null;

      const assessments = buildSurfaceAssessments({
        source: resolveAssessmentSource(explanation.winningSource),
        snapshot,
        runtimeExpected:
          explanation.winningSource !== "trusted-site" &&
          explanation.winningSource !== "none",
        accessedCategories: deps.getSurfaceAccess(activeTabId),
        failedCategories: deps.getSurfaceErrors(activeTabId),
        evidenceByRealm: deps.getRealmEvidence(activeTabId),
        queryCounts: deps.getSurfaceCounts(activeTabId),
        methodCounts: deps.getSurfaceMethodCounts(activeTabId),
      });
      const { accessedCategories, failedCategories, queryCounts, methodCounts } =
        deriveLegacyXRayActivity(assessments);
      const sharedWorkerStatus = deps.getSharedWorkerStatus(activeTabId, snapshot);
      const hasQueryCounts = Object.keys(queryCounts).length > 0;
      const hasMethodCounts = Object.keys(methodCounts).length > 0;

      return {
        ok: true,
        hostname,
        snapshot,
        evidenceProtocolVersion: EVIDENCE_VERSION,
        displayedProfileLabel,
        locationId: effectiveLocationId,
        rulePattern,
        assessments,
        accessedCategories,
        failedCategories,
        ...(sharedWorkerStatus ? { sharedWorkerStatus } : {}),
        ...(hasQueryCounts ? { queryCounts } : {}),
        ...(hasMethodCounts ? { methodCounts } : {}),
        explanation,
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "X-Ray state resolution failed.",
      };
    }
  };

  return { getXRayState };
};
