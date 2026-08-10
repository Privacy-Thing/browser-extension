/**
 * Browser fingerprint data collector for local preview surfaces.
 *
 * Each function collects a real browser surface value for local comparison.
 *
 * Privacy: collected data must not contain coordinates, file paths, or other
 * user-identifiable information beyond browser properties.
 */

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import type { CapturedFingerprint } from "@/shared/types";

const CANVAS_FINGERPRINT_LABEL = `${BRAND_DISPLAY_NAME} fingerprint`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const simpleHash = async (data: string): Promise<string> => {
  const encoded = new TextEncoder().encode(data);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const simpleHashSync = (bytes: Uint8Array): string => {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return String(hash >>> 0);
};

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

export const collectCanvasHash = async (): Promise<string | null> => {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }

    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(50, 0, 100, 50);
    ctx.fillStyle = "#069";
    ctx.fillText(CANVAS_FINGERPRINT_LABEL, 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText(CANVAS_FINGERPRINT_LABEL, 4, 17);

    const dataURL = canvas.toDataURL("image/png");
    return simpleHash(dataURL);
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// WebGL
// ---------------------------------------------------------------------------

export const collectWebGLInfo = (): {
  renderer: string | null;
  vendor: string | null;
  readPixelsHash: string | null;
} => {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 4;
    const gl = canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");
    if (!gl || !(gl instanceof WebGLRenderingContext)) {
      return { renderer: null, vendor: null, readPixelsHash: null };
    }

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.25, 0.5, 0.75, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    const rawRenderer = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : null;
    const rawVendor = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
      : null;

    // Release the WebGL context to avoid hitting the browser's context limit
    // (typically 8–16). collectWebGLInfo may be called at session start + end.
    gl.getExtension("WEBGL_lose_context")?.loseContext();

    return {
      renderer: typeof rawRenderer === "string" ? rawRenderer : null,
      vendor: typeof rawVendor === "string" ? rawVendor : null,
      readPixelsHash: simpleHashSync(pixels),
    };
  } catch {
    return { renderer: null, vendor: null, readPixelsHash: null };
  }
};

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

export const collectAudioFingerprint = async (): Promise<string | null> => {
  try {
    const runtimeGlobals = globalThis as typeof globalThis & {
      AudioContext?: typeof globalThis.AudioContext;
      webkitAudioContext?: typeof globalThis.AudioContext;
      OfflineAudioContext?: typeof globalThis.OfflineAudioContext;
      webkitOfflineAudioContext?: typeof globalThis.OfflineAudioContext;
    };
    const AudioContext =
      runtimeGlobals.AudioContext ?? runtimeGlobals.webkitAudioContext;
    const OfflineAudioContext =
      runtimeGlobals.OfflineAudioContext ?? runtimeGlobals.webkitOfflineAudioContext;

    if (!AudioContext && !OfflineAudioContext) {
      return null;
    }

    const probeParts: string[] = [];
    let liveContext: AudioContext | null = null;

    try {
      if (AudioContext) {
        liveContext = new AudioContext();
        const analyser = liveContext.createAnalyser();
        analyser.fftSize = 64;
        const frequencyData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(frequencyData);
        probeParts.push(`analyser:${Array.from(frequencyData).join(",")}`);
      }

      const bufferContext: BaseAudioContext | null = OfflineAudioContext
        ? new OfflineAudioContext(1, 128, 44_100)
        : liveContext;

      if (bufferContext) {
        const buffer = bufferContext.createBuffer(1, 128, 44_100);
        const channelSeed = new Float32Array(128).fill(0.5);
        buffer.copyToChannel(channelSeed, 0);
        const channelData = buffer.getChannelData(0);
        probeParts.push(
          `buffer:${Array.from(channelData.slice(0, 64))
            .map((value) => value.toFixed(6))
            .join(",")}`,
        );
      }
    } finally {
      if (liveContext) {
        liveContext.close().catch(() => undefined);
      }
    }

    return probeParts.length > 0 ? simpleHash(probeParts.join("|")) : null;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Navigator
// ---------------------------------------------------------------------------

export const collectNavigatorSnapshot = (): CapturedFingerprint["navigator"] => ({
  userAgent: navigator.userAgent,
  platform: navigator.platform,
  hardwareConcurrency: navigator.hardwareConcurrency,
  deviceMemory:
    "deviceMemory" in navigator
      ? (navigator as unknown as { deviceMemory: number }).deviceMemory
      : null,
  languages: [...navigator.languages],
  maxTouchPoints: navigator.maxTouchPoints,
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export const collectScreenSnapshot = (): CapturedFingerprint["screen"] => ({
  width: screen.width,
  height: screen.height,
  availWidth: screen.availWidth,
  availHeight: screen.availHeight,
  colorDepth: screen.colorDepth,
  pixelDepth: screen.pixelDepth,
  devicePixelRatio: window.devicePixelRatio,
});

// ---------------------------------------------------------------------------
// Client Hints (Chromium only)
// ---------------------------------------------------------------------------

type NavigatorUAData = {
  brands: Array<{ brand: string; version: string }>;
  mobile: boolean;
  platform: string;
  getHighEntropyValues: (hints: string[]) => Promise<{
    platform?: string;
    platformVersion?: string;
    architecture?: string;
    bitness?: string;
    mobile?: boolean;
    model?: string;
    brands?: Array<{ brand: string; version: string }>;
    fullVersionList?: Array<{ brand: string; version: string }>;
  }>;
};

export const collectClientHints = async (): Promise<
  CapturedFingerprint["clientHints"]
> => {
  try {
    const uaData = (navigator as unknown as { userAgentData?: NavigatorUAData })
      .userAgentData;

    if (!uaData?.getHighEntropyValues) {
      return null;
    }

    const values = await uaData.getHighEntropyValues([
      "platform",
      "platformVersion",
      "architecture",
      "bitness",
      "mobile",
      "model",
      "brands",
      "fullVersionList",
    ]);

    return {
      platform: values.platform ?? null,
      platformVersion: values.platformVersion ?? null,
      architecture: values.architecture ?? null,
      bitness: values.bitness ?? null,
      mobile: values.mobile ?? null,
      model: values.model ?? null,
      brands: values.brands ?? uaData.brands ?? [],
      fullVersionList: values.fullVersionList ?? [],
    };
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Full fingerprint collection
// ---------------------------------------------------------------------------

export const collectFingerprint = async (): Promise<CapturedFingerprint> => {
  const [canvasHash, audioHash, clientHints] = await Promise.all([
    collectCanvasHash(),
    collectAudioFingerprint(),
    collectClientHints(),
  ]);

  return {
    canvasHash,
    webGL: collectWebGLInfo(),
    audioHash,
    navigator: collectNavigatorSnapshot(),
    screen: collectScreenSnapshot(),
    clientHints,
    collectedAt: new Date().toISOString(),
  };
};

/**
 * Compares two diagnostic snapshots and returns `true` when all stable
 * properties (canvas, WebGL, navigator, screen) are identical. This is used
 * for the optional capture-time stability check.
 */
export const areFingerprintsStable = (
  start: CapturedFingerprint,
  end: CapturedFingerprint,
): boolean =>
  start.canvasHash === end.canvasHash &&
  start.webGL.renderer === end.webGL.renderer &&
  start.webGL.vendor === end.webGL.vendor &&
  start.webGL.readPixelsHash === end.webGL.readPixelsHash &&
  start.audioHash === end.audioHash &&
  start.navigator.userAgent === end.navigator.userAgent &&
  start.navigator.platform === end.navigator.platform &&
  start.navigator.hardwareConcurrency === end.navigator.hardwareConcurrency &&
  start.screen.width === end.screen.width &&
  start.screen.height === end.screen.height &&
  start.screen.colorDepth === end.screen.colorDepth &&
  start.screen.pixelDepth === end.screen.pixelDepth;
