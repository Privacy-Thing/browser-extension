// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LogsSubpage } from "./LogsSubpage";

import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import { ExtensionLogLevel, LogCategory } from "@/shared/types";
import { flushReactEffects } from "@/test-utils/react";

vi.mock("@/ui/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/ui/components/ui/card", () => ({
  Card: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/ui/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    ...props
  }: {
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
  }) => (
    <input
      {...props}
      value={value}
      onChange={(event) => onChange?.({ target: { value: event.currentTarget.value } })}
    />
  ),
}));

vi.mock("@/ui/components/ui/checkbox-group", () => ({
  CheckboxGroup: ({
    title,
    options,
    selectedKeys,
    onSelectionChange,
  }: {
    title: string;
    options: Array<{ id: string; label: string }>;
    selectedKeys: Set<string>;
    onSelectionChange: (keys: Set<string>) => void;
  }) => (
    <fieldset aria-label={title}>
      <legend>{title}</legend>
      {options.map((option) => (
        <label key={option.id}>
          <input
            type="checkbox"
            checked={selectedKeys.has(option.id)}
            onChange={() => {
              const next = new Set(selectedKeys);
              if (next.has(option.id)) {
                next.delete(option.id);
              } else {
                next.add(option.id);
              }
              onSelectionChange(next);
            }}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  ),
}));

vi.mock("@/ui/components/ui/toast", () => ({
  notify: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/ui/shared/AppSubpageHeader", () => ({
  AppSubpageHeader: ({
    title,
    lead,
    actions,
  }: {
    title: string;
    lead: string;
    actions?: ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{lead}</p>
      <div>{actions}</div>
    </div>
  ),
}));

const sampleLogs = [
  {
    id: "verbose-install",
    time: "2026-06-05T12:00:00.000Z",
    category: LogCategory.System,
    level: ExtensionLogLevel.Verbose,
    event: "WebGL.install",
    details: {
      component: "WebGL",
      method: "install",
      kind: "install",
      message: "[Refract] WebGL patch installed",
      stack: "Refract: stack line",
      args: [],
      result: { suppressDebugInfo: true },
    },
  },
  {
    id: "info-intercept",
    time: "2026-06-05T12:01:00.000Z",
    category: LogCategory.Locale,
    level: ExtensionLogLevel.Info,
    event: "Navigator.get userAgent",
    hostname: "example.com",
    details: {
      component: "Navigator",
      method: "get userAgent",
      kind: "intercept",
      message: "[Refract] Navigator.get userAgent intercepted",
      stack: "Refract: stack line",
      args: [],
      result: "Mozilla/5.0",
    },
  },
] as const;

describe("LogsSubpage", () => {
  let root: Root | null = null;
  let sendMessageMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });

    sendMessageMock = vi.fn(async (message: { type: string }) => {
      if (message.type === EXTENSION_COMMAND_TYPES.getLogs) {
        return { ok: true, logs: sampleLogs };
      }

      if (message.type === EXTENSION_COMMAND_TYPES.clearLogs) {
        return { ok: true };
      }

      throw new Error(`Unexpected message type: ${message.type}`);
    });

    vi.stubGlobal("chrome", {
      runtime: {
        id: "abc",
        sendMessage: sendMessageMock,
      },
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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const renderWithRoot = async (): Promise<void> => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing test root.");
    }

    root = createRoot(container);
    await act(async () => {
      root?.render(createElement(LogsSubpage));
    });
    await flushReactEffects();
  };

  it("defaults to info and higher levels while hiding verbose entries", async () => {
    await renderWithRoot();

    expect(document.body.textContent).toContain("1 visible of 2 collected entries");
    expect(document.body.textContent).toContain("Navigator.get userAgent");
    expect(document.body.textContent).not.toContain("[Refract] WebGL patch installed");
  });

  it("renders structured runtime details and can reveal verbose entries", async () => {
    await renderWithRoot();

    expect(document.body.textContent).toContain("Arguments");
    expect(document.body.textContent).toContain("Result");
    expect(document.body.textContent).toContain("Stack");
    expect(document.body.textContent).toContain(
      "[Refract] Navigator.get userAgent intercepted",
    );
    expect(document.body.textContent).toContain("Raw details");

    const verboseCheckbox = Array.from(
      document.querySelectorAll('fieldset[aria-label="Levels"] input[type="checkbox"]'),
    )[0];

    if (!(verboseCheckbox instanceof HTMLInputElement)) {
      throw new Error("Missing verbose level checkbox.");
    }

    await act(async () => {
      verboseCheckbox.click();
    });
    await flushReactEffects();

    expect(document.body.textContent).toContain("2 visible of 2 collected entries");
    expect(document.body.textContent).toContain("WebGL.install");
    expect(document.body.textContent).toContain("[Refract] WebGL patch installed");
  });
});
