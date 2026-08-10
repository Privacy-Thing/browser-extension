import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FormSection } from "./form-section";

describe("FormSection", () => {
  it("keeps horizontal overflow visible for open content", () => {
    const markup = renderToStaticMarkup(
      <FormSection title="Locale" collapsible open>
        <div>Field</div>
      </FormSection>,
    );

    expect(markup).toContain("overflow-x-visible");
    expect(markup).toContain("overflow-y-clip");
    expect(markup).not.toContain("overflow-hidden");
  });

  it("clips closed content for collapse animation", () => {
    const markup = renderToStaticMarkup(
      <FormSection title="Locale" collapsible open={false}>
        <div>Field</div>
      </FormSection>,
    );

    expect(markup).toContain("overflow-hidden");
  });
});
