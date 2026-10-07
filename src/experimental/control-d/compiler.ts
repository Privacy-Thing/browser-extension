/* eslint-disable sonarjs/cognitive-complexity -- Fail-closed compilation keeps rule decisions explicit. */

import type {
  ControlDCompiledRule,
  ControlDCompileWarning,
  ControlDMapping,
  ControlDProxyLocation,
} from "./contracts";

import type { DomainRule, Location } from "@/shared/types";

export type ControlDCompilation = {
  rules: ControlDCompiledRule[];
  warnings: ControlDCompileWarning[];
  mappings: Record<string, ControlDMapping>;
};

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const distanceInKilometers = (
  first: Pick<Location, "latitude" | "longitude">,
  second: Pick<ControlDProxyLocation, "latitude" | "longitude">,
): number => {
  const earthRadius = 6_371;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const nearestProxy = (
  location: Location,
  proxies: readonly ControlDProxyLocation[],
): ControlDProxyLocation | null =>
  proxies.reduce<ControlDProxyLocation | null>((nearest, candidate) => {
    if (!nearest) return candidate;
    return distanceInKilometers(location, candidate) <
      distanceInKilometers(location, nearest)
      ? candidate
      : nearest;
  }, null);

const resolveMapping = (
  location: Location,
  proxies: readonly ControlDProxyLocation[],
  stored: ControlDMapping | undefined,
): { mapping: ControlDMapping; warning?: ControlDCompileWarning } => {
  if (stored?.status === "skipped" || stored?.proxyPk === null) {
    return {
      mapping: {
        locationId: location.id,
        locationLabel: location.label,
        proxyPk: null,
        status: "skipped",
        confirmed: stored?.confirmed ?? true,
      },
      warning: {
        code: "skipped-location",
        locationId: location.id,
        message: `${location.label} is excluded from Control D synchronization.`,
      },
    };
  }

  const storedProxy = stored
    ? proxies.find((proxy) => proxy.pk === stored.proxyPk)
    : undefined;
  if (storedProxy) {
    const exact =
      Boolean(location.countryCode) &&
      storedProxy.countryCode === location.countryCode?.toUpperCase();
    const status = exact ? "exact" : "approximate";
    return {
      mapping: {
        locationId: location.id,
        locationLabel: location.label,
        proxyPk: storedProxy.pk,
        status,
        confirmed: status === "exact" || (stored?.confirmed ?? false),
      },
      ...(status === "approximate"
        ? {
            warning: {
              code: "approximate-location" as const,
              locationId: location.id,
              message: `${location.label} uses the approximate exit ${storedProxy.city}, ${storedProxy.countryName}.`,
            },
          }
        : {}),
    };
  }

  const normalizedCountry = location.countryCode?.toUpperCase();
  const sameCountry = normalizedCountry
    ? proxies.filter((proxy) => proxy.countryCode === normalizedCountry)
    : [];
  const selected = nearestProxy(
    location,
    sameCountry.length > 0 ? sameCountry : proxies,
  );

  if (!selected) {
    return {
      mapping: {
        locationId: location.id,
        locationLabel: location.label,
        proxyPk: null,
        status: "skipped",
        confirmed: false,
      },
      warning: {
        code: "skipped-location",
        locationId: location.id,
        message: `No usable Control D exit is available for ${location.label}.`,
      },
    };
  }

  const exact = sameCountry.length > 0;
  const status = exact ? "exact" : "approximate";
  let warning: ControlDCompileWarning | undefined;
  if (!normalizedCountry) {
    warning = {
      code: "missing-country",
      locationId: location.id,
      message: `${location.label} has no confirmed country and currently maps to ${selected.city}, ${selected.countryName}.`,
    };
  } else if (!exact) {
    warning = {
      code: "approximate-location",
      locationId: location.id,
      message: `Control D has no exit in ${normalizedCountry}; ${location.label} maps to ${selected.city}, ${selected.countryName}.`,
    };
  }

  return {
    mapping: {
      locationId: location.id,
      locationLabel: location.label,
      proxyPk: selected.pk,
      status,
      confirmed: exact,
    },
    ...(warning ? { warning } : {}),
  };
};

export const compileControlDPattern = (
  pattern: string,
): { hostname: string } | { warning: ControlDCompileWarning } => {
  const isHostnamePattern =
    pattern.length > 0 &&
    pattern === pattern.trim() &&
    pattern !== "*" &&
    /^[a-z0-9*._-]+$/i.test(pattern);

  if (isHostnamePattern) return { hostname: pattern };

  return {
    warning: {
      code: "unsupported-pattern",
      pattern,
      message: `${pattern} is not a valid Control D hostname pattern.`,
    },
  };
};

export const compileControlDState = ({
  rules,
  locations,
  proxies,
  storedMappings,
}: {
  rules: readonly DomainRule[];
  locations: readonly Location[];
  proxies: readonly ControlDProxyLocation[];
  storedMappings: Readonly<Record<string, ControlDMapping>>;
}): ControlDCompilation => {
  const warnings: ControlDCompileWarning[] = [];
  const mappings: Record<string, ControlDMapping> = {};
  const compiledRules: ControlDCompiledRule[] = [];
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const usedHostnames = new Map<string, string>();

  for (const rule of rules) {
    if (!rule.enabled || !rule.locationId) continue;
    const location = locationById.get(rule.locationId);
    if (!location) {
      warnings.push({
        code: "missing-location",
        pattern: rule.pattern,
        locationId: rule.locationId,
        message: `${rule.pattern} references a missing regional preset.`,
      });
      continue;
    }

    let mapping = mappings[location.id];
    if (!mapping) {
      const resolved = resolveMapping(location, proxies, storedMappings[location.id]);
      mapping = resolved.mapping;
      mappings[location.id] = mapping;
      if (resolved.warning) warnings.push(resolved.warning);
    }
    if (!mapping.proxyPk || mapping.status === "skipped") continue;

    const patternResult = compileControlDPattern(rule.pattern);
    if (!("hostname" in patternResult)) {
      warnings.push({ ...patternResult.warning, locationId: location.id });
      continue;
    }
    const previousLocation = usedHostnames.get(patternResult.hostname);
    if (previousLocation && previousLocation !== location.id) {
      warnings.push({
        code: "unsupported-pattern",
        pattern: rule.pattern,
        locationId: location.id,
        message: `${patternResult.hostname} resolves to more than one regional preset.`,
      });
      continue;
    }

    usedHostnames.set(patternResult.hostname, location.id);
    compiledRules.push({
      sourcePattern: rule.pattern,
      hostname: patternResult.hostname,
      locationId: location.id,
      proxyPk: mapping.proxyPk,
    });
  }

  const ruleCounts = compiledRules.reduce<Record<string, number>>((counts, rule) => {
    counts[rule.locationId] = (counts[rule.locationId] ?? 0) + 1;
    return counts;
  }, {});
  const summarizedMappings = Object.fromEntries(
    Object.entries(mappings).map(([locationId, mapping]) => [
      locationId,
      { ...mapping, ruleCount: ruleCounts[locationId] ?? 0 },
    ]),
  );

  return {
    rules: compiledRules.sort((left, right) =>
      left.hostname.localeCompare(right.hostname),
    ),
    warnings,
    mappings: summarizedMappings,
  };
};
