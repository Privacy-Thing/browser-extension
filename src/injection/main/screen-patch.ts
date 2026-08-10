/**
 * Screen fingerprint spoofing patch.
 *
 * Overrides `screen.width`, `screen.height`, `screen.availWidth`,
 * `screen.availHeight`, `screen.colorDepth`, `screen.pixelDepth`,
 * and `window.devicePixelRatio` with values from the runtime snapshot.
 */

import {
  createLogger,
  createOnceLogger,
} from "@privacy-brand/refract-browser/common/debug-logger";
import { markSurfaceUsed } from "@privacy-brand/refract-browser/common/surface-usage-emitter";
import { createScreenReaders } from "@privacy-brand/refract-core/fingerprint/screen-fingerprint-readers";
import { isFpSurfaceEnabled } from "@privacy-brand/refract-core/fingerprint/surface-guards";

import { defineGetter } from "@/injection/main/locale-patch";
import type { RuntimeIntegrityContext } from "@/injection/main/surface-integrity";
import type { RuntimeSnapshot, SpoofingSurfaceMethodId } from "@/shared/types";

const createScreenIntegrity = (
  integrity: RuntimeIntegrityContext | undefined,
  methodId: SpoofingSurfaceMethodId,
  receiver: object,
): Parameters<typeof defineGetter>[3] | undefined =>
  integrity
    ? {
        registrar: integrity.registrar,
        anchor: {
          surfaceId: "screen",
          methodId,
          realmId: integrity.realmId,
          repairPolicy: "repair",
          criticality: "preview-critical",
          resolveReceiver: () => receiver,
        },
      }
    : undefined;

export const installScreenPatch = (
  snapshot: RuntimeSnapshot,
  targetGlobal: typeof globalThis = globalThis,
  integrity?: RuntimeIntegrityContext,
): void => {
  const screenConfig = snapshot.fingerprint?.screen;
  if (!screenConfig) {
    return;
  }

  // Check per-surface toggle
  if (!isFpSurfaceEnabled(snapshot.fingerprint, "screen")) {
    return;
  }

  const targetScreen = targetGlobal.screen;
  if (!targetScreen) {
    return;
  }

  const logScreen = createLogger(snapshot, "Screen");
  const logScreenOnce = createOnceLogger(snapshot, "Screen");
  logScreen("install", [], screenConfig);

  const wrapReader =
    <TValue>(
      method: string,
      methodId: SpoofingSurfaceMethodId,
      getter: () => TValue,
    ): (() => TValue) =>
    () => {
      markSurfaceUsed("screen", methodId);
      const value = getter();
      logScreenOnce(method, [], value);
      return value;
    };

  const screenProto = Object.getPrototypeOf(targetScreen) as object;
  const nativeValues = {
    width: targetScreen.width,
    height: targetScreen.height,
    availWidth: targetScreen.availWidth,
    availHeight: targetScreen.availHeight,
    colorDepth: targetScreen.colorDepth,
    pixelDepth: targetScreen.pixelDepth,
    devicePixelRatio: targetGlobal.devicePixelRatio,
  };
  const readers = createScreenReaders({
    getFingerprint: () => snapshot.fingerprint,
    nativeReaders: {
      width: () => nativeValues.width,
      height: () => nativeValues.height,
      availWidth: () => nativeValues.availWidth,
      availHeight: () => nativeValues.availHeight,
      colorDepth: () => nativeValues.colorDepth,
      pixelDepth: () => nativeValues.pixelDepth,
      devicePixelRatio: () => nativeValues.devicePixelRatio,
    },
    deriveAvailHeight: (nextScreenConfig) =>
      typeof nextScreenConfig.height === "number"
        ? Math.max(0, nextScreenConfig.height - 40)
        : null,
  });

  if (typeof screenConfig.width === "number") {
    defineGetter(
      screenProto,
      "width",
      wrapReader("get width", "screen.width", readers.width),
      createScreenIntegrity(integrity, "screen.width", targetScreen),
    );
    defineGetter(
      screenProto,
      "availWidth",
      wrapReader("get availWidth", "screen.availWidth", readers.availWidth),
      createScreenIntegrity(integrity, "screen.availWidth", targetScreen),
    );
  }

  if (typeof screenConfig.height === "number") {
    defineGetter(
      screenProto,
      "height",
      wrapReader("get height", "screen.height", readers.height),
      createScreenIntegrity(integrity, "screen.height", targetScreen),
    );
    defineGetter(
      screenProto,
      "availHeight",
      wrapReader("get availHeight", "screen.availHeight", readers.availHeight),
      createScreenIntegrity(integrity, "screen.availHeight", targetScreen),
    );
  }

  if (typeof screenConfig.colorDepth === "number") {
    defineGetter(
      screenProto,
      "colorDepth",
      wrapReader("get colorDepth", "screen.colorDepth", readers.colorDepth),
      createScreenIntegrity(integrity, "screen.colorDepth", targetScreen),
    );
    defineGetter(
      screenProto,
      "pixelDepth",
      wrapReader("get pixelDepth", "screen.pixelDepth", readers.pixelDepth),
      createScreenIntegrity(integrity, "screen.pixelDepth", targetScreen),
    );
  }

  if (typeof screenConfig.devicePixelRatio === "number") {
    defineGetter(
      targetGlobal as object,
      "devicePixelRatio",
      wrapReader(
        "get devicePixelRatio",
        "screen.devicePixelRatio",
        readers.devicePixelRatio,
      ),
      createScreenIntegrity(integrity, "screen.devicePixelRatio", targetGlobal),
    );
  }
};
