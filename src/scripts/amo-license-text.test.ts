import { describe, expect, it } from "vitest";

import { toAmoPlainTextLicense } from "../../scripts/amo-license-text.mjs";

describe("toAmoPlainTextLicense", () => {
  it.each([
    ["***No liability***", "No liability"],
    ["_**No liability**_", "No liability"],
    ["**No liability**", "No liability"],
  ])("strips emphasis from %s", (source, expected) => {
    expect(toAmoPlainTextLicense(source)).toBe(expected);
  });

  it("strips Prettier-normalized multiline emphasis", () => {
    const source = `_**As far as the law allows,
the software comes as is.**_`;

    expect(toAmoPlainTextLicense(source)).toBe(
      `As far as the law allows,
the software comes as is.`,
    );
  });
});
