import { describe, expect, it } from "vitest";

import {
  detectLanguagePolicy,
  serializeAcceptLanguage,
} from "@/shared/accept-language";

describe("accept-language serializer", () => {
  it("serializes Chromium-style fallback expansion with weighted values", () => {
    expect(serializeAcceptLanguage(["en-US"], "chromium")).toBe("en-US,en;q=0.9");
    expect(serializeAcceptLanguage(["en-US", "fr-FR"], "chromium")).toBe(
      "en-US,en;q=0.9,fr-FR;q=0.8,fr;q=0.7",
    );
    expect(serializeAcceptLanguage(["en-US", "en-GB"], "chromium")).toBe(
      "en-US,en-GB;q=0.9,en;q=0.8",
    );
    expect(serializeAcceptLanguage(["en-US", "en"], "chromium")).toBe("en-US,en;q=0.9");
  });

  it("serializes Firefox-style weights without fallback expansion", () => {
    expect(serializeAcceptLanguage(["en-US"], "firefox")).toBe("en-US");
    expect(serializeAcceptLanguage(["en-US", "fr-FR"], "firefox")).toBe(
      "en-US,fr-FR;q=0.9",
    );
    expect(serializeAcceptLanguage(["en-US", "en-GB", "fr"], "firefox")).toBe(
      "en-US,en-GB;q=0.9,fr;q=0.8",
    );
  });

  it("reduces Brave default policy to the first preferred language", () => {
    expect(serializeAcceptLanguage(["en-US", "en", "fr"], "brave")).toBe("en-US");
    expect(serializeAcceptLanguage(["pl"], "brave")).toBe("pl");
  });

  it("deduplicates languages case-insensitively before serializing", () => {
    expect(serializeAcceptLanguage(["en-US", "en-us", "en"], "chromium")).toBe(
      "en-US,en;q=0.9",
    );
  });

  it("detects Brave from client hint brands", () => {
    expect(
      detectLanguagePolicy({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        userAgentData: {
          brands: [
            { brand: "Not A(Brand", version: "99" },
            { brand: "Brave", version: "139" },
            { brand: "Chromium", version: "139" },
          ],
        },
      }),
    ).toBe("brave");
  });

  it("falls back to browser family detection for Firefox", () => {
    expect(
      detectLanguagePolicy({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:140.0) Gecko/20100101 Firefox/140.0",
      }),
    ).toBe("firefox");
  });
});
