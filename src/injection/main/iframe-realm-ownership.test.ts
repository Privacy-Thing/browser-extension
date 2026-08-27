/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";

import {
  classifyIframeDestination,
  isParentOwnedRealm,
  shouldParentOwnFrame,
} from "@/injection/main/iframe-realm-ownership";

const createGlobal = ({
  href,
  parentDocument = {},
  sameGlobal = false,
  frameElement,
}: {
  href: string;
  parentDocument?: object;
  sameGlobal?: boolean;
  frameElement?: HTMLIFrameElement;
}): typeof globalThis => {
  const target = {
    location: { href },
    parent: { document: parentDocument },
    ...(frameElement ? { frameElement } : {}),
  };
  if (sameGlobal) {
    target.parent = target as unknown as typeof target.parent;
  }
  return target as unknown as typeof globalThis;
};

const createFrame = ({
  src,
  srcdoc = false,
}: {
  src?: string;
  srcdoc?: boolean;
} = {}): HTMLIFrameElement => {
  const frame = document.createElement("iframe");
  if (srcdoc) {
    frame.setAttribute("srcdoc", "<!doctype html>");
  }
  if (src !== undefined) {
    frame.setAttribute("src", src);
  }
  return frame;
};

describe("iframe realm ownership", () => {
  it.each(["about:blank"])(
    "assigns inherited %s realms to the parent runtime",
    (href) => {
      expect(isParentOwnedRealm(createGlobal({ href }))).toBe(true);
    },
  );

  it("assigns about:srcdoc to its all-frames runtime", () => {
    expect(isParentOwnedRealm(createGlobal({ href: "about:srcdoc" }))).toBe(false);
  });

  it("recognizes a starting srcdoc document before its URL changes", () => {
    const target = createGlobal({
      href: "about:blank",
      frameElement: createFrame({ srcdoc: true }),
    });

    expect(isParentOwnedRealm(target)).toBe(false);
  });

  it("assigns navigated documents to their all-frames runtime", () => {
    expect(
      isParentOwnedRealm(createGlobal({ href: "https://example.test/frame" })),
    ).toBe(false);
  });

  it("never assigns the top-level realm to a parent", () => {
    expect(
      isParentOwnedRealm(createGlobal({ href: "about:blank", sameGlobal: true })),
    ).toBe(false);
  });

  it("rejects inaccessible parent relationships", () => {
    const target = createGlobal({ href: "about:blank" });
    Object.defineProperty(target.parent, "document", {
      get() {
        throw new DOMException("cross-origin", "SecurityError");
      },
    });
    expect(isParentOwnedRealm(target)).toBe(false);
  });

  it("leaves an initial about:blank realm with an explicit web navigation to the destination runtime", () => {
    const frame = createFrame({ src: "/frame" });

    expect(shouldParentOwnFrame(frame, createGlobal({ href: "about:blank" }))).toBe(
      false,
    );
  });

  it("keeps blank realms parent-owned and leaves srcdoc to its runtime", () => {
    const blankFrame = createFrame();
    const srcdocFrame = createFrame({ srcdoc: true });
    const provisionalGlobal = createGlobal({ href: "about:blank" });

    expect(shouldParentOwnFrame(blankFrame, provisionalGlobal)).toBe(true);
    expect(shouldParentOwnFrame(srcdocFrame, provisionalGlobal)).toBe(false);
  });

  it("allows Firefox to retain parent ownership of srcdoc", () => {
    const srcdocFrame = createFrame({ srcdoc: true });

    expect(
      shouldParentOwnFrame(srcdocFrame, createGlobal({ href: "about:srcdoc" }), {
        parentOwnsSrcdoc: true,
      }),
    ).toBe(true);
  });

  it("ignores own-method shadowing and poisoned String.prototype.trim", () => {
    const frame = createFrame();
    const nativeTrim = String.prototype.trim;
    Object.defineProperty(frame, "hasAttribute", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(frame, "getAttribute", {
      configurable: true,
      value: () => "https://tracker.test/frame",
    });
    String.prototype.trim = () => "https://tracker.test/frame";

    try {
      expect(classifyIframeDestination(frame)).toBe("about-blank");
      expect(shouldParentOwnFrame(frame, createGlobal({ href: "about:blank" }))).toBe(
        true,
      );
    } finally {
      Reflect.deleteProperty(frame, "hasAttribute");
      Reflect.deleteProperty(frame, "getAttribute");
      String.prototype.trim = nativeTrim;
    }
  });

  it("uses captured Element.prototype methods after later prototype poisoning", () => {
    const frame = createFrame();
    expect(shouldParentOwnFrame(frame, createGlobal({ href: "about:blank" }))).toBe(
      true,
    );
    const nativeHasAttribute = Element.prototype.hasAttribute;
    const nativeGetAttribute = Element.prototype.getAttribute;
    Element.prototype.hasAttribute = () => true;
    Element.prototype.getAttribute = () => "https://tracker.test/frame";

    try {
      expect(shouldParentOwnFrame(frame, createGlobal({ href: "about:blank" }))).toBe(
        true,
      );
    } finally {
      Element.prototype.hasAttribute = nativeHasAttribute;
      Element.prototype.getAttribute = nativeGetAttribute;
    }
  });

  it.each([
    { src: undefined, expected: "about-blank", parentOwned: true },
    { src: "about:blank", expected: "about-blank", parentOwned: true },
    { src: "javascript:void(0)", expected: "javascript", parentOwned: true },
    { src: "/frame", expected: "web", parentOwned: false },
    {
      src: "blob:https://example.test/11111111-1111-1111-1111-111111111111",
      expected: "opaque-blob",
      parentOwned: false,
    },
    {
      src: "data:text/html,hi",
      expected: "opaque-data",
      parentOwned: false,
    },
    {
      src: "filesystem:https://example.test/temporary/x",
      expected: "opaque-filesystem",
      parentOwned: false,
    },
    { src: "chrome://gpu", expected: "unknown", parentOwned: false },
  ] as const)("classifies $src as $expected", ({ src, expected, parentOwned }) => {
    const frame = createFrame(src === undefined ? {} : { src });
    const target = createGlobal({ href: "about:blank" });

    expect(classifyIframeDestination(frame)).toBe(expected);
    expect(shouldParentOwnFrame(frame, target)).toBe(parentOwned);
  });
});
