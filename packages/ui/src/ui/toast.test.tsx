import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppToast } from "./toast";

describe("AppToast", () => {
  it("renders success messages as polite status updates", () => {
    const markup = renderToStaticMarkup(
      createElement(AppToast, {
        toastId: "success-toast",
        tone: "success",
        message: "Saved",
        duration: 3000,
        dismissible: true,
      }),
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('aria-atomic="true"');
  });

  it("renders error messages as assertive alerts", () => {
    const markup = renderToStaticMarkup(
      createElement(AppToast, {
        toastId: "error-toast",
        tone: "error",
        message: "Save failed",
        duration: 3000,
        dismissible: true,
      }),
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('aria-live="assertive"');
    expect(markup).toContain('aria-atomic="true"');
  });

  it("keeps the shared DOM selector contract for toast surfaces", () => {
    const markup = renderToStaticMarkup(
      createElement(AppToast, {
        toastId: "selector-toast",
        tone: "info",
        message: "Selectors",
        duration: 3000,
        dismissible: true,
      }),
    );

    expect(markup).toContain("data-pt-toast");
    expect(markup).toContain("data-pt-toast-progress");
  });
});
