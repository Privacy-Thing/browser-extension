import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearFingerprintCache,
  createBrowserFingerprint,
  detectBrowserFamily,
  deriveAppVersion,
  fuzzBrowserUserAgent,
  fuzzBrowserUaVersion,
  isSameBrowserFamily,
  fuzzChromiumUaVersion,
  fuzzChromiumUserAgent,
  parseBrowserUaVersion,
  parseChromiumUaVersion,
  quoteHeaderString,
  readFingerprintSource,
  serializeHintBrands,
} from "@/shared/browser-fingerprint";

const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7204.62 Safari/537.36";
const FIREFOX_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:139.0) Gecko/20100101 Firefox/139.0";
const SAFARI_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const EDGE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7204.62 Safari/537.36 Edg/139.0.3561.72";
const OPERA_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7204.62 Safari/537.36 OPR/114.0.5765.88";
const BRAVE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const REDUCED_CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";
const REDUCED_EDGE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0";

afterEach(() => {
  clearFingerprintCache();
  vi.unstubAllGlobals();
});

describe("browser fingerprint helpers", () => {
  it("escapes backslashes before quotes in structured header strings", () => {
    expect(quoteHeaderString('Brand\\"Name')).toBe('"Brand\\\\\\"Name"');
    expect(serializeHintBrands([{ brand: 'Brand\\"Name', version: '1\\"2' }])).toBe(
      '"Brand\\\\\\"Name";v="1\\\\\\"2"',
    );
  });

  it("caches high entropy client hints for the process lifetime", async () => {
    const getHighEntropyValues = vi.fn(async () => ({
      brands: [{ brand: "Chromium", version: "149" }],
      fullVersionList: [{ brand: "Chromium", version: "149.0.0.0" }],
      mobile: false,
      platform: "macOS",
    }));
    vi.stubGlobal("navigator", {
      userAgent: CHROME_UA,
      platform: "MacIntel",
      vendor: "Google Inc.",
      hardwareConcurrency: 8,
      userAgentData: {
        brands: [{ brand: "Chromium", version: "149" }],
        getHighEntropyValues,
      },
    });

    const first = await readFingerprintSource();
    const second = await readFingerprintSource();

    expect(first).toEqual(second);
    expect(getHighEntropyValues).toHaveBeenCalledTimes(1);
  });

  it("parses Chromium UA versions", () => {
    expect(parseChromiumUaVersion(CHROME_UA)).toEqual({
      product: "Chrome",
      fullVersion: "139.0.7204.62",
      major: 139,
      minor: 0,
      build: 7204,
      patch: 62,
    });
  });

  it("parses non-Chromium UA versions for userAgent spoofing", () => {
    expect(parseBrowserUaVersion(FIREFOX_UA)).toEqual({
      family: "firefox",
      product: "Firefox",
      fullVersion: "139.0",
      major: 139,
      minor: 0,
    });
    expect(parseBrowserUaVersion(SAFARI_UA)).toEqual({
      family: "safari",
      product: "Version",
      fullVersion: "17.5",
      major: 17,
      minor: 5,
    });
  });

  it("detects browser family from recognizable UA strings", () => {
    expect(detectBrowserFamily(CHROME_UA)).toBe("chromium");
    expect(detectBrowserFamily(FIREFOX_UA)).toBe("firefox");
    expect(detectBrowserFamily(SAFARI_UA)).toBe("safari");
    expect(detectBrowserFamily("Unknown UA")).toBeUndefined();
  });

  it("matches browser families only when both UAs are known and equal", () => {
    expect(isSameBrowserFamily(CHROME_UA, EDGE_UA)).toBe(true);
    expect(isSameBrowserFamily(CHROME_UA, FIREFOX_UA)).toBe(false);
    expect(isSameBrowserFamily(CHROME_UA, "Unknown UA")).toBe(false);
  });

  it("fuzzes Chromium builds deterministically within a small range", () => {
    const first = fuzzChromiumUaVersion(CHROME_UA);
    const second = fuzzChromiumUaVersion(CHROME_UA);

    expect(first).toEqual(second);
    expect(first?.major).toBe(139);
    expect(first?.minor).toBe(0);
    expect(Math.abs((first?.build ?? 0) - 7204)).toBeLessThanOrEqual(3);
    expect(first?.patch).toBeGreaterThanOrEqual(10);
    expect(first?.patch).toBeLessThanOrEqual(99);
  });

  it("keeps appVersion derived from the spoofed UA string", () => {
    const userAgent = fuzzChromiumUserAgent(CHROME_UA);

    expect(userAgent).not.toBe(CHROME_UA);
    expect(deriveAppVersion(userAgent)).toBe(userAgent.replace(/^Mozilla\//, ""));
  });

  it("fuzzes Firefox and Safari UA versions independently of Client Hints", () => {
    const firefoxVersion = fuzzBrowserUaVersion(FIREFOX_UA);
    const safariVersion = fuzzBrowserUaVersion(SAFARI_UA);
    const firefoxUserAgent = fuzzBrowserUserAgent(FIREFOX_UA);

    expect(firefoxVersion?.family).toBe("firefox");
    expect(firefoxVersion?.major).toBe(139);
    expect(Math.abs((firefoxVersion?.minor ?? 0) - 0)).toBeLessThanOrEqual(3);
    expect(firefoxUserAgent).toContain(`Firefox/${firefoxVersion?.fullVersion}`);
    expect(firefoxUserAgent).toContain(`rv:${firefoxVersion?.fullVersion}`);

    expect(safariVersion?.family).toBe("safari");
    expect(safariVersion?.major).toBe(17);
    expect(Math.abs((safariVersion?.minor ?? 0) - 5)).toBeLessThanOrEqual(3);
    expect(fuzzBrowserUserAgent(SAFARI_UA)).toContain(
      `Version/${safariVersion?.fullVersion}`,
    );
  });

  it("builds coherent Client Hints from the fuzzed UA", () => {
    const fingerprint = createBrowserFingerprint(
      {
        userAgent: CHROME_UA,
        platform: "MacIntel",
        vendor: "Google Inc.",
        hardwareConcurrency: 8,
        deviceMemory: 8,
        userAgentData: {
          brands: [
            { brand: "Not A(Brand", version: "99" },
            { brand: "Google Chrome", version: "139" },
            { brand: "Chromium", version: "139" },
          ],
          mobile: false,
          platform: "macOS",
        },
      },
      true,
    );

    const parsed = parseChromiumUaVersion(fingerprint?.userAgent ?? "");

    expect(fingerprint).toBeDefined();
    if (!fingerprint) {
      throw new Error("Expected fingerprint to be created");
    }
    expect(fingerprint?.hardwareConcurrency).toBe(8);
    expect(fingerprint?.deviceMemory).toBe(8);
    expect(fingerprint?.vendor).toBe("Google Inc.");
    expect(fingerprint.appVersion).toBe(deriveAppVersion(fingerprint.userAgent ?? ""));
    expect(fingerprint?.clientHints?.brands).toEqual([
      { brand: "Not A(Brand", version: "99" },
      { brand: "Google Chrome", version: String(parsed?.major) },
      { brand: "Chromium", version: String(parsed?.major) },
    ]);
    expect(fingerprint?.clientHints?.fullVersionList).toContainEqual({
      brand: "Google Chrome",
      version: parsed?.fullVersion,
    });
    expect(serializeHintBrands(fingerprint?.clientHints?.brands)).toContain(
      '"Google Chrome";v="139"',
    );
  });

  it("uses the version seed to rotate Chromium UA and fullVersionList", () => {
    const source = {
      userAgent: CHROME_UA,
      platform: "MacIntel",
      vendor: "Google Inc.",
      userAgentData: {
        brands: [
          { brand: "Not A(Brand", version: "99" },
          { brand: "Google Chrome", version: "139" },
          { brand: "Chromium", version: "139" },
        ],
        fullVersionList: [
          { brand: "Not A(Brand", version: "99.0.0.0" },
          { brand: "Google Chrome", version: "139.0.7204.62" },
          { brand: "Chromium", version: "139.0.7204.62" },
        ],
        mobile: false,
        platform: "macOS",
      },
    } as const;

    const first = createBrowserFingerprint(source, true, {
      versionSeedKey: "seed01",
    });
    const second = createBrowserFingerprint(source, true, {
      versionSeedKey: "seed01",
    });
    const third = createBrowserFingerprint(source, true, {
      versionSeedKey: "seed02",
    });

    expect(first?.userAgent).toBe(second?.userAgent);
    expect(first?.appVersion).toBe(second?.appVersion);
    expect(first?.clientHints?.fullVersionList).toEqual(
      second?.clientHints?.fullVersionList,
    );
    expect(first?.userAgent).not.toBe(third?.userAgent);
    expect(first?.appVersion).not.toBe(third?.appVersion);
    expect(first?.clientHints?.fullVersionList).not.toEqual(
      third?.clientHints?.fullVersionList,
    );
  });

  it("keeps native Chromium versions when version rotation is disabled", () => {
    const fingerprint = createBrowserFingerprint(
      {
        userAgent: CHROME_UA,
        platform: "MacIntel",
        vendor: "Google Inc.",
        userAgentData: {
          brands: [
            { brand: "Not A(Brand", version: "99" },
            { brand: "Google Chrome", version: "139" },
            { brand: "Chromium", version: "139" },
          ],
          mobile: false,
          platform: "macOS",
        },
      },
      true,
      { rotateChromiumVersion: false },
    );

    expect(fingerprint?.userAgent).toBe(CHROME_UA);
    expect(fingerprint?.appVersion).toBe(deriveAppVersion(CHROME_UA));
    expect(fingerprint?.clientHints?.brands).toEqual([
      { brand: "Not A(Brand", version: "99" },
      { brand: "Google Chrome", version: "139" },
      { brand: "Chromium", version: "139" },
    ]);
    expect(fingerprint?.clientHints?.fullVersionList).toEqual([
      { brand: "Not A(Brand", version: "99" },
      { brand: "Google Chrome", version: "139.0.7204.62" },
      { brand: "Chromium", version: "139.0.7204.62" },
    ]);
  });

  it("does not invent OS-only high entropy Client Hints", () => {
    const fingerprint = createBrowserFingerprint(
      {
        userAgent: CHROME_UA,
        platform: "Linux x86_64",
        vendor: "Google Inc.",
        userAgentData: {
          brands: [{ brand: "Google Chrome", version: "139" }],
          mobile: false,
          platform: "Linux",
        },
      },
      true,
    );

    expect(fingerprint?.clientHints).toEqual(
      expect.not.objectContaining({
        architecture: expect.anything(),
        bitness: expect.anything(),
        formFactors: expect.anything(),
        model: expect.anything(),
        platformVersion: expect.anything(),
        wow64: expect.anything(),
      }),
    );
  });

  it("builds UA/appVersion for non-Chromium without inventing Client Hints", () => {
    const fingerprint = createBrowserFingerprint(
      {
        userAgent: FIREFOX_UA,
        platform: "MacIntel",
        vendor: "",
      },
      true,
    );

    expect(fingerprint?.userAgent).toContain("Firefox/139.");
    expect(fingerprint?.appVersion).toBe(
      deriveAppVersion(fingerprint?.userAgent ?? ""),
    );
    expect(fingerprint?.clientHints).toBeUndefined();
  });

  it("returns undefined when disabled", () => {
    expect(createBrowserFingerprint({ userAgent: CHROME_UA }, false)).toBeUndefined();
  });

  describe("Microsoft Edge UA and Client Hints", () => {
    it("parses Edge UA Chrome token", () => {
      expect(parseChromiumUaVersion(EDGE_UA)).toEqual({
        product: "Chrome",
        fullVersion: "139.0.7204.62",
        major: 139,
        minor: 0,
        build: 7204,
        patch: 62,
      });
    });

    it("fuzzes Edge UA with Edg/ token in sync with Chrome/ token", () => {
      const fuzzed = fuzzBrowserUserAgent(EDGE_UA);
      const chromeMatch = fuzzed.match(/Chrome\/(\d+)\.\d+\.\d+\.\d+/);
      const edgMatch = fuzzed.match(/Edg\/(\d+)\.\d+\.\d+\.\d+/);

      expect(chromeMatch).not.toBeNull();
      expect(edgMatch).not.toBeNull();
      // Edg/ token must be modified (not the original value)
      expect(fuzzed).not.toContain("Edg/139.0.3561.72");
      // Edg major version must match Chrome major version
      expect(edgMatch![1]).toBe(chromeMatch![1]);
    });

    it("createBrowserFingerprint aligns 'Microsoft Edge' brand versions", () => {
      const fingerprint = createBrowserFingerprint(
        {
          userAgent: EDGE_UA,
          platform: "Win32",
          vendor: "Google Inc.",
          userAgentData: {
            brands: [
              { brand: "Not A(Brand", version: "99" },
              { brand: "Microsoft Edge", version: "139" },
              { brand: "Chromium", version: "139" },
            ],
            fullVersionList: [
              { brand: "Not A(Brand", version: "99.0.0.0" },
              { brand: "Microsoft Edge", version: "139.0.3561.72" },
              { brand: "Chromium", version: "139.0.7204.62" },
            ],
            mobile: false,
            platform: "Windows",
          },
        },
        true,
      );

      expect(fingerprint).toBeDefined();
      expect(fingerprint!.userAgent).toBeDefined();
      const parsed = parseChromiumUaVersion(fingerprint!.userAgent!);
      expect(parsed).not.toBeNull();

      // "Microsoft Edge" low-entropy brand must be aligned with fuzzed major
      const edgeBrand = fingerprint!.clientHints?.brands?.find(
        (b) => b.brand === "Microsoft Edge",
      );
      expect(edgeBrand).toBeDefined();
      expect(edgeBrand!.version).toBe(String(parsed!.major));

      // "Microsoft Edge" full-version brand must be aligned with fuzzed full version
      const edgeFullBrand = fingerprint!.clientHints?.fullVersionList?.find(
        (b) => b.brand === "Microsoft Edge",
      );
      expect(edgeFullBrand).toBeDefined();
      expect(edgeFullBrand!.version).toBe(parsed!.fullVersion);
    });

    it("serialized Sec-CH-UA contains aligned Edge brand version", () => {
      const fingerprint = createBrowserFingerprint(
        {
          userAgent: EDGE_UA,
          platform: "Win32",
          vendor: "Google Inc.",
          userAgentData: {
            brands: [
              { brand: "Not A(Brand", version: "99" },
              { brand: "Microsoft Edge", version: "139" },
              { brand: "Chromium", version: "139" },
            ],
            mobile: false,
            platform: "Windows",
          },
        },
        true,
      );

      const serialized = serializeHintBrands(fingerprint?.clientHints?.brands);
      expect(serialized).toBeDefined();
      expect(serialized).toContain('"Microsoft Edge";v="139"');
      expect(serialized).toContain('"Chromium";v="139"');
    });
  });

  describe("Opera UA and Client Hints", () => {
    it("parses Opera UA Chrome token", () => {
      expect(parseChromiumUaVersion(OPERA_UA)).toEqual({
        product: "Chrome",
        fullVersion: "139.0.7204.62",
        major: 139,
        minor: 0,
        build: 7204,
        patch: 62,
      });
    });

    it("fuzzes Opera UA with OPR/ token in sync with Chrome/ token", () => {
      const fuzzed = fuzzBrowserUserAgent(OPERA_UA);
      const chromeMatch = fuzzed.match(/Chrome\/(\d+)\.\d+\.\d+\.\d+/);
      const oprMatch = fuzzed.match(/OPR\/(\d+)\.\d+\.\d+\.\d+/);

      expect(chromeMatch).not.toBeNull();
      expect(oprMatch).not.toBeNull();
      // OPR/ token must be modified (not the original value)
      expect(fuzzed).not.toContain("OPR/114.0.5765.88");
      // OPR major version should be fuzzed (not left at original 114)
      expect(oprMatch![1]).not.toBe("114");
    });

    it("createBrowserFingerprint aligns 'Opera' brand versions", () => {
      const fingerprint = createBrowserFingerprint(
        {
          userAgent: OPERA_UA,
          platform: "Win32",
          vendor: "Google Inc.",
          userAgentData: {
            brands: [
              { brand: "Not A(Brand", version: "99" },
              { brand: "Opera", version: "114" },
              { brand: "Chromium", version: "139" },
            ],
            fullVersionList: [
              { brand: "Not A(Brand", version: "99.0.0.0" },
              { brand: "Opera", version: "114.0.5765.88" },
              { brand: "Chromium", version: "139.0.7204.62" },
            ],
            mobile: false,
            platform: "Windows",
          },
        },
        true,
      );

      expect(fingerprint).toBeDefined();

      // "Opera" brand must be aligned (not left at original version)
      const operaBrand = fingerprint!.clientHints?.brands?.find(
        (b) => b.brand === "Opera",
      );
      expect(operaBrand).toBeDefined();
      expect(operaBrand!.version).not.toBe("114");

      const operaFullBrand = fingerprint!.clientHints?.fullVersionList?.find(
        (b) => b.brand === "Opera",
      );
      expect(operaFullBrand).toBeDefined();
      expect(operaFullBrand!.version).not.toBe("114.0.5765.88");
    });
  });

  describe("Brave browser privacy preservation", () => {
    it("preserves .0.0.0 in UA string for Brave (reduced UA)", () => {
      const fuzzed = fuzzBrowserUserAgent(BRAVE_UA);
      // Brave uses reduced UA natively; must not inject non-zero build/patch
      expect(fuzzed).toContain("Chrome/139.0.0.0");
    });

    it("does not unmask Brave Client Hints that use .0.0.0 fullVersionList", () => {
      const fingerprint = createBrowserFingerprint(
        {
          userAgent: BRAVE_UA,
          platform: "Win32",
          vendor: "Google Inc.",
          userAgentData: {
            brands: [
              { brand: "Not A(Brand", version: "99" },
              { brand: "Brave", version: "139" },
              { brand: "Chromium", version: "139" },
            ],
            // Brave natively forces .0.0.0 in fullVersionList as a privacy feature
            fullVersionList: [
              { brand: "Not A(Brand", version: "99.0.0.0" },
              { brand: "Brave", version: "139.0.0.0" },
              { brand: "Chromium", version: "139.0.0.0" },
            ],
            mobile: false,
            platform: "Windows",
          },
        },
        true,
      );

      expect(fingerprint).toBeDefined();

      // Chromium fullVersionList must preserve .0.0.0 (Brave's privacy choice)
      const chromiumFull = fingerprint!.clientHints?.fullVersionList?.find(
        (b) => b.brand === "Chromium",
      );
      expect(chromiumFull).toBeDefined();
      expect(chromiumFull!.version).toBe("139.0.0.0");
    });

    it("aligns 'Brave' brand versions with Chromium", () => {
      const fingerprint = createBrowserFingerprint(
        {
          userAgent: BRAVE_UA,
          platform: "Win32",
          vendor: "Google Inc.",
          userAgentData: {
            brands: [
              { brand: "Not A(Brand", version: "99" },
              { brand: "Brave", version: "139" },
              { brand: "Chromium", version: "139" },
            ],
            mobile: false,
            platform: "Windows",
          },
        },
        true,
      );

      expect(fingerprint).toBeDefined();

      // "Brave" brand must be aligned with Chromium (not left untouched)
      const braveBrand = fingerprint!.clientHints?.brands?.find(
        (b) => b.brand === "Brave",
      );
      const chromiumBrand = fingerprint!.clientHints?.brands?.find(
        (b) => b.brand === "Chromium",
      );
      expect(braveBrand).toBeDefined();
      expect(chromiumBrand).toBeDefined();
      expect(braveBrand!.version).toBe(chromiumBrand!.version);
    });
  });

  describe("User-Agent Reduction (.0.0.0 pattern)", () => {
    it("parses reduced UA with .0.0.0 build/patch", () => {
      expect(parseChromiumUaVersion(REDUCED_CHROME_UA)).toEqual({
        product: "Chrome",
        fullVersion: "146.0.0.0",
        major: 146,
        minor: 0,
        build: 0,
        patch: 0,
      });
    });

    it("fuzzed version preserves .0.0.0 for reduced UAs", () => {
      const fuzzed = fuzzChromiumUaVersion(REDUCED_CHROME_UA);
      expect(fuzzed).not.toBeNull();
      expect(fuzzed!.major).toBe(146);
      expect(fuzzed!.minor).toBe(0);
      expect(fuzzed!.build).toBe(0);
      expect(fuzzed!.patch).toBe(0);
      expect(fuzzed!.fullVersion).toBe("146.0.0.0");
    });

    it("fuzzed UA string keeps .0.0.0 for reduced UAs", () => {
      const fuzzed = fuzzBrowserUserAgent(REDUCED_CHROME_UA);
      expect(fuzzed).toContain("Chrome/146.0.0.0");
    });

    it("createBrowserFingerprint: UA has .0.0.0 but Client Hints have realistic full version", () => {
      const fingerprint = createBrowserFingerprint(
        {
          userAgent: REDUCED_CHROME_UA,
          platform: "Win32",
          vendor: "Google Inc.",
          userAgentData: {
            brands: [
              { brand: "Not A(Brand", version: "99" },
              { brand: "Google Chrome", version: "146" },
              { brand: "Chromium", version: "146" },
            ],
            fullVersionList: [
              { brand: "Not A(Brand", version: "99.0.0.0" },
              { brand: "Google Chrome", version: "146.0.7694.48" },
              { brand: "Chromium", version: "146.0.7694.48" },
            ],
            mobile: false,
            platform: "Windows",
          },
        },
        true,
      );

      expect(fingerprint).toBeDefined();

      // UA string must keep .0.0.0 (UA Reduction)
      expect(fingerprint!.userAgent).toContain("Chrome/146.0.0.0");

      // Client Hints fullVersionList must have a realistic 4-digit build number
      const chromeFull = fingerprint!.clientHints?.fullVersionList?.find(
        (b) => b.brand === "Google Chrome",
      );
      expect(chromeFull).toBeDefined();
      const fullVersionParts = chromeFull!.version.split(".");
      expect(fullVersionParts[0]).toBe("146");
      expect(Number(fullVersionParts[2])).toBeGreaterThanOrEqual(1000);
    });

    it("generates a realistic fullVersionList fallback when reduced UA lacks native full versions", () => {
      const fingerprint = createBrowserFingerprint(
        {
          userAgent: REDUCED_CHROME_UA,
          platform: "Win32",
          vendor: "Google Inc.",
          userAgentData: {
            brands: [
              { brand: "Not A(Brand", version: "99" },
              { brand: "Google Chrome", version: "146" },
              { brand: "Chromium", version: "146" },
            ],
            mobile: false,
            platform: "Windows",
          },
        },
        true,
      );

      expect(fingerprint!.userAgent).toContain("Chrome/146.0.0.0");
      const chromeFull = fingerprint!.clientHints?.fullVersionList?.find(
        (b) => b.brand === "Google Chrome",
      );
      expect(chromeFull).toBeDefined();
      expect(chromeFull!.version).toMatch(/^146\.0\.\d{4}\.\d{1,2}$/);
    });

    it("rotates native fullVersionList when reduced UA already exposes full client hints", () => {
      const fingerprint = createBrowserFingerprint(
        {
          userAgent: REDUCED_CHROME_UA,
          platform: "Win32",
          vendor: "Google Inc.",
          userAgentData: {
            brands: [
              { brand: "Not A(Brand", version: "99" },
              { brand: "Google Chrome", version: "146" },
              { brand: "Chromium", version: "146" },
            ],
            fullVersionList: [
              { brand: "Not A(Brand", version: "99.0.0.0" },
              { brand: "Google Chrome", version: "146.0.7694.48" },
              { brand: "Chromium", version: "146.0.7694.48" },
            ],
            mobile: false,
            platform: "Windows",
          },
        },
        true,
      );

      expect(fingerprint!.userAgent).toContain("Chrome/146.0.0.0");
      const chromeFull = fingerprint!.clientHints?.fullVersionList?.find(
        (b) => b.brand === "Google Chrome",
      );
      expect(chromeFull).toBeDefined();
      expect(chromeFull!.version).toMatch(/^146\.0\.\d{4}\.\d{1,2}$/);
      expect(chromeFull!.version).not.toBe("146.0.7694.48");
    });

    it("uses the version seed to rotate reduced Chromium fullVersionList", () => {
      const source = {
        userAgent: REDUCED_CHROME_UA,
        platform: "Win32",
        vendor: "Google Inc.",
        userAgentData: {
          brands: [
            { brand: "Not A(Brand", version: "99" },
            { brand: "Google Chrome", version: "146" },
            { brand: "Chromium", version: "146" },
          ],
          fullVersionList: [
            { brand: "Not A(Brand", version: "99.0.0.0" },
            { brand: "Google Chrome", version: "146.0.7694.48" },
            { brand: "Chromium", version: "146.0.7694.48" },
          ],
          mobile: false,
          platform: "Windows",
        },
      } as const;

      const first = createBrowserFingerprint(source, true, {
        versionSeedKey: "seed01",
      });
      const second = createBrowserFingerprint(source, true, {
        versionSeedKey: "seed02",
      });

      expect(first?.userAgent).toContain("Chrome/146.0.0.0");
      expect(second?.userAgent).toContain("Chrome/146.0.0.0");
      expect(first?.clientHints?.fullVersionList).not.toEqual(
        second?.clientHints?.fullVersionList,
      );
    });

    it("keeps Brave reduced Client Hints reduced when native full versions are unavailable", () => {
      const fingerprint = createBrowserFingerprint(
        {
          userAgent: BRAVE_UA,
          platform: "Win32",
          vendor: "Google Inc.",
          userAgentData: {
            brands: [
              { brand: "Not A(Brand", version: "99" },
              { brand: "Brave", version: "139" },
              { brand: "Chromium", version: "139" },
            ],
            mobile: false,
            platform: "Windows",
          },
        },
        true,
      );

      const chromiumFull = fingerprint!.clientHints?.fullVersionList?.find(
        (b) => b.brand === "Chromium",
      );
      expect(chromiumFull?.version).toBe("139.0.0.0");
    });

    it("Edge reduced UA preserves .0.0.0 in both Chrome/ and Edg/ tokens", () => {
      const fuzzed = fuzzBrowserUserAgent(REDUCED_EDGE_UA);
      expect(fuzzed).toContain("Chrome/146.0.0.0");
      expect(fuzzed).toContain("Edg/146.0.0.0");
    });
  });

  describe("Firefox UA spoofing (no Client Hints)", () => {
    it("Firefox fingerprint has no Client Hints", () => {
      const fingerprint = createBrowserFingerprint(
        {
          userAgent: FIREFOX_UA,
          platform: "MacIntel",
          vendor: "",
        },
        true,
      );

      expect(fingerprint).toBeDefined();
      expect(fingerprint!.clientHints).toBeUndefined();
    });

    it("Firefox UA fuzzing keeps rv: and Firefox/ tokens in sync", () => {
      const fuzzed = fuzzBrowserUserAgent(FIREFOX_UA);
      const firefoxMatch = fuzzed.match(/Firefox\/(\d+\.\d+)/);
      const rvMatch = fuzzed.match(/rv:(\d+\.\d+)/);

      expect(firefoxMatch).not.toBeNull();
      expect(rvMatch).not.toBeNull();
      expect(firefoxMatch![1]).toBe(rvMatch![1]);
    });

    it("Firefox fingerprint does not leak Chromium artifacts", () => {
      const fingerprint = createBrowserFingerprint(
        {
          userAgent: FIREFOX_UA,
          platform: "MacIntel",
          vendor: "",
        },
        true,
      );

      expect(fingerprint).toBeDefined();
      expect(fingerprint!.clientHints).toBeUndefined();
      expect(fingerprint!.userAgent).toContain("Firefox/");
      expect(fingerprint!.userAgent).not.toContain("Chrome/");
      expect(fingerprint!.platform).toBe("MacIntel");
    });
  });
});
