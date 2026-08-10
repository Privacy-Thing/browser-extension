import { describe, expect, it } from "vitest";

import {
  FX_SOURCE_ORDER,
  FX_TRANSPORT_ORDER,
  FX_TRANSPORTS,
  getFxTransportInfo,
} from "@/injection/firefox/bootstrap-transport-manifest";

describe("FX_TRANSPORTS", () => {
  it("declares every Firefox bootstrap transport exactly once", () => {
    expect(FX_TRANSPORTS.map(({ source }) => source)).toEqual([...FX_TRANSPORT_ORDER]);
  });

  it("marks hash as the single main transport", () => {
    const mainTransports = FX_TRANSPORTS.filter(({ status }) => status === "main");

    expect(mainTransports).toHaveLength(1);
    expect(mainTransports[0]?.source).toBe("hash");
  });

  it("marks static, window.name, and userScript as backup transports", () => {
    expect(
      FX_TRANSPORTS.filter(({ status }) => status === "backup").map(
        ({ source }) => source,
      ),
    ).toEqual(["static", "windowName", "userScript"]);
  });

  it("marks ephemeral transport as the late-closure path", () => {
    expect(
      FX_TRANSPORTS.filter(({ status }) => status === "late-closure").map(
        ({ source }) => source,
      ),
    ).toEqual(["ephemeral"]);
  });

  it("keeps optional-permission transports as backup-only", () => {
    expect(
      FX_TRANSPORTS.filter(({ needsOptionalPermission }) => needsOptionalPermission),
    ).toEqual([getFxTransportInfo("userScript")]);
  });

  it("defines a single canonical source order for runtime selection", () => {
    expect(FX_SOURCE_ORDER).toEqual(["hash", "static", "windowName", "ephemeral"]);
  });

  it("marks userScript as carrier-only so it does not compete as a selected source", () => {
    expect(getFxTransportInfo("userScript")).toMatchObject({
      selectionScope: "carrier-only",
      precedence: null,
    });
    expect(FX_SOURCE_ORDER).not.toContain("userScript");
  });
});

describe("getFxTransportInfo", () => {
  it("returns the hash transport manifest entry", () => {
    expect(getFxTransportInfo("hash")).toEqual({
      source: "hash",
      role: "authoritative-early-seed",
      status: "main",
      visibility: "visible",
      needsOptionalPermission: false,
      description:
        "URL hash seed used for the current navigation's first-inline bootstrap.",
      precedence: 0,
      selectionScope: "bootstrap-source",
    });
  });

  it("returns the late-convergence manifest entry for ephemeral transport", () => {
    expect(getFxTransportInfo("ephemeral")).toMatchObject({
      source: "ephemeral",
      role: "late-convergence",
      status: "late-closure",
      visibility: "hidden",
      needsOptionalPermission: false,
      precedence: 3,
      selectionScope: "bootstrap-source",
    });
  });
});
