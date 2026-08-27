import { privateReflectApply } from "@privacy-brand/refract-core/runtime/primordials";

type HasAttributeFn = (this: Element, qualifiedName: string) => boolean;
type GetAttributeFn = (this: Element, qualifiedName: string) => string | null;

let nativeHasAttribute: HasAttributeFn | undefined;
let nativeGetAttribute: GetAttributeFn | undefined;
const nativeStringTrim = String.prototype.trim;

const captureElementIntrinsics = (): void => {
  if (nativeHasAttribute && nativeGetAttribute) return;
  if (typeof Element !== "function") return;
  nativeHasAttribute = Element.prototype.hasAttribute;
  nativeGetAttribute = Element.prototype.getAttribute;
};

captureElementIntrinsics();

export const capturedStringTrim = (value: string): string =>
  privateReflectApply(nativeStringTrim, value, []) as string;

export const iframeHasSrcdoc = (frame: Element): boolean => {
  captureElementIntrinsics();
  try {
    return nativeHasAttribute
      ? privateReflectApply(nativeHasAttribute, frame, ["srcdoc"]) === true
      : false;
  } catch {
    return false;
  }
};

export const iframeSrcAttribute = (frame: Element): string | null => {
  captureElementIntrinsics();
  try {
    if (!nativeGetAttribute) return null;
    const value = privateReflectApply(nativeGetAttribute, frame, ["src"]);
    if (typeof value !== "string") return null;
    const trimmed = capturedStringTrim(value);
    return trimmed === "" ? null : trimmed;
  } catch {
    return null;
  }
};

/**
 * Destination classes for iframe `src` / `srcdoc` topology.
 *
 * Parent-owned (full protection via the same-origin parent runtime):
 * - `about-blank` — inherited blank realm, including `about:blank` and empty src
 * - `javascript:` / `vbscript:` — execute in that inherited blank realm
 * - `srcdoc` — only when `parentOwnsSrcdoc` (Firefox); Chromium srcdoc is
 *   owned by the all-frames runtime
 *
 * Destination-owned (all-frames content script, not the parent installer):
 * - `web` — http(s) navigation, including the initial about:blank with a
 *   declared future src
 * - `srcdoc` on Chromium
 *
 * Opaque / unmatched (documented post-Preview limitation: stay native;
 * parent must not report them as Protected):
 * - `opaque-blob`, `opaque-data`, `opaque-filesystem`
 * - `unknown` — any other scheme
 */
export type IframeDestinationClass =
  | "about-blank"
  | "srcdoc"
  | "javascript"
  | "vbscript"
  | "web"
  | "opaque-blob"
  | "opaque-data"
  | "opaque-filesystem"
  | "unknown";

export const classifyIframeDest = (
  frame: HTMLIFrameElement,
): IframeDestinationClass => {
  if (iframeHasSrcdoc(frame)) return "srcdoc";
  const source = iframeSrcAttribute(frame);
  if (!source) return "about-blank";
  try {
    switch (new URL(source, frame.ownerDocument.baseURI).protocol) {
      case "about:":
        return "about-blank";
      case "javascript:":
        return "javascript";
      case "vbscript:":
        return "vbscript";
      case "http:":
      case "https:":
        return "web";
      case "blob:":
        return "opaque-blob";
      case "data:":
        return "opaque-data";
      case "filesystem:":
        return "opaque-filesystem";
      default:
        return "unknown";
    }
  } catch {
    return "unknown";
  }
};

/**
 * An inherited about:blank realm is installed synchronously by its same-origin
 * parent. Srcdoc and network documents are owned by their all-frames runtime.
 */
export const isParentOwnedRealm = (targetGlobal: typeof globalThis): boolean => {
  try {
    if ((targetGlobal.parent as unknown) === targetGlobal) {
      return false;
    }

    // Access proves the parent/child relationship is currently same-origin.
    const parentDocument = targetGlobal.parent.document;
    if (parentDocument === null || targetGlobal.location.href !== "about:blank") {
      return false;
    }

    const frameElement = targetGlobal.frameElement;
    // Chromium can still report about:blank while starting an about:srcdoc
    // document. Document.URL and the element attribute are stable topology signals.
    return (
      targetGlobal.document?.URL !== "about:srcdoc" &&
      (frameElement == null || !iframeHasSrcdoc(frameElement))
    );
  } catch {
    return false;
  }
};

/**
 * Avoid installing into the initial about:blank realm when the element already
 * declares a normal navigation. Its destination document owns itself through
 * the browser's all-frames content-script registration.
 */
export const shouldParentOwnFrame = (
  frame: HTMLIFrameElement,
  targetGlobal: typeof globalThis,
  { parentOwnsSrcdoc = false }: { parentOwnsSrcdoc?: boolean } = {},
): boolean => {
  if (iframeHasSrcdoc(frame)) {
    if (!parentOwnsSrcdoc) return false;
    try {
      targetGlobal.parent.document;
      return (
        targetGlobal.location.href === "about:blank" ||
        targetGlobal.location.href === "about:srcdoc"
      );
    } catch {
      return false;
    }
  }

  if (!isParentOwnedRealm(targetGlobal)) {
    return false;
  }

  const source = iframeSrcAttribute(frame);
  if (!source) return true;
  try {
    const protocol = new URL(source, frame.ownerDocument.baseURI).protocol;
    return (
      protocol === "about:" || protocol === "javascript:" || protocol === "vbscript:"
    );
  } catch {
    return false;
  }
};
