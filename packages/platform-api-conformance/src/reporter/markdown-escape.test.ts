import { describe, expect, it } from "vitest";

import { escapeMarkdownInline, escapeMarkdownTableCell } from "./markdown-escape.js";

describe("Markdown escaping", () => {
  it("escapes table delimiters after existing backslashes", () => {
    expect(escapeMarkdownTableCell("left\\|right")).toBe("left\\\\\\|right");
  });

  it("neutralizes inline markup and line breaks", () => {
    expect(escapeMarkdownInline("`api` <b>x</b>\r\nnext & final")).toBe(
      "&#96;api&#96; &lt;b&gt;x&lt;/b&gt; next &amp; final",
    );
  });
});
