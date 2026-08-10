import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BRAND_FILE_STEM } from "@/shared/brand";
import type { CapturedFingerprint } from "@/shared/types";
import {
  areFingerprintsStable,
  collectAudioFingerprint,
  collectCanvasHash,
  collectClientHints,
  collectFingerprint,
  collectNavigatorSnapshot,
  collectScreenSnapshot,
  collectWebGLInfo,
} from "@/ui/shared/fingerprint-collector";

class MockCanvas2D {
  textBaseline = "";
  font = "";
  fillStyle = "";

  fillRect(): void {}

  fillText(): void {}
}

type MockCanvasOptions = {
  twoDContext?: MockCanvas2D | null;
  webglContext?: MockWebGL | null;
  experimentalWebglContext?: MockWebGL | null;
  throwOnDataUrl?: boolean;
};

class MockCanvasElement {
  width = 0;
  height = 0;

  constructor(private readonly options: MockCanvasOptions = {}) {}

  getContext(kind: string): unknown {
    if (kind === "2d") {
      return this.options.twoDContext ?? null;
    }

    if (kind === "webgl") {
      return this.options.webglContext ?? null;
    }

    if (kind === "experimental-webgl") {
      return this.options.experimentalWebglContext ?? null;
    }

    return null;
  }

  toDataURL(): string {
    if (this.options.throwOnDataUrl) {
      throw new Error("toDataURL failed");
    }

    return `data:image/png;base64,${BRAND_FILE_STEM}`;
  }
}

class MockWebGL {
  static debugInfoAvailable = true;
  static throwOnReadPixels = false;
  static loseContextCalls = 0;

  readonly RGBA = 0x1908;
  readonly UNSIGNED_BYTE = 0x1401;
  readonly COLOR_BUFFER_BIT = 0x4000;

  viewport(): void {}

  clearColor(): void {}

  clear(): void {}

  getExtension(name: string): unknown {
    if (name === "WEBGL_debug_renderer_info") {
      return MockWebGL.debugInfoAvailable
        ? {
            UNMASKED_RENDERER_WEBGL: 0x9246,
            UNMASKED_VENDOR_WEBGL: 0x9245,
          }
        : null;
    }

    if (name === "WEBGL_lose_context") {
      return {
        loseContext: () => {
          MockWebGL.loseContextCalls += 1;
        },
      };
    }

    return null;
  }

  getParameter(parameter: number): string | null {
    if (parameter === 0x9246) {
      return "ANGLE (Intel)";
    }

    if (parameter === 0x9245) {
      return "Google Inc.";
    }

    return null;
  }

  readPixels(
    _x: number,
    _y: number,
    _width: number,
    _height: number,
    _format: number,
    _type: number,
    pixels: Uint8Array,
  ): void {
    if (MockWebGL.throwOnReadPixels) {
      throw new Error("readPixels failed");
    }

    for (let index = 0; index < pixels.length; index += 1) {
      pixels[index] = (index * 17 + 23) & 0xff;
    }
  }
}

class MockAudioBuffer {
  static channelDelta = 0;

  private readonly data: Float32Array;

  constructor(length: number) {
    this.data = new Float32Array(length);
  }

  copyToChannel(source: Float32Array, _channelNumber: number): void {
    this.data.set(source);
  }

  getChannelData(_channelNumber: number): Float32Array {
    return Float32Array.from(
      this.data,
      (value) => value + MockAudioBuffer.channelDelta,
    );
  }
}

class MockAnalyserNode {
  fftSize = 0;

  get frequencyBinCount(): number {
    return MockAudioContext.analyserBytes.length;
  }

  getByteFrequencyData(array: Uint8Array): void {
    array.set(MockAudioContext.analyserBytes.subarray(0, array.length));
  }
}

class MockAudioContext {
  static analyserBytes = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);

  createAnalyser(): MockAnalyserNode {
    return new MockAnalyserNode();
  }

  createBuffer(
    _channels: number,
    length: number,
    _sampleRate: number,
  ): MockAudioBuffer {
    return new MockAudioBuffer(length);
  }

  createScriptProcessor(): never {
    throw new Error("deprecated ScriptProcessorNode path should not be used");
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

class MockOfflineAudioContext {
  constructor(_channels: number, _length: number, _sampleRate: number) {}

  createBuffer(
    _channels: number,
    length: number,
    _sampleRate: number,
  ): MockAudioBuffer {
    return new MockAudioBuffer(length);
  }
}

const stubCaptureDocument = (canvasFactory: () => MockCanvasElement): void => {
  vi.stubGlobal("document", {
    createElement: vi.fn(() => canvasFactory()),
  });
};

const stubSnapshotGlobals = (): void => {
  vi.stubGlobal("navigator", {
    userAgent: "Mozilla/5.0 Chrome/139",
    platform: "Win32",
    hardwareConcurrency: 8,
    deviceMemory: 8,
    languages: ["en-US", "en"],
    maxTouchPoints: 0,
  });
  vi.stubGlobal("screen", {
    width: 1920,
    height: 1080,
    availWidth: 1920,
    availHeight: 1040,
    colorDepth: 24,
    pixelDepth: 24,
  });
  vi.stubGlobal("window", {
    devicePixelRatio: 1,
  });
};

const baseFingerprint: CapturedFingerprint = {
  canvasHash: "abc123",
  webGL: {
    renderer: "ANGLE (Intel)",
    vendor: "Google Inc.",
    readPixelsHash: "feedface",
  },
  audioHash: "def456",
  navigator: {
    userAgent: "Mozilla/5.0 Chrome/139",
    platform: "Win32",
    hardwareConcurrency: 8,
    deviceMemory: 8,
    languages: ["en-US", "en"],
    maxTouchPoints: 0,
  },
  screen: {
    width: 1920,
    height: 1080,
    availWidth: 1920,
    availHeight: 1040,
    colorDepth: 24,
    pixelDepth: 24,
    devicePixelRatio: 1,
  },
  clientHints: null,
  collectedAt: "2026-04-14T12:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("areFingerprintsStable", () => {
  it("returns true for identical fingerprints", () => {
    expect(areFingerprintsStable(baseFingerprint, { ...baseFingerprint })).toBe(true);
  });

  it("returns true when only collectedAt or clientHints differ", () => {
    const end: CapturedFingerprint = {
      ...baseFingerprint,
      collectedAt: "2026-04-14T12:05:00.000Z",
      clientHints: {
        platform: "Windows",
        platformVersion: "15.0.0",
        architecture: "x86",
        bitness: "64",
        mobile: false,
        model: "",
        brands: [{ brand: "Chromium", version: "139" }],
        fullVersionList: [{ brand: "Chromium", version: "139.0.7204.62" }],
      },
    };
    expect(areFingerprintsStable(baseFingerprint, end)).toBe(true);
  });

  it("detects canvas hash change", () => {
    const end = { ...baseFingerprint, canvasHash: "changed" };
    expect(areFingerprintsStable(baseFingerprint, end)).toBe(false);
  });

  it("detects WebGL renderer change", () => {
    const end = {
      ...baseFingerprint,
      webGL: { ...baseFingerprint.webGL, renderer: "ANGLE (NVIDIA)" },
    };
    expect(areFingerprintsStable(baseFingerprint, end)).toBe(false);
  });

  it("detects WebGL readPixels hash change", () => {
    const end = {
      ...baseFingerprint,
      webGL: { ...baseFingerprint.webGL, readPixelsHash: "deadbeef" },
    };
    expect(areFingerprintsStable(baseFingerprint, end)).toBe(false);
  });

  it("detects audio hash change", () => {
    const end = { ...baseFingerprint, audioHash: "changed" };
    expect(areFingerprintsStable(baseFingerprint, end)).toBe(false);
  });

  it("detects navigator userAgent change", () => {
    const end = {
      ...baseFingerprint,
      navigator: { ...baseFingerprint.navigator, userAgent: "Mozilla/5.0 Chrome/140" },
    };
    expect(areFingerprintsStable(baseFingerprint, end)).toBe(false);
  });

  it("detects screen resolution change", () => {
    const end = {
      ...baseFingerprint,
      screen: { ...baseFingerprint.screen, width: 2560 },
    };
    expect(areFingerprintsStable(baseFingerprint, end)).toBe(false);
  });

  it("detects screen pixel depth change", () => {
    const end = {
      ...baseFingerprint,
      screen: { ...baseFingerprint.screen, pixelDepth: 30 },
    };
    expect(areFingerprintsStable(baseFingerprint, end)).toBe(false);
  });

  it("detects hardware concurrency change", () => {
    const end = {
      ...baseFingerprint,
      navigator: { ...baseFingerprint.navigator, hardwareConcurrency: 16 },
    };
    expect(areFingerprintsStable(baseFingerprint, end)).toBe(false);
  });
});

describe("collectCanvasHash", () => {
  it("returns a hash when a 2D canvas context is available", async () => {
    stubCaptureDocument(
      () => new MockCanvasElement({ twoDContext: new MockCanvas2D() }),
    );

    const hash = await collectCanvasHash();

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns null when the canvas context is unavailable or serialization fails", async () => {
    stubCaptureDocument(() => new MockCanvasElement({ twoDContext: null }));
    await expect(collectCanvasHash()).resolves.toBeNull();

    stubCaptureDocument(
      () =>
        new MockCanvasElement({
          twoDContext: new MockCanvas2D(),
          throwOnDataUrl: true,
        }),
    );
    await expect(collectCanvasHash()).resolves.toBeNull();
  });
});

describe("collectWebGLInfo", () => {
  beforeEach(() => {
    MockWebGL.debugInfoAvailable = true;
    MockWebGL.throwOnReadPixels = false;
    MockWebGL.loseContextCalls = 0;
    vi.stubGlobal("WebGLRenderingContext", MockWebGL);
  });

  it("collects renderer, vendor, readPixels hash, and releases the context", () => {
    stubCaptureDocument(() => new MockCanvasElement({ webglContext: new MockWebGL() }));

    const fingerprint = collectWebGLInfo();

    expect(fingerprint).toEqual({
      renderer: "ANGLE (Intel)",
      vendor: "Google Inc.",
      readPixelsHash: "790493445",
    });
    expect(MockWebGL.loseContextCalls).toBe(1);
  });

  it("falls back to experimental-webgl and tolerates missing debug info", () => {
    MockWebGL.debugInfoAvailable = false;
    stubCaptureDocument(
      () =>
        new MockCanvasElement({
          webglContext: null,
          experimentalWebglContext: new MockWebGL(),
        }),
    );

    const fingerprint = collectWebGLInfo();

    expect(fingerprint.renderer).toBeNull();
    expect(fingerprint.vendor).toBeNull();
    expect(fingerprint.readPixelsHash).toBe("790493445");
  });

  it("returns null data when WebGL is unavailable or readPixels throws", () => {
    stubCaptureDocument(() => new MockCanvasElement());
    expect(collectWebGLInfo()).toEqual({
      renderer: null,
      vendor: null,
      readPixelsHash: null,
    });

    MockWebGL.throwOnReadPixels = true;
    stubCaptureDocument(() => new MockCanvasElement({ webglContext: new MockWebGL() }));
    expect(collectWebGLInfo()).toEqual({
      renderer: null,
      vendor: null,
      readPixelsHash: null,
    });
  });
});

describe("collectAudioFingerprint", () => {
  beforeEach(() => {
    MockAudioContext.analyserBytes = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
    MockAudioBuffer.channelDelta = 0;
    vi.stubGlobal("AudioContext", MockAudioContext);
    vi.stubGlobal("OfflineAudioContext", MockOfflineAudioContext);
  });

  it("collects an audio hash without using ScriptProcessorNode", async () => {
    const scriptProcessorSpy = vi.spyOn(
      MockAudioContext.prototype,
      "createScriptProcessor",
    );

    const hash = await collectAudioFingerprint();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(scriptProcessorSpy).not.toHaveBeenCalled();
  });

  it("returns null when no audio context implementation is available", async () => {
    vi.unstubAllGlobals();

    await expect(collectAudioFingerprint()).resolves.toBeNull();
  });

  it("changes when analyser or AudioBuffer probe output changes", async () => {
    const baseline = await collectAudioFingerprint();

    MockAudioContext.analyserBytes = new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0]);
    const analyserChanged = await collectAudioFingerprint();

    MockAudioContext.analyserBytes = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
    MockAudioBuffer.channelDelta = 0.001;
    const bufferChanged = await collectAudioFingerprint();

    expect(analyserChanged).not.toBe(baseline);
    expect(bufferChanged).not.toBe(baseline);
  });

  it("falls back to the live context buffer when OfflineAudioContext is missing", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("AudioContext", MockAudioContext);

    await expect(collectAudioFingerprint()).resolves.toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("browser snapshot helpers", () => {
  beforeEach(() => {
    stubSnapshotGlobals();
  });

  it("collects navigator and screen snapshots from browser globals", () => {
    expect(collectNavigatorSnapshot()).toEqual(baseFingerprint.navigator);
    expect(collectScreenSnapshot()).toEqual(baseFingerprint.screen);
  });
});

describe("collectClientHints", () => {
  beforeEach(() => {
    stubSnapshotGlobals();
  });

  it("returns null when userAgentData is unavailable", async () => {
    await expect(collectClientHints()).resolves.toBeNull();
  });

  it("collects high-entropy values and falls back to uaData.brands when needed", async () => {
    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      userAgentData: {
        brands: [{ brand: "Chromium", version: "139" }],
        mobile: false,
        platform: "Windows",
        async getHighEntropyValues() {
          return {
            platform: "Windows",
            platformVersion: "15.0.0",
            architecture: "x86",
            bitness: "64",
            mobile: false,
            model: "",
            fullVersionList: [{ brand: "Chromium", version: "139.0.7204.62" }],
          };
        },
      },
    });

    await expect(collectClientHints()).resolves.toEqual({
      platform: "Windows",
      platformVersion: "15.0.0",
      architecture: "x86",
      bitness: "64",
      mobile: false,
      model: "",
      brands: [{ brand: "Chromium", version: "139" }],
      fullVersionList: [{ brand: "Chromium", version: "139.0.7204.62" }],
    });
  });

  it("returns null when high-entropy values cannot be read", async () => {
    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      userAgentData: {
        brands: [],
        mobile: false,
        platform: "Windows",
        async getHighEntropyValues() {
          throw new Error("denied");
        },
      },
    });

    await expect(collectClientHints()).resolves.toBeNull();
  });
});

describe("collectFingerprint", () => {
  beforeEach(() => {
    MockAudioContext.analyserBytes = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
    MockAudioBuffer.channelDelta = 0;
    MockWebGL.debugInfoAvailable = true;
    MockWebGL.throwOnReadPixels = false;
    MockWebGL.loseContextCalls = 0;
    vi.stubGlobal("AudioContext", MockAudioContext);
    vi.stubGlobal("OfflineAudioContext", MockOfflineAudioContext);
    vi.stubGlobal("WebGLRenderingContext", MockWebGL);
    stubSnapshotGlobals();
    stubCaptureDocument(
      () =>
        new MockCanvasElement({
          twoDContext: new MockCanvas2D(),
          webglContext: new MockWebGL(),
        }),
    );
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-25T03:00:00.000Z"));
    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      userAgentData: {
        brands: [{ brand: "Chromium", version: "139" }],
        mobile: false,
        platform: "Windows",
        async getHighEntropyValues() {
          return {
            platform: "Windows",
            platformVersion: "15.0.0",
            architecture: "x86",
            bitness: "64",
            mobile: false,
            model: "",
            brands: [{ brand: "Chromium", version: "139" }],
            fullVersionList: [{ brand: "Chromium", version: "139.0.7204.62" }],
          };
        },
      },
    });
  });

  it("collects a full diagnostic fingerprint snapshot", async () => {
    const fingerprint = await collectFingerprint();

    expect(fingerprint.canvasHash).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprint.webGL).toEqual({
      renderer: "ANGLE (Intel)",
      vendor: "Google Inc.",
      readPixelsHash: "790493445",
    });
    expect(fingerprint.audioHash).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprint.navigator).toEqual(baseFingerprint.navigator);
    expect(fingerprint.screen).toEqual(baseFingerprint.screen);
    expect(fingerprint.clientHints).toEqual({
      platform: "Windows",
      platformVersion: "15.0.0",
      architecture: "x86",
      bitness: "64",
      mobile: false,
      model: "",
      brands: [{ brand: "Chromium", version: "139" }],
      fullVersionList: [{ brand: "Chromium", version: "139.0.7204.62" }],
    });
    expect(fingerprint.collectedAt).toBe("2026-04-25T03:00:00.000Z");
  });
});
