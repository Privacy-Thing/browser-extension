import type { PopupState } from "./shared-model-types";

export type DeleteRuleResponse =
  { ok: true; state: PopupState } | { ok: false; error: string };
export type ApplySuggestionResponse =
  { ok: true; state: PopupState } | { ok: false; error: string };
