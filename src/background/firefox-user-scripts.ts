import type { FirefoxShimState } from "@privacy-brand/refract-browser/common/firefox-shim-state";

import {
  buildFxStateCandidate,
  buildFxSeedSource,
} from "@/background/firefox-static-payload";
import { getDomainPatternKind } from "@/shared/domain-match";
import { buildFxSeedScriptId } from "@/shared/extension-contract";

export type UserScriptRuleEntry = {
  pattern: string;
  state: FirefoxShimState;
};

export type UserScriptRegistration = {
  id: string;
  js: Array<
    | {
        code: string;
      }
    | {
        file: string;
      }
  >;
  matches: string[];
  excludeMatches?: string[];
  allFrames: boolean;
  runAt: "document_start";
  world: "MAIN";
};

const normalizePattern = (pattern: string): string => pattern.trim().toLowerCase();

export const buildUserScriptMatches = (pattern: string): string[] => {
  const normalized = normalizePattern(pattern);
  if (!normalized || normalized === "*") {
    // Firefox userScripts match patterns need both protocols to cover ordinary browsing.
    // eslint-disable-next-line sonarjs/no-clear-text-protocols
    return normalized === "*" ? ["http://*/*", "https://*/*"] : [];
  }

  switch (getDomainPatternKind(normalized)) {
    case "subdomains-only": {
      const host = normalized.slice(2);
      return host ? [`*://*.${host}/*`] : [];
    }
    case "apex-and-subdomains": {
      const host = normalized.slice(1);
      if (!host) {
        return [];
      }

      return Array.from(new Set([`*://${host}/*`, `*://*.${host}/*`]));
    }
    case "exact":
    case "wildcard":
    default:
      return [`*://${normalized}/*`];
  }
};

export const buildUserScriptExcludes = (
  ruleEntries: readonly UserScriptRuleEntry[],
): string[] =>
  Array.from(
    new Set(ruleEntries.flatMap((entry) => buildUserScriptMatches(entry.pattern))),
  );

export const createUserScriptRegs = ({
  ruleEntries,
  trustedPatterns = [],
}: {
  ruleEntries: readonly UserScriptRuleEntry[];
  trustedPatterns?: readonly string[];
}): UserScriptRegistration[] => {
  const excludeMatches = Array.from(
    new Set(trustedPatterns.flatMap((pattern) => buildUserScriptMatches(pattern))),
  );
  return ruleEntries.flatMap((entry, index) => {
    const matches = buildUserScriptMatches(entry.pattern);
    if (matches.length === 0) {
      return [];
    }

    return [
      {
        id: buildFxSeedScriptId(index),
        js: [
          {
            code: buildFxSeedSource(buildFxStateCandidate(entry)),
          },
        ],
        matches,
        ...(excludeMatches.length > 0 ? { excludeMatches } : {}),
        allFrames: true,
        runAt: "document_start",
        world: "MAIN",
      },
    ];
  });
};
