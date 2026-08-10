import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Checkbox } from "./checkbox";
import { Input } from "./input";
import { MultipleSelectListbox } from "./multiple-select-listbox";
import { NumberInput } from "./number-input";
import { Slider } from "./slider";
import { Switch } from "./switch";
import { Textarea } from "./textarea";

describe("form style contract", () => {
  it("keeps text-like controls on the shared form-control styling contract", () => {
    const markup = [
      renderToStaticMarkup(createElement(Input, { defaultValue: "abc" })),
      renderToStaticMarkup(createElement(Textarea, { defaultValue: "abc" })),
      renderToStaticMarkup(
        createElement(NumberInput, { value: 10, onChange: () => {} }),
      ),
    ].join("");

    expect(markup).toContain("gw-form-control");
    expect(markup).toContain("gw-form-focus-visible");
  });

  it("keeps toggles and listbox surfaces on shared form tokens", () => {
    const markup = [
      renderToStaticMarkup(
        createElement(Checkbox, { checked: true, onChange: () => {} }),
      ),
      renderToStaticMarkup(
        createElement(Switch, { checked: true, onCheckedChange: () => {} }),
      ),
      renderToStaticMarkup(createElement(Slider, { defaultValue: [50] })),
      renderToStaticMarkup(
        createElement(MultipleSelectListbox, {
          options: [{ value: "a", label: "Alpha" }],
          value: "a",
          onValueChange: () => {},
        }),
      ),
    ].join("");

    expect(markup).toContain("var(--gw-form-border-color)");
    expect(markup).toContain("var(--gw-form-chrome-border-color)");
    expect(markup).toContain("gw-form-panel-control");
    expect(markup).toContain("gw-form-focus-visible");
  });
});
