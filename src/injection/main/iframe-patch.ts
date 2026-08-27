import { writeRuntimeWindowSeed } from "@privacy-brand/refract-browser/common/runtime-config";
import type { SurfaceIntegrityRegistry } from "@privacy-brand/refract-core/integrity/surface-integrity-registry";
import { defineNativeGetter } from "@privacy-brand/refract-core/native/native-getter";
import {
  createNativeSource,
  maskAsNative,
} from "@privacy-brand/refract-core/native/native-mask";
import {
  privateWeakSetAdd as add,
  privateWeakSetHas as has,
} from "@privacy-brand/refract-core/runtime/primordials";

import {
  isIframeSrcAttribute,
  isIframeSrcdocAttribute,
  sameOriginSeedHostname,
} from "@/injection/main/iframe-navigation-seed";
import { createIframeScheduler } from "@/injection/main/iframe-patch-scheduler";
import { IframeRealmInstaller } from "@/injection/main/iframe-realm-installer";
import { iframeHasSrcdoc } from "@/injection/main/iframe-realm-ownership";
import { isTopOrSameOriginFrame } from "@/injection/main/worker-patch";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import type { RuntimeSnapshot } from "@/shared/types";

type NativeInsertMethods = {
  nativeAppendChild: Node["appendChild"];
  nativeInsertBefore: Node["insertBefore"];
  nativeReplaceChild: Node["replaceChild"];
};

type InsertMethods = {
  appendChild: Node["appendChild"] | undefined;
  insertBefore: Node["insertBefore"] | undefined;
  replaceChild: Node["replaceChild"] | undefined;
};

const skipPatch = <T extends object>(set: WeakSet<T>, value: T | undefined): boolean =>
  !value || has(set, value);

class IframeDomInstaller {
  #frameAccessDepth = 0;
  #htmlInsertActive = false;
  #insertionActive = false;
  readonly #patchedAttributeProtos = new WeakSet<object>();
  readonly #patchedDocuments = new WeakSet<Document>();
  readonly #patchedDocumentProtos = new WeakSet<object>();
  readonly #patchedHtmlProtos = new WeakSet<object>();
  readonly #patchedInsertProtos = new WeakSet<object>();
  readonly #patchedLoadFrames = new WeakSet<HTMLIFrameElement>();
  readonly #patchedRangeProtos = new WeakSet<object>();
  readonly #patchedNavigationProtos = new WeakSet<object>();
  readonly #patchedWindowProtos = new WeakSet<object>();
  readonly #patchInsertedNode: (node: Node) => void;
  #rangeInsertActive = false;
  readonly #realmInstaller: IframeRealmInstaller;
  readonly #snapshot: RuntimeSnapshot;

  constructor(snapshot: RuntimeSnapshot, registrar: SurfaceIntegrityRegistry) {
    this.#snapshot = snapshot;
    this.#realmInstaller = new IframeRealmInstaller(snapshot, registrar, {
      installContentWindow: (win) => this.#installContentWindow(win),
      installDocument: (win) => this.#installDocument(win),
      installMutation: (doc) => this.#installMutation(doc),
      installRange: (win) => this.#installRangeInsert(win),
    });
    this.#patchInsertedNode = createIframeScheduler<Node, HTMLIFrameElement>({
      isNode: (value): value is Node => value instanceof Node,
      isFrame: (value): value is HTMLIFrameElement =>
        value instanceof HTMLIFrameElement,
      patchFrames: (frames) => this.#patchFrames(frames),
      querySubtreeFrames: (node) => this.#getSubtreeFrames(node),
      queueMicrotask: (callback) => queueMicrotask(callback),
    }).patchInsertedNode;
  }

  install(): void {
    // DOM hooks in cross-origin iframes break third-party frame communication.
    if (!isTopOrSameOriginFrame()) return;
    this.#installInsertionHooks(window);
    this.#installContentWindow(window);
    this.#installDocument(window);
    this.#installSrcdocSeedHooks(window);
    this.#installHtmlInsertion(window);
    this.#installMutation(document);
    this.#installRangeInsert(window);
    const existingFrames = Array.from(
      document.querySelectorAll<HTMLIFrameElement>("iframe"),
    );
    if (existingFrames.length > 0) this.#patchFrames(existingFrames);
  }

  #patchIframeWindow(
    frame: HTMLIFrameElement,
    win: Window,
    synchronousPageAccess = false,
  ): void {
    this.#realmInstaller.patch(frame, win, synchronousPageAccess);
  }

  #installContentWindow(targetWin: Window): void {
    const iframeGlobal = targetWin as Window & typeof globalThis;
    const targetPrototype = iframeGlobal.HTMLIFrameElement?.prototype;
    if (skipPatch(this.#patchedWindowProtos, targetPrototype)) return;

    const descriptor = Object.getOwnPropertyDescriptor(
      targetPrototype,
      "contentWindow",
    );
    if (!descriptor?.get) {
      return;
    }

    const nativeGetContentWindow = descriptor.get;
    const installer = this;

    add(this.#patchedWindowProtos, targetPrototype);

    defineNativeGetter(
      targetPrototype,
      "contentWindow",
      function (this: HTMLIFrameElement): Window | null {
        const win = nativeGetContentWindow.call(this);
        if (!win) {
          return null;
        }

        try {
          installer.#patchIframeWindow(this, win, installer.#frameAccessDepth === 0);
        } catch {
          // Cross-origin access raises DOMException, safely ignore
        }

        return win;
      },
      { nativeGetter: nativeGetContentWindow },
    );
  }

  #installDocument(targetWin: Window): void {
    const iframeGlobal = targetWin as Window & typeof globalThis;
    const targetPrototype = iframeGlobal.HTMLIFrameElement?.prototype;
    if (skipPatch(this.#patchedDocumentProtos, targetPrototype)) return;

    const descriptor = Object.getOwnPropertyDescriptor(
      targetPrototype,
      "contentDocument",
    );
    if (!descriptor?.get) {
      return;
    }

    const nativeGetContentDocument = descriptor.get;
    const installer = this;

    add(this.#patchedDocumentProtos, targetPrototype);

    defineNativeGetter(
      targetPrototype,
      "contentDocument",
      function (this: HTMLIFrameElement): Document | null {
        const doc = nativeGetContentDocument.call(this);
        if (!doc) {
          return null;
        }

        try {
          const win = doc.defaultView;
          if (win) {
            installer.#patchIframeWindow(this, win, installer.#frameAccessDepth === 0);
          }
        } catch {
          // Should not throw for same-origin frames, guard defensively
        }

        return doc;
      },
      { nativeGetter: nativeGetContentDocument },
    );
  }

  #seedFrameNavigation(frame: HTMLIFrameElement, sourceHostname?: string): void {
    try {
      const childWindow = frame.contentWindow;
      if (childWindow) {
        writeRuntimeWindowSeed(this.#snapshot, childWindow, {
          preserveExistingSeed: true,
          ...(sourceHostname ? { sourceHostname } : {}),
        });
      }
    } catch {
      // Cross-origin or constrained frames cannot accept a same-origin seed.
    }
  }

  #seedSameOriginNavigation(frame: HTMLIFrameElement, value: unknown): void {
    if (BUILD_BROWSER_TARGET !== "chromium") return;

    try {
      const { baseURI, location } = frame.ownerDocument;
      const sourceHostname = sameOriginSeedHostname(value, baseURI, location.origin);
      if (sourceHostname !== null) this.#seedFrameNavigation(frame, sourceHostname);
    } catch {
      // Invalid or opaque destinations are resolved by their own runtime.
    }
  }

  #installSrcdocSeedHooks(targetWin: Window): void {
    const installer = this;
    const iframeGlobal = targetWin as Window & typeof globalThis;
    const iframePrototype = iframeGlobal.HTMLIFrameElement?.prototype;
    if (iframePrototype && !has(this.#patchedNavigationProtos, iframePrototype)) {
      const srcDescriptor = Object.getOwnPropertyDescriptor(iframePrototype, "src");
      if (BUILD_BROWSER_TARGET === "chromium" && srcDescriptor?.set) {
        const nativeSetSrc = srcDescriptor.set;
        Object.defineProperty(iframePrototype, "src", {
          ...srcDescriptor,
          set: maskAsNative(
            function (this: HTMLIFrameElement, value: string): void {
              installer.#seedSameOriginNavigation(this, value);
              Reflect.apply(nativeSetSrc, this, [value]);
            },
            nativeSetSrc.toString(),
            nativeSetSrc.length,
          ),
        });
      }

      const srcdocDescriptor = Object.getOwnPropertyDescriptor(
        iframePrototype,
        "srcdoc",
      );
      if (srcdocDescriptor?.set) {
        const nativeSetSrcdoc = srcdocDescriptor.set;
        Object.defineProperty(iframePrototype, "srcdoc", {
          ...srcdocDescriptor,
          set: maskAsNative(
            function (this: HTMLIFrameElement, value: string): void {
              installer.#seedFrameNavigation(this);
              Reflect.apply(nativeSetSrcdoc, this, [value]);
            },
            nativeSetSrcdoc.toString(),
            nativeSetSrcdoc.length,
          ),
        });
      }
      add(this.#patchedNavigationProtos, iframePrototype);
    }

    const elementPrototype = iframeGlobal.Element?.prototype;
    if (skipPatch(this.#patchedAttributeProtos, elementPrototype)) return;

    const setAttributeDescriptor = Object.getOwnPropertyDescriptor(
      elementPrototype,
      "setAttribute",
    );
    const setAttributeNsDescriptor = Object.getOwnPropertyDescriptor(
      elementPrototype,
      "setAttributeNS",
    );
    const nativeSetAttribute = setAttributeDescriptor?.value as
      Element["setAttribute"] | undefined;
    const nativeSetAttributeNs = setAttributeNsDescriptor?.value as
      Element["setAttributeNS"] | undefined;

    if (nativeSetAttribute && setAttributeDescriptor) {
      const setAttribute = function (
        this: Element,
        qualifiedName: string,
        value: string,
      ): void {
        if (this instanceof iframeGlobal.HTMLIFrameElement) {
          if (isIframeSrcdocAttribute(qualifiedName)) {
            installer.#seedFrameNavigation(this);
          } else if (isIframeSrcAttribute(qualifiedName)) {
            installer.#seedSameOriginNavigation(this, value);
          }
        }
        Reflect.apply(nativeSetAttribute, this, [qualifiedName, value]);
      };
      Object.defineProperty(elementPrototype, "setAttribute", {
        ...setAttributeDescriptor,
        value: maskAsNative(
          setAttribute,
          nativeSetAttribute.toString(),
          nativeSetAttribute.length,
        ),
      });
    }

    if (nativeSetAttributeNs && setAttributeNsDescriptor) {
      const setAttributeNS = function (
        this: Element,
        namespace: string | null,
        qualifiedName: string,
        value: string,
      ): void {
        if (namespace === null && this instanceof iframeGlobal.HTMLIFrameElement) {
          if (isIframeSrcdocAttribute(qualifiedName)) {
            installer.#seedFrameNavigation(this);
          } else if (isIframeSrcAttribute(qualifiedName)) {
            installer.#seedSameOriginNavigation(this, value);
          }
        }
        Reflect.apply(nativeSetAttributeNs, this, [namespace, qualifiedName, value]);
      };
      Object.defineProperty(elementPrototype, "setAttributeNS", {
        ...setAttributeNsDescriptor,
        value: maskAsNative(
          setAttributeNS,
          nativeSetAttributeNs.toString(),
          nativeSetAttributeNs.length,
        ),
      });
    }

    add(this.#patchedAttributeProtos, elementPrototype);
  }

  #getSubtreeFrames(node: Node | null | undefined): HTMLIFrameElement[] {
    if (!(node instanceof Node) || node instanceof HTMLIFrameElement) {
      return [];
    }

    if ("querySelectorAll" in node && typeof node.querySelectorAll === "function") {
      return Array.from(
        node.querySelectorAll("iframe"),
        (frame) => frame as HTMLIFrameElement,
      );
    }

    return [];
  }

  #patchFrames(frames: readonly HTMLIFrameElement[]): void {
    for (const frame of frames) {
      // A detached iframe can receive srcdoc before it has a contentWindow, so
      // the setter hook cannot seed it. Once insertion creates the provisional
      // about:blank realm, seed it synchronously before the srcdoc document runs.
      if (iframeHasSrcdoc(frame)) {
        this.#seedFrameNavigation(frame);
      }

      if (!has(this.#patchedLoadFrames, frame)) {
        frame.addEventListener("load", () => {
          try {
            this.#frameAccessDepth += 1;
            const win = frame.contentWindow;
            if (win) {
              this.#patchIframeWindow(frame, win);
            }
          } catch {
            // Cross-origin access raises DOMException, safely ignore
          } finally {
            this.#frameAccessDepth -= 1;
          }
        });
        add(this.#patchedLoadFrames, frame);
      }

      try {
        this.#frameAccessDepth += 1;
        const win = frame.contentWindow;
        if (win) {
          this.#patchIframeWindow(frame, win);
        }
      } catch {
        // Cross-origin access raises DOMException, safely ignore
      } finally {
        this.#frameAccessDepth -= 1;
      }
    }
  }

  #installInsertionHooks(targetWin: Window): void {
    const iframeGlobal = targetWin as Window & typeof globalThis;
    const targetPrototype = iframeGlobal.Node?.prototype;
    if (skipPatch(this.#patchedInsertProtos, targetPrototype)) return;

    const appendDescriptor = Object.getOwnPropertyDescriptor(
      targetPrototype,
      "appendChild",
    );
    const insertBeforeDescriptor = Object.getOwnPropertyDescriptor(
      targetPrototype,
      "insertBefore",
    );
    const replaceChildDescriptor = Object.getOwnPropertyDescriptor(
      targetPrototype,
      "replaceChild",
    );

    if (
      !appendDescriptor?.value ||
      !insertBeforeDescriptor?.value ||
      !replaceChildDescriptor?.value
    ) {
      return;
    }

    const nativeAppendChild = appendDescriptor.value as Node["appendChild"];
    const nativeInsertBefore = insertBeforeDescriptor.value as Node["insertBefore"];
    const nativeReplaceChild = replaceChildDescriptor.value as Node["replaceChild"];

    add(this.#patchedInsertProtos, targetPrototype);

    const { appendChild, insertBefore, replaceChild } = this.#createInsertionMethods({
      nativeAppendChild,
      nativeInsertBefore,
      nativeReplaceChild,
    });

    if (!appendChild || !insertBefore || !replaceChild) {
      return;
    }

    Object.defineProperties(targetPrototype, {
      appendChild: {
        configurable: true,
        writable: true,
        value: maskAsNative(appendChild),
      },
      insertBefore: {
        configurable: true,
        writable: true,
        value: maskAsNative(insertBefore),
      },
      replaceChild: {
        configurable: true,
        writable: true,
        value: maskAsNative(replaceChild),
      },
    });
  }

  #createInsertionMethods({
    nativeAppendChild,
    nativeInsertBefore,
    nativeReplaceChild,
  }: NativeInsertMethods): InsertMethods {
    const installer = this;
    const appendChild = Object.getOwnPropertyDescriptor(
      {
        appendChild<T extends Node>(this: Node, node: T): T {
          if (installer.#insertionActive) {
            return Reflect.apply(nativeAppendChild, this, [node]) as T;
          }
          installer.#insertionActive = true;
          try {
            const frames =
              node instanceof DocumentFragment
                ? installer.#getSubtreeFrames(node)
                : null;
            const result = Reflect.apply(nativeAppendChild, this, [node]) as T;
            if (frames !== null) {
              if (frames.length > 0) installer.#patchFrames(frames);
            } else {
              installer.#patchInsertedNode(node);
            }
            return result;
          } finally {
            installer.#insertionActive = false;
          }
        },
      },
      "appendChild",
    )?.value as Node["appendChild"] | undefined;
    const insertBefore = Object.getOwnPropertyDescriptor(
      {
        insertBefore<T extends Node>(this: Node, node: T, child: Node | null): T {
          if (installer.#insertionActive) {
            return Reflect.apply(nativeInsertBefore, this, [node, child]) as T;
          }
          installer.#insertionActive = true;
          try {
            const frames =
              node instanceof DocumentFragment
                ? installer.#getSubtreeFrames(node)
                : null;
            const result = Reflect.apply(nativeInsertBefore, this, [node, child]) as T;
            if (frames !== null) {
              if (frames.length > 0) installer.#patchFrames(frames);
            } else {
              installer.#patchInsertedNode(node);
            }
            return result;
          } finally {
            installer.#insertionActive = false;
          }
        },
      },
      "insertBefore",
    )?.value as Node["insertBefore"] | undefined;
    const replaceChild = Object.getOwnPropertyDescriptor(
      {
        replaceChild<T extends Node>(this: Node, node: T, child: Node): Node {
          if (installer.#insertionActive) {
            return Reflect.apply(nativeReplaceChild, this, [node, child]) as Node;
          }
          installer.#insertionActive = true;
          try {
            const frames =
              node instanceof DocumentFragment
                ? installer.#getSubtreeFrames(node)
                : null;
            const result = Reflect.apply(nativeReplaceChild, this, [
              node,
              child,
            ]) as Node;
            if (frames !== null) {
              if (frames.length > 0) installer.#patchFrames(frames);
            } else {
              installer.#patchInsertedNode(node);
            }
            return result;
          } finally {
            installer.#insertionActive = false;
          }
        },
      },
      "replaceChild",
    )?.value as Node["replaceChild"] | undefined;
    return { appendChild, insertBefore, replaceChild };
  }

  // Catches iframes inserted via innerHTML, insertAdjacentHTML, document.write,
  // Range.insertNode, and any other path that bypasses Node.prototype hooks.
  // Fires as a microtask, so synchronous access via self[n] immediately after
  // insertion may still race — the Node.prototype and contentDocument hooks
  // handle the synchronous cases.
  #installMutation(targetDoc: Document): void {
    if (has(this.#patchedDocuments, targetDoc)) {
      return;
    }
    add(this.#patchedDocuments, targetDoc);

    try {
      new MutationObserver((mutations) => {
        for (const { addedNodes } of mutations) {
          for (let i = 0; i < addedNodes.length; i++) {
            const node = addedNodes[i];
            if (!node || node.nodeType !== Node.ELEMENT_NODE) {
              continue;
            }
            const el = node as Element;
            if (el.tagName === "IFRAME") {
              this.#patchFrames([el as HTMLIFrameElement]);
            } else if (el.childElementCount > 0) {
              const frames = this.#getSubtreeFrames(el);
              if (frames.length > 0) {
                this.#patchFrames(frames);
              }
            }
          }
        }
      }).observe(targetDoc, { childList: true, subtree: true });
    } catch {
      // May fail in constrained contexts (e.g. sandboxed iframes)
    }
  }

  #installRangeInsert(targetWin: Window): void {
    const installer = this;
    const iframeGlobal = targetWin as Window & typeof globalThis;
    const rangePrototype = iframeGlobal.Range?.prototype;
    if (skipPatch(this.#patchedRangeProtos, rangePrototype)) return;

    const descriptor = Object.getOwnPropertyDescriptor(rangePrototype, "insertNode");
    if (!descriptor?.value) {
      return;
    }

    const nativeInsertNode = descriptor.value as Range["insertNode"];

    add(this.#patchedRangeProtos, rangePrototype);

    const insertNode = Object.getOwnPropertyDescriptor(
      {
        insertNode(this: Range, node: Node): void {
          if (installer.#rangeInsertActive) {
            Reflect.apply(nativeInsertNode, this, [node]);
            return;
          }

          installer.#rangeInsertActive = true;
          try {
            // Pre-collect iframes from fragments before they are consumed.
            const frames =
              node instanceof DocumentFragment
                ? installer.#getSubtreeFrames(node)
                : null;
            Reflect.apply(nativeInsertNode, this, [node]);
            if (frames !== null) {
              if (frames.length > 0) installer.#patchFrames(frames);
            } else {
              installer.#patchInsertedNode(node);
            }
          } finally {
            installer.#rangeInsertActive = false;
          }
        },
      },
      "insertNode",
    )?.value;

    if (!insertNode) {
      return;
    }

    Object.defineProperty(rangePrototype, "insertNode", {
      configurable: true,
      writable: true,
      value: maskAsNative(insertNode, createNativeSource("insertNode"), 1),
    });
  }

  #findDescriptorOwner(
    target: object | null | undefined,
    property: PropertyKey,
  ): { owner: object; descriptor: PropertyDescriptor } | null {
    let current: object | null | undefined = target;
    while (current) {
      const descriptor = Object.getOwnPropertyDescriptor(current, property);
      if (descriptor) {
        return { owner: current, descriptor };
      }
      current = Object.getPrototypeOf(current);
    }
    return null;
  }

  #installHtmlInsertion(targetWin: Window): void {
    const installer = this;
    const iframeGlobal = targetWin as Window & typeof globalThis;
    const targetPrototype = iframeGlobal.Element?.prototype;
    if (skipPatch(this.#patchedHtmlProtos, targetPrototype)) return;

    add(this.#patchedHtmlProtos, targetPrototype);

    const innerHtml = this.#findDescriptorOwner(targetPrototype, "innerHTML");
    if (innerHtml?.descriptor.set) {
      const nativeSetInnerHTML = innerHtml.descriptor.set;
      Object.defineProperty(innerHtml.owner, "innerHTML", {
        configurable: innerHtml.descriptor.configurable ?? true,
        enumerable: innerHtml.descriptor.enumerable ?? false,
        ...(innerHtml.descriptor.get ? { get: innerHtml.descriptor.get } : {}),
        set: maskAsNative(
          function (this: Element, value: string): void {
            Reflect.apply(nativeSetInnerHTML, this, [value]);
            if (installer.#htmlInsertActive) {
              return;
            }

            installer.#htmlInsertActive = true;
            try {
              const frames = installer.#getSubtreeFrames(this);
              if (frames.length > 0) {
                installer.#patchFrames(frames);
              }
            } finally {
              installer.#htmlInsertActive = false;
            }
          },
          nativeSetInnerHTML.toString(),
          nativeSetInnerHTML.length,
        ),
      });
    }
  }
}

export const installIframePatch = (
  snapshot: RuntimeSnapshot,
  registrar: SurfaceIntegrityRegistry,
): void => new IframeDomInstaller(snapshot, registrar).install();
