import type { PopupPolicyNoticeKind, SiteSuggestionKind } from "@/shared/types";

export const isSuggestionNotice = (value: unknown): value is SiteSuggestionKind =>
  value === "worker-csp-relaxation" || value === "shared-worker-injection-relaxation";

export const POLICY_NOTICE_KINDS = [
  "service-worker-block",
  "shared-worker-strict",
] as const satisfies readonly PopupPolicyNoticeKind[];

export const isPopupPolicyNoticeKind = (
  value: unknown,
): value is PopupPolicyNoticeKind =>
  typeof value === "string" && POLICY_NOTICE_KINDS.some((kind) => kind === value);
