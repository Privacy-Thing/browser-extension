import type { ButtonHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SidebarShell } from "./SidebarShell";

const mocks = vi.hoisted(() => ({
  state: {
    current: {
      ok: true,
      hostname: "example.com",
      rulePattern: null as string | null,
      locationId: null,
    },
  },
}));

vi.mock("./modules/registry", () => ({
  SIDEBAR_MODULES: [
    {
      title: "X-Ray",
      Component: () => <div data-testid="module" />,
    },
  ],
}));

vi.mock("./useXRayState", () => ({
  useXRayState: () => ({
    state: mocks.state.current,
    loading: false,
    refresh: vi.fn(),
    surfaceSyncPending: false,
  }),
}));

vi.mock("@/ui/components/ui/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/ui/i18n", () => ({
  t: {
    sidebar: {
      openLogs: "Open logs",
      openSettings: "Open settings",
      openRule: "Open rule",
    },
  },
}));

vi.mock("@/ui/shared/MadeWithLoveBadge", () => ({
  MadeWithLoveBadge: () => <span>Privacy Thing</span>,
}));

describe("SidebarShell", () => {
  it.each([null, "example.com"])(
    "renders the domain action when rulePattern is %s",
    (rulePattern) => {
      mocks.state.current.rulePattern = rulePattern;

      const markup = renderToStaticMarkup(<SidebarShell />);

      expect(markup).toContain("example.com");
      expect(markup).toContain('title="Open rule"');
    },
  );
});
