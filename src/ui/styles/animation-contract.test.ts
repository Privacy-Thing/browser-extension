import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

describe("shared animated surface contract", () => {
  it("keeps dialogs on the shared animated accent surface", () => {
    expect(styles).toContain(".gw-dialog-surface {");
    expect(styles).toContain(".gw-animated-accent-border::before");
    expect(styles).toContain(
      "gw-animated-border-rotate var(--gw-animated-border-animation-duration)",
    );
    expect(styles).toContain("--gw-dialog-border-width: 4px");
  });

  it("switches animated borders to their static accent under reduced motion", () => {
    expect(styles).toContain(":root[data-reduce-motion] .gw-animated-accent-border");
    expect(styles).toContain("--gw-animated-border-animation: none");
    expect(styles).toContain(
      "--gw-animated-border-background: var(--gw-animated-border-static-accent)",
    );
  });
});
