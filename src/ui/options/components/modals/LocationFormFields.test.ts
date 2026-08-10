import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LocationFormFields } from "./LocationFormFields";

vi.mock("@/ui/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-testid": "select-root" }, children),
  SelectTrigger: ({ id, children }: { id?: string; children: React.ReactNode }) =>
    createElement("button", { id, type: "button" }, children),
  SelectValue: ({ placeholder }: { placeholder?: string }) =>
    createElement("span", null, placeholder ?? ""),
  SelectContent: ({ children }: { children: React.ReactNode }) =>
    createElement("div", null, children),
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) =>
    createElement("div", { "data-value": value }, children),
}));

describe("LocationFormFields", () => {
  it("renders the warning with the preset selector in the value column", () => {
    const markup = renderToStaticMarkup(
      createElement(LocationFormFields, {
        sectionLabel: "Regional preset",
        sectionHint: "Choose the preset this rule should use.",
        warning: createElement("span", null, "Privacy Thing does not replace VPN."),
        selectId: "dialog-rule-profile",
        selectLabel: "Preset",
        selectPlaceholder: "Choose preset",
        selectValue: "warsaw",
        selectOptions: [{ value: "warsaw", label: "Warsaw" }],
        onSelectValueChange: () => {},
      }),
    );

    expect(markup.indexOf("Preset")).toBeGreaterThan(-1);
    expect(markup.indexOf("Privacy Thing does not replace VPN.")).toBeGreaterThan(-1);
    expect(markup.indexOf("Preset")).toBeLessThan(
      markup.indexOf("Privacy Thing does not replace VPN."),
    );
    expect(markup).toContain('class="min-w-0 space-y-1"');
    expect(markup).toContain('class="text-xs text-muted-foreground"');
  });
});
