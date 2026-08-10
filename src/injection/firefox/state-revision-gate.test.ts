import { describe, expect, it, vi } from "vitest";

import { createFxRevisionGate } from "./state-revision-gate";

describe("Firefox state revision gate", () => {
  it("accepts only strictly newer successful revisions", () => {
    const applied = vi.fn(() => true);
    const gate = createFxRevisionGate(applied);

    expect(gate.apply({ bootstrap: { revision: 1 } })).toBe(true);
    expect(gate.apply({ bootstrap: { revision: 1 } })).toBe(false);
    expect(gate.apply({ bootstrap: { revision: 0 } })).toBe(false);
    expect(gate.apply({ bootstrap: { revision: 2 } })).toBe(true);
    expect(applied).toHaveBeenCalledTimes(2);
    expect(gate.latestRevision()).toBe(2);
  });

  it("does not consume a revision rejected by normalization/application", () => {
    const gate = createFxRevisionGate(
      vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true),
    );

    expect(gate.apply({ bootstrap: { revision: 3 } })).toBe(false);
    expect(gate.apply({ bootstrap: { revision: 3 } })).toBe(true);
    expect(gate.latestRevision()).toBe(3);
  });
});
