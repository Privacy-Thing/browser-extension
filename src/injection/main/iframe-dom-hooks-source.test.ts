import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("iframe DOM insertion hooks source", () => {
  const domSource = readFileSync(
    resolve(process.cwd(), "src/injection/main/iframe-patch.ts"),
    "utf8",
  );
  const realmSource = readFileSync(
    resolve(process.cwd(), "src/injection/main/iframe-realm-installer.ts"),
    "utf8",
  );

  it("guards Node insertion wrappers against synchronous re-entry", () => {
    expect(domSource).toContain("#insertionActive = false;");
    expect(domSource).toContain("if (installer.#insertionActive) {");
    expect(domSource).toContain("installer.#insertionActive = true;");
    expect(domSource).toContain("installer.#insertionActive = false;");
  });

  it("guards Range.insertNode against synchronous re-entry", () => {
    expect(domSource).toContain("#rangeInsertActive = false;");
    expect(domSource).toContain("if (installer.#rangeInsertActive) {");
    expect(domSource).toContain("installer.#rangeInsertActive = true;");
    expect(domSource).toContain("installer.#rangeInsertActive = false;");
  });

  it("installs child-realm surfaces once per Navigator prototype", () => {
    expect(realmSource).toContain("#patchedNavProtos = new WeakSet<object>();");
    expect(realmSource).toContain("#patchedNavProtos.has(navPrototype)");
    expect(realmSource).toContain("#patchedNavProtos.add(navPrototype);");
  });
});
