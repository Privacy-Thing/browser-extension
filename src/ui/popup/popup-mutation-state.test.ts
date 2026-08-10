import { describe, expect, it } from "vitest";

import {
  INITIAL_MUTATION_STATE,
  getPopupAlertContent,
  reducePopupMutationState,
} from "@/ui/popup/popup-mutation-state";

describe("reducePopupMutationState", () => {
  it("keeps the attempted action visible while pending and after failure", () => {
    const pending = reducePopupMutationState(INITIAL_MUTATION_STATE, {
      type: "start",
      action: "save-rule",
    });
    expect(pending).toEqual({ status: "pending", action: "save-rule", message: null });

    expect(
      reducePopupMutationState(pending, {
        type: "fail",
        action: "save-rule",
        message: "Storage unavailable",
      }),
    ).toEqual({
      status: "error",
      action: "save-rule",
      message: "Storage unavailable",
    });
  });

  it("resets transient state when the workspace closes", () => {
    expect(
      reducePopupMutationState(
        {
          status: "success",
          action: "cleanup",
          message: null,
        },
        { type: "reset" },
      ),
    ).toBe(INITIAL_MUTATION_STATE);
  });
});

describe("getPopupAlertContent", () => {
  it("uses Retry only for an operation that reloads popup state", () => {
    expect(
      getPopupAlertContent({
        loadError: true,
        mutationState: INITIAL_MUTATION_STATE,
        showFirefoxWarning: true,
      }),
    ).toEqual({
      title: "Couldn’t load this site’s status.",
      actionLabel: "Retry",
      action: "retry-load",
    });
  });

  it("dismisses mutation errors and gives them priority over the Firefox notice", () => {
    expect(
      getPopupAlertContent({
        loadError: false,
        mutationState: {
          status: "error",
          action: "save-rule",
          message: "Privacy Thing couldn’t complete that action. Try again.",
        },
        showFirefoxWarning: true,
      }),
    ).toEqual({
      title: "Privacy Thing couldn’t complete that action. Try again.",
      actionLabel: "Dismiss",
      action: "dismiss-error",
    });
  });

  it("returns the complete Firefox first-load warning", () => {
    expect(
      getPopupAlertContent({
        loadError: false,
        mutationState: INITIAL_MUTATION_STATE,
        showFirefoxWarning: true,
      }),
    ).toEqual({
      title: "Improve first-load spoofing in Firefox",
      description:
        "Firefox may expose your real time and locale to the page’s first script. Grant the optional userScripts permission so Privacy Thing can start spoofing earlier.",
      actionLabel: "Grant permission",
      action: "grant-firefox-permission",
    });
  });
});
