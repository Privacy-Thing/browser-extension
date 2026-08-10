import { describe, expect, it } from "vitest";

import {
  isParentOwnedRealm,
  shouldParentOwnFrame,
} from "@/injection/main/iframe-realm-ownership";

const createGlobal = ({
  href,
  parentDocument = {},
  sameGlobal = false,
}: {
  href: string;
  parentDocument?: object;
  sameGlobal?: boolean;
}): typeof globalThis => {
  const target = {
    location: { href },
    parent: { document: parentDocument },
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
} = {}): HTMLIFrameElement =>
  ({
    getAttribute: (name: string) => (name === "src" ? (src ?? null) : null),
    hasAttribute: (name: string) => name === "srcdoc" && srcdoc,
    ownerDocument: { baseURI: "https://example.test/" },
  }) as unknown as HTMLIFrameElement;

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
    const target = createGlobal({ href: "about:blank" });
    Object.defineProperty(target, "frameElement", {
      value: createFrame({ srcdoc: true }),
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
});
