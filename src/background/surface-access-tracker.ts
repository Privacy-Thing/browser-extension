import type {
  SurfaceMethodQueryCounts,
  SurfaceQueryCounts,
} from "@privacy-brand/xray-protocol";

import type {
  XRayAccessedCategories,
  XRaySurfaceCategory,
  SpoofingSurfaceMethodId,
} from "@/shared/types";

const tabSurfaceMap = new Map<number, Set<XRaySurfaceCategory>>();
const tabErrorMap = new Map<number, Set<XRaySurfaceCategory>>();
const DEFAULT_SOURCE_KEY = "0:runtime";
const tabCountMap = new Map<number, Map<string, Map<XRaySurfaceCategory, number>>>();
const tabMethodCountMap = new Map<
  number,
  Map<string, Map<SpoofingSurfaceMethodId, number>>
>();

const getSourceMap = <TKey extends string>(
  tabMap: Map<number, Map<string, Map<TKey, number>>>,
  tabId: number,
  sourceKey: string,
): Map<TKey, number> => {
  let tabSources = tabMap.get(tabId);
  if (!tabSources) {
    tabSources = new Map();
    tabMap.set(tabId, tabSources);
  }

  let sourceMap = tabSources.get(sourceKey);
  if (!sourceMap) {
    sourceMap = new Map();
    tabSources.set(sourceKey, sourceMap);
  }

  return sourceMap;
};

const recordMonotonicCounts = <TKey extends string>(
  map: Map<TKey, number>,
  counts: Partial<Record<TKey, number>>,
): void => {
  for (const [key, count] of Object.entries(counts) as [TKey, number][]) {
    if (!Number.isFinite(count) || count < 0) {
      continue;
    }

    map.set(key, Math.max(map.get(key) ?? 0, count));
  }
};

const sumSourceCounts = <TKey extends string>(
  tabSources: Map<string, Map<TKey, number>> | undefined,
): Partial<Record<TKey, number>> => {
  if (!tabSources || tabSources.size === 0) return {};
  const totals = new Map<TKey, number>();
  for (const sourceMap of tabSources.values()) {
    for (const [key, count] of sourceMap.entries()) {
      totals.set(key, (totals.get(key) ?? 0) + count);
    }
  }
  return Object.fromEntries(totals) as Partial<Record<TKey, number>>;
};

export const recordSurfaceAccess = (
  tabId: number,
  categories: readonly XRaySurfaceCategory[],
): void => {
  let set = tabSurfaceMap.get(tabId);
  if (!set) {
    set = new Set();
    tabSurfaceMap.set(tabId, set);
  }
  for (const cat of categories) {
    set.add(cat);
  }
};

export const getSurfaceAccess = (tabId: number): XRayAccessedCategories => {
  const set = tabSurfaceMap.get(tabId);
  if (!set || set.size === 0) {
    return {};
  }
  const result: XRayAccessedCategories = {};
  for (const cat of set) {
    result[cat] = true;
  }
  return result;
};

export const clearSurfaceAccess = (tabId: number): void => {
  tabSurfaceMap.delete(tabId);
  tabCountMap.delete(tabId);
  tabMethodCountMap.delete(tabId);
};

export const recordSurfaceError = (
  tabId: number,
  categories: readonly XRaySurfaceCategory[],
): void => {
  let set = tabErrorMap.get(tabId);
  if (!set) {
    set = new Set();
    tabErrorMap.set(tabId, set);
  }
  for (const cat of categories) {
    set.add(cat);
  }
};

export const getSurfaceErrors = (tabId: number): XRayAccessedCategories => {
  const set = tabErrorMap.get(tabId);
  if (!set || set.size === 0) {
    return {};
  }
  const result: XRayAccessedCategories = {};
  for (const cat of set) {
    result[cat] = true;
  }
  return result;
};

export const clearSurfaceErrors = (tabId: number): void => {
  tabErrorMap.delete(tabId);
};

export const recordSurfaceCounts = (
  tabId: number,
  counts: SurfaceQueryCounts,
  sourceKey = DEFAULT_SOURCE_KEY,
): void => {
  recordMonotonicCounts(getSourceMap(tabCountMap, tabId, sourceKey), counts);
};

export const recordMethodCounts = (
  tabId: number,
  counts: SurfaceMethodQueryCounts,
  sourceKey = DEFAULT_SOURCE_KEY,
): void => {
  recordMonotonicCounts(getSourceMap(tabMethodCountMap, tabId, sourceKey), counts);
};

export const getSurfaceCounts = (tabId: number): SurfaceQueryCounts => {
  return sumSourceCounts(tabCountMap.get(tabId)) as SurfaceQueryCounts;
};

export const getSurfaceMethodCounts = (tabId: number): SurfaceMethodQueryCounts => {
  return sumSourceCounts(tabMethodCountMap.get(tabId)) as SurfaceMethodQueryCounts;
};

export const getTotalQueryCount = (tabId: number): number => {
  const counts = getSurfaceCounts(tabId);
  let total = 0;
  for (const count of Object.values(counts)) {
    total += count;
  }
  return total;
};

export const getBadgeQueryCount = (
  tabId: number,
  includeDateCalls: boolean,
): number => {
  const total = getTotalQueryCount(tabId);
  if (includeDateCalls) return total;

  const sourceCounts = tabCountMap.get(tabId);
  if (!sourceCounts) return total;

  const sourceMethods = tabMethodCountMap.get(tabId);
  let filteredTotal = 0;
  for (const [sourceKey, categoryCounts] of sourceCounts.entries()) {
    let sourceTotal = 0;
    for (const count of categoryCounts.values()) {
      sourceTotal += count;
    }

    let sourceDateCalls = 0;
    const methodCounts = sourceMethods?.get(sourceKey);
    for (const [methodId, count] of methodCounts?.entries() ?? []) {
      if (methodId.startsWith("date.")) {
        sourceDateCalls += count;
      }
    }

    filteredTotal += Math.max(0, sourceTotal - sourceDateCalls);
  }

  return filteredTotal;
};
