import { afterEach, describe, expect, it, vi } from "vitest";

import { requestApiAccess } from "./api-access";

describe("Control D API access", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests the API origin synchronously so Firefox keeps the user gesture", () => {
    const request = vi.fn().mockResolvedValue(true);
    const contains = vi.fn().mockResolvedValue(false);
    vi.stubGlobal("chrome", { permissions: { contains, request } });

    void requestApiAccess();

    expect(request).toHaveBeenCalledWith({ origins: ["https://api.controld.com/*"] });
    expect(contains).not.toHaveBeenCalled();
  });
});
