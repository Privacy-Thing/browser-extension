// @vitest-environment jsdom

import { serializeDiagnosticText } from "@privacy-brand/xray-protocol/diagnostic-report";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { XRayDiagnosticReport } from "./XRayDiagnosticReport";

import { downloadLocalText } from "@/ui/shared/local-download";
import { createXRayStoryState } from "@/ui/sidebar/stories/xray-story-fixtures";

vi.mock("@/ui/shared/local-download", () => ({ downloadLocalText: vi.fn() }));

const click = async (selector: string) => {
  const element = document.querySelector<HTMLElement>(selector);
  expect(element).not.toBeNull();
  await act(async () => element?.click());
};
const preview = () =>
  document.querySelector<HTMLTextAreaElement>("[data-report-preview]")!.value;

describe("X-Ray report consent and download", () => {
  let root: Root;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("chrome", {
      runtime: { getManifest: () => ({ version: "0.9.3.10" }) },
    });
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById("root")!);
    vi.mocked(downloadLocalText).mockClear();
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });
  const render = async (scenario: Parameters<typeof createXRayStoryState>[0]) => {
    await act(async () =>
      root.render(
        <XRayDiagnosticReport
          state={createXRayStoryState(scenario)}
          collectionPending={false}
        />,
      ),
    );
  };

  it("freezes preview data, exports exactly both previews, and resets site consent", async () => {
    await render("active");
    await click("[data-report-prepare]");
    expect(preview()).not.toContain("maps.example.test");
    expect(
      document.querySelector<HTMLInputElement>("[data-report-site-toggle]")?.checked,
    ).toBe(false);
    const text = preview();
    await click('[data-report-download="text"]');
    expect(downloadLocalText).toHaveBeenLastCalledWith(
      "privacy-thing-diagnostic-v1.txt",
      text,
      "text/plain",
    );
    await click('[data-report-view="json"]');
    const json = preview();
    expect(serializeDiagnosticText(JSON.parse(json))).toBe(text);
    await act(async () => {
      vi.setSystemTime(1_800_000_005_000);
    });
    await render("error");
    expect(preview()).toBe(json);
    await click('[data-report-download="json"]');
    expect(downloadLocalText).toHaveBeenLastCalledWith(
      "privacy-thing-diagnostic-v1.json",
      json,
      "application/json",
    );
    await click("[data-report-site-toggle]");
    expect(JSON.parse(preview()).site).toEqual({
      hostname: "maps.example.test",
      pattern: "maps.example.test",
    });
    const original = JSON.parse(json);
    const { site: _site, ...withSite } = JSON.parse(preview());
    expect(withSite).toEqual(original);
    const downloads = vi.mocked(downloadLocalText).mock.calls.length;
    await click("[data-report-cancel]");
    expect(downloadLocalText).toHaveBeenCalledTimes(downloads);
    expect(document.querySelector("[data-diagnostic-report]")).toBeNull();
    await render("active");
    await click("[data-report-prepare]");
    expect(preview()).not.toContain("maps.example.test");
  });

  it.each(["error", "trusted-site"] as const)(
    "keeps a local report accessible in the %s state",
    async (scenario) => {
      await render(scenario);
      await click("[data-report-prepare]");
      expect(
        document
          .querySelector("[data-diagnostic-report]")
          ?.getAttribute("data-report-status"),
      ).toBe("partial");
      expect(preview()).not.toContain("could not be resolved");
      await click("[data-report-cancel]");
      expect(downloadLocalText).not.toHaveBeenCalled();
    },
  );
});
