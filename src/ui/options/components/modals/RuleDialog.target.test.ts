// @vitest-environment jsdom

import {
  act,
  createElement,
  Fragment,
  type FormEvent,
  useCallback,
  useMemo,
  useState,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RuleDialog } from "./RuleDialog";

import type { SurfaceOverrides } from "@/shared/types";
import { useSettings } from "@/ui/options/state/SettingsContext";

vi.mock("@/ui/options/components/modals/LocationFormFields", () => ({
  UNASSIGNED_VALUE: "__unassigned__",
  LocationFormFields: () =>
    createElement("div", { "data-testid": "location-form-fields" }),
}));

vi.mock("@/ui/options/components/modals/surface-overrides-controls", () => ({
  SurfaceOverridesControls: () =>
    createElement("div", { "data-testid": "surface-overrides-controls" }),
}));

vi.mock("@/ui/options/state/SettingsContext", () => ({
  useSettings: vi.fn(),
}));

type PersistedRuleState = {
  pattern: string;
  locationId: string;
  enabled: boolean;
  relaxCspForWorkers: boolean;
  ruleSeedKey: string;
};

const useSettingsMock = vi.mocked(useSettings);
const initialPersistedRule: PersistedRuleState = {
  pattern: "example.com",
  locationId: "warsaw",
  enabled: true,
  relaxCspForWorkers: false,
  ruleSeedKey: "seed01",
};

let root: Root | null = null;
let currentContext: Record<string, unknown> | null = null;

const flushEffects = async (): Promise<void> => {
  // Drain microtasks inside act() — the dialog uses no real timers, so ordered
  // promise flushes settle effects deterministically without wall-clock waits.
  await act(async () => {
    for (let tick = 0; tick < 5; tick += 1) {
      await Promise.resolve();
    }
  });
};

const clickElement = async (element: HTMLElement | null): Promise<void> => {
  if (!element) {
    throw new Error("Missing clickable element.");
  }

  await act(async () => {
    element.click();
  });
  await flushEffects();
};

const clickById = async (id: string): Promise<void> => {
  const element = document.getElementById(id);
  await clickElement(element);
};

const getSwitch = (id: string) => {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`Expected switch button ${id}.`);
  }
  return element;
};

const renderWithRoot = async () => {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.getElementById("root");
  if (!container) {
    throw new Error("Missing test root.");
  }

  root = createRoot(container);
  await act(async () => {
    root?.render(createElement(RuleDialogHarness));
  });
  await flushEffects();
};

const RuleDialogHarness = () => {
  const [persistedRule, setPersistedRule] = useState(initialPersistedRule);
  const [ruleDialogOpened, setRuleDialogOpened] = useState(true);
  const [rulePattern, setRulePattern] = useState(initialPersistedRule.pattern);
  const [ruleProfileId, setRuleProfileId] = useState(initialPersistedRule.locationId);
  const [ruleEnabled, setRuleEnabled] = useState(initialPersistedRule.enabled);
  const [ruleRelaxCsp, setRuleRelaxCsp] = useState(
    initialPersistedRule.relaxCspForWorkers,
  );
  const [ruleSurfaceOverrides, setRuleSurfaceOverrides] = useState<
    SurfaceOverrides | undefined
  >(undefined);
  const rotateRuleIdentity = vi.fn(async () => true);

  const syncDraftFromPersisted = useCallback((nextRule: PersistedRuleState) => {
    setRulePattern(nextRule.pattern);
    setRuleProfileId(nextRule.locationId);
    setRuleEnabled(nextRule.enabled);
    setRuleRelaxCsp(nextRule.relaxCspForWorkers);
    setRuleSurfaceOverrides(undefined);
  }, []);

  const reopenRuleDialog = useCallback(() => {
    syncDraftFromPersisted(persistedRule);
    setRuleDialogOpened(true);
  }, [persistedRule, syncDraftFromPersisted]);

  const closeRuleDialog = useCallback(() => {
    setRuleDialogOpened(false);
  }, []);

  const handleRuleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const nextPersistedRule: PersistedRuleState = {
        pattern: rulePattern.trim(),
        locationId: ruleProfileId,
        enabled: ruleEnabled,
        relaxCspForWorkers: ruleRelaxCsp,
        ruleSeedKey: persistedRule.ruleSeedKey,
      };

      setPersistedRule(nextPersistedRule);
      setRuleDialogOpened(false);
    },
    [ruleEnabled, rulePattern, ruleProfileId, ruleRelaxCsp, persistedRule.ruleSeedKey],
  );

  const contextValue = useMemo(
    () => ({
      ruleDialogOpened,
      closeRuleDialog,
      ruleDialogMode: "edit",
      handleRuleSubmit,
      handleDeleteRule: vi.fn(async () => false),
      rotateRuleIdentity,
      rulePattern,
      setRulePattern,
      ruleProfileOptions: [{ value: "warsaw", label: "Warsaw" }],
      ruleProfileId,
      setRuleProfileId,
      ruleEnabled,
      setRuleEnabled,
      ruleRelaxCsp,
      setRuleRelaxCsp,
      ruleSurfaceOverrides,
      setRuleSurfaceOverrides,
      editingRulePattern: persistedRule.pattern,
      editingRuleSeedKey: persistedRule.ruleSeedKey,
      trustedSites: [],
    }),
    [
      closeRuleDialog,
      handleRuleSubmit,
      persistedRule.pattern,
      persistedRule.ruleSeedKey,
      ruleDialogOpened,
      ruleEnabled,
      rotateRuleIdentity,
      ruleSurfaceOverrides,
      rulePattern,
      ruleProfileId,
      ruleRelaxCsp,
    ],
  );
  currentContext = contextValue;

  return createElement(
    Fragment,
    null,
    createElement(
      "button",
      {
        id: "reopen-rule-dialog",
        type: "button",
        onClick: reopenRuleDialog,
      },
      "reopen",
    ),
    createElement(
      "div",
      { id: "persisted-rule-relax-csp" },
      persistedRule.relaxCspForWorkers ? "true" : "false",
    ),
    createElement(RuleDialog),
  );
};

describe("RuleDialog", () => {
  beforeEach(() => {
    useSettingsMock.mockImplementation(() => currentContext as never);
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: {
        runtime: {
          getURL: (path: string) => `chrome-extension://test/${path}`,
        },
      },
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        media: "",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: class {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    });
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(async () => {
    if (root) {
      const mountedRoot = root;
      root = null;
      await act(async () => {
        mountedRoot.unmount();
      });
    }

    currentContext = null;
    document.body.innerHTML = "";
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    vi.clearAllMocks();
  });

  it("shows the CSP toggle only in the advanced modal", async () => {
    await renderWithRoot();

    expect(document.body.textContent).not.toContain("Relax CSP for worker spoofing");

    await clickById("open-rule-advanced-dialog");

    expect(document.body.textContent).toContain("Advanced settings for example.com");
    expect(document.body.textContent).toContain("Relax CSP for worker spoofing");
    expect(document.body.textContent).toContain(
      "These changes stay in the current draft until you save the rule.",
    );
  });

  it("discards advanced draft changes when the main dialog closes without Save", async () => {
    await renderWithRoot();

    await clickById("open-rule-advanced-dialog");
    await clickElement(getSwitch("dialog-rule-relax-csp"));

    expect(getSwitch("dialog-rule-relax-csp").getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(document.getElementById("persisted-rule-relax-csp")?.textContent).toBe(
      "false",
    );

    await clickById("confirm-rule-advanced-dialog");
    await clickById("close-rule-dialog");
    await clickById("reopen-rule-dialog");
    await clickById("open-rule-advanced-dialog");

    expect(getSwitch("dialog-rule-relax-csp").getAttribute("aria-checked")).toBe(
      "false",
    );
    expect(document.getElementById("persisted-rule-relax-csp")?.textContent).toBe(
      "false",
    );
  });

  it("persists advanced draft changes only after the main Save action", async () => {
    await renderWithRoot();

    await clickById("open-rule-advanced-dialog");
    await clickElement(getSwitch("dialog-rule-relax-csp"));
    await clickById("confirm-rule-advanced-dialog");

    expect(document.getElementById("persisted-rule-relax-csp")?.textContent).toBe(
      "false",
    );

    await clickById("save-rule-dialog");

    expect(document.getElementById("persisted-rule-relax-csp")?.textContent).toBe(
      "true",
    );

    await clickById("reopen-rule-dialog");
    await clickById("open-rule-advanced-dialog");

    expect(getSwitch("dialog-rule-relax-csp").getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("shows the Identity section and routes New identity through settings actions", async () => {
    await renderWithRoot();

    const locationFields = document.querySelector(
      '[data-testid="location-form-fields"]',
    );
    const identityHeading = [...document.querySelectorAll("h3")].find((element) =>
      element.textContent?.includes("Identity"),
    );

    if (
      !(locationFields instanceof HTMLElement) ||
      !(identityHeading instanceof HTMLElement)
    ) {
      throw new Error("Expected location fields and Identity heading to be rendered.");
    }

    expect(
      locationFields.compareDocumentPosition(identityHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(document.body.textContent).toContain("Identity");
    expect(document.body.textContent).not.toContain("seed01");
    expect(document.body.textContent).toContain(
      "This rule keeps its own spoofing identity.",
    );
    expect(document.body.textContent).toContain(
      "Clears related site data and starts this rule with a fresh identity.",
    );

    await clickElement(
      document.querySelector('[data-dialog-section="identity"] button'),
    );

    expect(currentContext?.rotateRuleIdentity).toHaveBeenCalledWith("example.com");
  });

  it("moves pattern instructions into a tooltip trigger and keeps the header copy concise", async () => {
    await renderWithRoot();

    expect(document.body.textContent).toContain(
      "Choose where this rule applies, then decide whether it should use a preset, custom protection settings, or both.",
    );
    expect(document.body.textContent).not.toContain(
      "Save an exact host like example.com, a host-plus-subdomains rule like *example.com, or a subdomain-only rule like *.example.com.",
    );

    const infoButton = [...document.querySelectorAll("button")].find(
      (element) =>
        element.getAttribute("aria-label") === "Learn how rule patterns work",
    );

    expect(infoButton).toBeTruthy();
  });
});
