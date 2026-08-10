// @vitest-environment jsdom

import { act } from "react";
import { useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocationDetailsFields } from "./LocationDetailsFields";

vi.mock("@/ui/components/ui/combobox", () => ({
  Combobox: ({
    options,
    value,
    onValueChange,
    disabled,
    "aria-labelledby": ariaLabelledBy,
  }: {
    options: Array<{ value: string; label: string }>;
    value: string;
    onValueChange: (value: string) => void;
    disabled?: boolean;
    "aria-labelledby"?: string;
  }) => (
    <select
      value={value}
      onChange={(event) => onValueChange(event.currentTarget.value)}
      disabled={disabled}
      aria-labelledby={ariaLabelledBy}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

type DraftState = {
  label: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  noiseRadius: number;
  language: string;
  languages: string[];
  preferEnglishContent?: boolean;
  timeZone: string;
};

const createDraft = (overrides: Partial<DraftState> = {}): DraftState => ({
  label: "Warsaw",
  latitude: 52.2297,
  longitude: 21.0122,
  accuracy: 25,
  noiseRadius: 50,
  language: "pl",
  languages: ["pl"],
  preferEnglishContent: false,
  timeZone: "Europe/Warsaw",
  ...overrides,
});

const TestHarness = ({ initialDraft }: { initialDraft: DraftState }) => {
  const [draft, setDraft] = useState(initialDraft);

  return (
    <LocationDetailsFields
      draft={draft}
      onDraftChange={(mutate) => {
        setDraft((current) => mutate(current));
      }}
      disabled={false}
      sectionsCollapsible={false}
    />
  );
};

describe("LocationDetailsFields", () => {
  let root: Root | null = null;

  beforeEach(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
  });

  afterEach(async () => {
    if (root) {
      const currentRoot = root;
      root = null;
      await act(async () => {
        currentRoot.unmount();
      });
    }

    document.body.innerHTML = "";
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    vi.restoreAllMocks();
  });

  it("disables and fades the English-first checkbox when the preset is already English-first", async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing test root.");
    }

    const currentRoot = createRoot(container);
    root = currentRoot;
    await act(async () => {
      currentRoot.render(
        <TestHarness
          initialDraft={createDraft({
            language: "en-US",
            languages: ["en-US", "pl"],
          })}
        />,
      );
    });

    const checkbox = container.querySelector(
      "#location-prefer-english-content",
    ) as HTMLInputElement | null;
    const fadedBox = container.querySelector(".opacity-60");
    const prefixTag = container.querySelector('[data-prefix-tag-state="hidden"]');

    expect(checkbox?.disabled).toBe(true);
    expect(fadedBox).not.toBeNull();
    expect(prefixTag).not.toBeNull();
  });

  it("clears the preference and hides the injected English chip after switching the primary locale to English", async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing test root.");
    }

    const currentRoot = createRoot(container);
    root = currentRoot;
    await act(async () => {
      currentRoot.render(
        <TestHarness
          initialDraft={createDraft({
            languages: ["pl"],
            preferEnglishContent: true,
          })}
        />,
      );
    });

    const primaryLocaleSelect = container.querySelector(
      'select[aria-labelledby="location-primary-locale-label"]',
    ) as HTMLSelectElement | null;

    if (!primaryLocaleSelect) {
      throw new Error("Missing primary locale select.");
    }

    await act(async () => {
      primaryLocaleSelect.value = "en-US";
      primaryLocaleSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const checkbox = container.querySelector(
      "#location-prefer-english-content",
    ) as HTMLInputElement | null;
    const visiblePrefixTag = container.querySelector(
      '[data-prefix-tag-state="visible"]',
    );
    const hiddenPrefixTag = container.querySelector('[data-prefix-tag-state="hidden"]');

    expect(checkbox?.checked).toBe(false);
    expect(checkbox?.disabled).toBe(true);
    expect(visiblePrefixTag).toBeNull();
    expect(hiddenPrefixTag).not.toBeNull();
  });
});
