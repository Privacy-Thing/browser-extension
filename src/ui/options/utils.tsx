import { slugifyToken } from "@/shared/slugify";
import type { DomainRule, OsmConsentState } from "@/shared/types";
import { getBrowserCapabilities } from "@/ui/shared/browser-capabilities";

export type SettingsTab =
  | "profiles"
  | "rules"
  | "trusted-sites"
  | "playground"
  | "options"
  | "containers"
  | "advanced"
  | "about";
export type StatusTone = "info" | "success" | "error" | "warning" | "neutral";
export type RuleDialogMode = "add" | "edit";
export type ProfileGeneratorStep = "search" | "result" | "language" | "confirm";
export type OsmConsentPromptAction =
  { type: "generator" } | { type: "editor"; profileIndex: number };

export const capabilities = getBrowserCapabilities();

export const getVisibleSettingsTabs = ({
  showContainers,
}: {
  showContainers: boolean;
}): SettingsTab[] => [
  "rules",
  ...(showContainers ? (["containers"] as const) : []),
  "profiles",
  "trusted-sites",
  "options",
  "advanced",
  "playground",
  "about",
];

export const normalizeRulePattern = (pattern: string): string =>
  pattern.trim().toLowerCase();

export const slugifyId = (value: string): string => slugifyToken(value);

export const createUniqueLocationId = (
  baseLabel: string,
  existingIds: readonly string[],
): string => {
  const baseId = slugifyId(baseLabel) || "profile";
  if (!existingIds.includes(baseId)) {
    return baseId;
  }

  for (let index = 2; ; index += 1) {
    const candidate = `${baseId}-${index}`;
    if (!existingIds.includes(candidate)) {
      return candidate;
    }
  }
};

export const dedupeRules = (rules: readonly DomainRule[]): DomainRule[] => {
  const seen = new Set<string>();
  const nextRules: DomainRule[] = [];

  for (const rule of rules) {
    const key = normalizeRulePattern(rule.pattern);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    nextRules.push(rule);
  }

  return nextRules;
};

const toneClasses: Record<StatusTone, string> = {
  info: "bg-tone-info-bg text-tone-info-text border-tone-info-border",
  success: "bg-tone-success-bg text-tone-success-text border-tone-success-border",
  error: "bg-tone-error-bg text-tone-error-text border-tone-error-border",
  warning: "bg-tone-warning-bg text-tone-warning-text border-tone-warning-border",
  neutral: "bg-tone-neutral-bg text-tone-neutral-text border-tone-neutral-border",
};

export const toToneClassName = (tone: StatusTone): string => toneClasses[tone];

export const toFiniteNumber = (value: string | number): number | null => {
  const nextValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(nextValue) ? nextValue : null;
};

export const icon = (name: string, className?: string) => (
  <span
    className={["fa-solid", name, className].filter(Boolean).join(" ")}
    aria-hidden="true"
  />
);

export const downloadJson = (filename: string, payload: unknown): void => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  queueMicrotask(() => URL.revokeObjectURL(url));
};

export const downloadCsv = (filename: string, csv: string): void => {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  queueMicrotask(() => URL.revokeObjectURL(url));
};

export const getOptionsPageUrl = (anchorId?: string): string => {
  const baseUrl = chrome.runtime.getURL("src/ui/options/index.html");
  return anchorId ? `${baseUrl}#${anchorId}` : baseUrl;
};

export const isOsmConsentGranted = (osmConsent: OsmConsentState): boolean =>
  osmConsent === "granted";
