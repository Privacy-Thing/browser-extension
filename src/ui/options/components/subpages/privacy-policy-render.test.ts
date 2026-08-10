// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  applyLegalSemantics,
  renderLegalMarkdown,
} from "@/ui/options/components/subpages/legal-document-render";
import {
  applyPrivacyPolicySemantics,
  renderPrivacyPolicyMarkdown,
} from "@/ui/options/components/subpages/privacy-policy-render";

describe("privacy policy rendering", () => {
  it("adds stable ids to rendered headings", () => {
    const markup = renderPrivacyPolicyMarkdown(`# Privacy Policy\n\n## Summary`);

    expect(markup).toContain('<h1 id="privacy-policy">Privacy Policy</h1>');
    expect(markup).toContain('<h2 id="summary">Summary</h2>');
  });

  it("labels the article with the first heading", () => {
    const root = document.createElement("article");
    root.innerHTML = renderPrivacyPolicyMarkdown(`# Privacy Policy\n\nPolicy text.`);

    applyPrivacyPolicySemantics(root);

    expect(root.getAttribute("aria-labelledby")).toBe("privacy-policy");
  });

  it("renders legal license references as interactive buttons when enabled", () => {
    const markup = renderLegalMarkdown("See `licenses/Apache-2.0.txt`", {
      renderLicenseButtons: true,
    });

    expect(markup).toContain("<p>See ");
    expect(markup).toContain('class="gw-license-link"');
    expect(markup).toContain('data-license-path="licenses/Apache-2.0.txt"');
    expect(markup).not.toContain(">See <code>");
  });

  it("renders inline legal document references as interactive buttons when enabled", () => {
    const markup = renderLegalMarkdown(
      "See `licenses/privacything/THIRD_PARTY_NOTICES.md` and compare with `NOTICE.md`.",
      {
        renderLicenseButtons: true,
      },
    );

    expect(markup).toContain(
      'data-license-path="licenses/privacything/THIRD_PARTY_NOTICES.md"',
    );
    expect(markup).toContain('data-license-path="NOTICE.md"');
    expect(markup).toContain("> and compare with <");
  });

  it("can strip directory names from rendered legal references", () => {
    const markup = renderLegalMarkdown(
      "See `licenses/privacything/THIRD_PARTY_NOTICES.md`.",
      {
        renderLicenseButtons: true,
        stripReferenceDirs: true,
      },
    );

    expect(markup).toContain(
      'data-license-path="licenses/privacything/THIRD_PARTY_NOTICES.md"',
    );
    expect(markup).toContain("<code>THIRD_PARTY_NOTICES.md</code>");
    expect(markup).not.toContain(
      "<code>licenses/privacything/THIRD_PARTY_NOTICES.md</code>",
    );
  });

  it("can route selected legal references to in-app subpages", () => {
    const markup = renderLegalMarkdown(
      "See `licenses/privacything/THIRD_PARTY_NOTICES.md`.",
      {
        renderLicenseButtons: true,
        stripReferenceDirs: true,
        legalReferenceHrefByPath: {
          "licenses/privacything/THIRD_PARTY_NOTICES.md": "#page-third-party-notices",
        },
      },
    );

    expect(markup).toContain('href="#page-third-party-notices"');
    expect(markup).toContain('<a class="gw-license-link"');
    expect(markup).not.toContain(
      'data-license-path="licenses/privacything/THIRD_PARTY_NOTICES.md"',
    );
  });

  it("preserves line breaks in structured legal metadata blocks", () => {
    const markup = renderLegalMarkdown(
      "## Jetbrains Mono\n\nPackage: `@fontsource/jetbrains-mono`\nCopyright 2020 The JetBrains Mono Project Authors\nWebsite: https://fontsource.org/fonts/jetbrains-mono",
    );

    expect(markup).toContain('<h2 id="jetbrains-mono">Jetbrains Mono</h2>');
    expect(markup).toContain(
      '<p>Package: <code>@fontsource/jetbrains-mono</code><br />Copyright 2020 The JetBrains Mono Project Authors<br />Website: <a href="https://fontsource.org/fonts/jetbrains-mono" target="_blank" rel="noopener noreferrer">https://fontsource.org/fonts/jetbrains-mono</a></p>',
    );
  });

  it("keeps non-license inline code escaped as code spans", () => {
    const markup = renderLegalMarkdown("Compare `a < b` without executing HTML.");

    expect(markup).toContain("<code>a &lt; b</code>");
    expect(markup).not.toContain("<code>a < b</code>");
  });

  it("renders angle-bracket URLs as links", () => {
    const markup = renderLegalMarkdown(
      "Original project: <https://github.com/Privacy-Thing/browser-extension>",
    );

    expect(markup).toContain(
      '<a href="https://github.com/Privacy-Thing/browser-extension" target="_blank" rel="noopener noreferrer">https://github.com/Privacy-Thing/browser-extension</a>',
    );
    expect(markup).not.toContain(
      "&lt;https://github.com/Privacy-Thing/browser-extension&gt;",
    );
  });

  it("renders bare URLs as links", () => {
    const markup = renderLegalMarkdown(
      "Original project: https://github.com/Privacy-Thing/browser-extension",
    );

    expect(markup).toContain(
      '<a href="https://github.com/Privacy-Thing/browser-extension" target="_blank" rel="noopener noreferrer">https://github.com/Privacy-Thing/browser-extension</a>',
    );
  });

  it("keeps trailing punctuation outside bare URL links", () => {
    const markup = renderLegalMarkdown("Visit http://example.com, then compare.");

    expect(markup).toContain(
      '<a href="http://example.com" target="_blank" rel="noopener noreferrer">http://example.com</a>, then compare.',
    );
    expect(markup).not.toContain('href="http://example.com,"');
  });

  it("keeps balanced parentheses inside bare URL links", () => {
    const markup = renderLegalMarkdown(
      "Reference: https://en.wikipedia.org/wiki/Function_(mathematics).",
    );

    expect(markup).toContain(
      '<a href="https://en.wikipedia.org/wiki/Function_(mathematics)" target="_blank" rel="noopener noreferrer">https://en.wikipedia.org/wiki/Function_(mathematics)</a>.',
    );
  });

  it("does not autolink URLs inside inline code", () => {
    const markup = renderLegalMarkdown("Run `curl https://example.com` manually.");

    expect(markup).toContain("<code>curl https://example.com</code>");
    expect(markup).not.toContain('href="https://example.com"');
  });

  it("renders blockquotes from markdown quote lines", () => {
    const markup = renderLegalMarkdown(
      "> Based on Privacy Thing by Tomasz Janusz — <https://github.com/Privacy-Thing/browser-extension>",
    );

    expect(markup).toContain("<blockquote><p>Based on Privacy Thing by Tomasz Janusz");
    expect(markup).toContain(
      '<a href="https://github.com/Privacy-Thing/browser-extension" target="_blank" rel="noopener noreferrer">https://github.com/Privacy-Thing/browser-extension</a>',
    );
    expect(markup).toContain("</p></blockquote>");
  });

  it("labels legal documents with the first rendered heading", () => {
    const root = document.createElement("article");
    root.innerHTML = renderLegalMarkdown("## Third-Party Notices");

    applyLegalSemantics(root, "third-party-notices");

    expect(root.getAttribute("aria-labelledby")).toBe("third-party-notices");
  });
});
