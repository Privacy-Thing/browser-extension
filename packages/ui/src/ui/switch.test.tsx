import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Switch } from "./switch";

describe("Switch", () => {
  it("renders the thumb with the shared foreground token", () => {
    const markup = renderToStaticMarkup(
      createElement(Switch, { checked: true, onCheckedChange: () => {} }),
    );

    expect(markup).toContain("bg-[color:var(--gw-form-foreground)]");
    expect(markup).toContain("data-[state=checked]:bg-primary");
  });
});
