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

    // Chromium can still report about:blank while starting an about:srcdoc
    // document. Document.URL and the element attribute are stable topology signals.
    return (
      targetGlobal.document?.URL !== "about:srcdoc" &&
      targetGlobal.frameElement?.hasAttribute("srcdoc") !== true
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
  if (frame.hasAttribute("srcdoc")) {
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

  const source = frame.getAttribute("src")?.trim();
  if (!source) {
    return true;
  }

  try {
    const destination = new URL(source, frame.ownerDocument.baseURI);
    return destination.protocol === "about:";
  } catch {
    return false;
  }
};
