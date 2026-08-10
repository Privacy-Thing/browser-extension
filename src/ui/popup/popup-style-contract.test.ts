import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import postcss from "postcss";
import { describe, expect, it } from "vitest";

const styleFiles = [
  "tokens.css",
  "layout.css",
  "primitives.css",
  "shell.css",
  "workspace.css",
  "motion.css",
] as const;

const styles = Object.fromEntries(
  styleFiles.map((file) => [
    file,
    readFileSync(new URL(`./styles/${file}`, import.meta.url), "utf8"),
  ]),
);

describe("popup style contract", () => {
  it("scopes document sizing to the real popup page", () => {
    const root = postcss.parse(styles["layout.css"]!, { from: "layout.css" });

    root.walkRules((rule) => {
      for (const selector of rule.selectors ?? []) {
        if (/\b(?:html|body)\b|#app/.test(selector)) {
          expect(selector, `layout.css: ${selector}`).toMatch(
            /^html\.gw-popup-document/,
          );
        }
      }
    });
  });

  it("keeps theme selectors in the token boundary and avoids cascade escapes", () => {
    for (const [file, css] of Object.entries(styles)) {
      expect(css, file).not.toContain("!important");
      if (file !== "tokens.css") {
        expect(css, file).not.toMatch(/\[data-theme=|\.high-contrast/);
        expect(css, file).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(/i);
      }
    }
  });

  it("keeps selectors shallow enough for component-level ownership", () => {
    for (const [file, css] of Object.entries(styles)) {
      const root = postcss.parse(css, { from: file });
      root.walkRules((rule) => {
        for (const selector of rule.selectors) {
          const qualifiers = selector.match(/[.#[]|:(?!:)/g)?.length ?? 0;
          const combinators = selector.match(/\s+[>+~]?\s*|[>+~]/g)?.length ?? 0;
          expect(qualifiers, `${file}: ${selector}`).toBeLessThanOrEqual(5);
          expect(combinators, `${file}: ${selector}`).toBeLessThanOrEqual(2);
        }
      });
    }
  });

  it("keeps production popup class lists concise", () => {
    const componentDirectory = fileURLToPath(new URL("./components/", import.meta.url));
    const sourceFiles = [
      fileURLToPath(new URL("./popup.tsx", import.meta.url)),
      ...readdirSync(componentDirectory)
        .filter((file) => file.endsWith(".tsx") && !file.includes(".test."))
        .map((file) => `${componentDirectory}/${file}`),
    ];

    for (const sourceFile of sourceFiles) {
      const source = readFileSync(sourceFile, "utf8");
      for (const match of source.matchAll(/className\s*=\s*["']([^"']+)["']/g)) {
        const classCount = match[1]!.trim().split(/\s+/).length;
        expect(classCount, `${sourceFile}: ${match[1]}`).toBeLessThanOrEqual(3);
      }
    }
  });
});
