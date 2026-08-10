import { describe, expect, it, vi } from "vitest";

import {
  consumeFxStateSources,
  findFxSourceOrderIssue,
} from "@/injection/firefox/bootstrap-state-order";
import {
  FX_SOURCE_ORDER,
  FX_TRANSPORTS,
  getFxTransportInfo,
} from "@/injection/firefox/bootstrap-transport-manifest";

describe("consumeFxStateSources", () => {
  it("prefers the earliest authoritative hash seed over later channels", () => {
    const consumeHashSeedState = vi.fn(() => true);
    const consumeWindowNameState = vi.fn(() => true);
    const consumeEphemeralState = vi.fn(() => true);

    expect(
      consumeFxStateSources([
        {
          ...getFxTransportInfo("hash"),
          consume: consumeHashSeedState,
        },
        {
          ...getFxTransportInfo("windowName"),
          consume: consumeWindowNameState,
        },
        {
          ...getFxTransportInfo("ephemeral"),
          consume: consumeEphemeralState,
        },
      ]),
    ).toEqual({
      source: "hash",
      role: "authoritative-early-seed",
      status: "main",
      visibility: "visible",
      needsOptionalPermission: false,
    });

    expect(consumeHashSeedState).toHaveBeenCalledTimes(1);
    expect(consumeWindowNameState).not.toHaveBeenCalled();
    expect(consumeEphemeralState).not.toHaveBeenCalled();
  });

  it("falls back to the embedded static payload before window.name", () => {
    const consumeHashSeedState = vi.fn(() => false);
    const consumeStaticState = vi.fn(() => true);
    const consumeWindowNameState = vi.fn(() => true);
    const consumeEphemeralState = vi.fn(() => true);

    expect(
      consumeFxStateSources([
        {
          ...getFxTransportInfo("hash"),
          consume: consumeHashSeedState,
        },
        {
          ...getFxTransportInfo("static"),
          consume: consumeStaticState,
        },
        {
          ...getFxTransportInfo("windowName"),
          consume: consumeWindowNameState,
        },
        {
          ...getFxTransportInfo("ephemeral"),
          consume: consumeEphemeralState,
        },
      ]),
    ).toEqual({
      source: "static",
      role: "authoritative-early-seed",
      status: "backup",
      visibility: "hidden",
      needsOptionalPermission: false,
    });

    expect(consumeHashSeedState).toHaveBeenCalledTimes(1);
    expect(consumeStaticState).toHaveBeenCalledTimes(1);
    expect(consumeWindowNameState).not.toHaveBeenCalled();
    expect(consumeEphemeralState).not.toHaveBeenCalled();
  });

  it("falls back to window.name when static is unavailable", () => {
    const consumeHashSeedState = vi.fn(() => false);
    const consumeStaticState = vi.fn(() => false);
    const consumeWindowNameState = vi.fn(() => true);
    const consumeEphemeralState = vi.fn(() => true);

    expect(
      consumeFxStateSources([
        {
          ...getFxTransportInfo("hash"),
          consume: consumeHashSeedState,
        },
        {
          ...getFxTransportInfo("static"),
          consume: consumeStaticState,
        },
        {
          ...getFxTransportInfo("windowName"),
          consume: consumeWindowNameState,
        },
        {
          ...getFxTransportInfo("ephemeral"),
          consume: consumeEphemeralState,
        },
      ]),
    ).toEqual({
      source: "windowName",
      role: "authoritative-early-seed",
      status: "backup",
      visibility: "hidden",
      needsOptionalPermission: false,
    });

    expect(consumeHashSeedState).toHaveBeenCalledTimes(1);
    expect(consumeStaticState).toHaveBeenCalledTimes(1);
    expect(consumeWindowNameState).toHaveBeenCalledTimes(1);
    expect(consumeEphemeralState).not.toHaveBeenCalled();
  });

  it("falls back to the late ephemeral DOM seed last", () => {
    const consumeHashSeedState = vi.fn(() => false);
    const consumeStaticState = vi.fn(() => false);
    const consumeWindowNameState = vi.fn(() => false);
    const consumeEphemeralState = vi.fn(() => true);

    expect(
      consumeFxStateSources([
        {
          ...getFxTransportInfo("hash"),
          consume: consumeHashSeedState,
        },
        {
          ...getFxTransportInfo("static"),
          consume: consumeStaticState,
        },
        {
          ...getFxTransportInfo("windowName"),
          consume: consumeWindowNameState,
        },
        {
          ...getFxTransportInfo("ephemeral"),
          consume: consumeEphemeralState,
        },
      ]),
    ).toEqual({
      source: "ephemeral",
      role: "late-convergence",
      status: "late-closure",
      visibility: "hidden",
      needsOptionalPermission: false,
    });

    expect(consumeHashSeedState).toHaveBeenCalledTimes(1);
    expect(consumeStaticState).toHaveBeenCalledTimes(1);
    expect(consumeWindowNameState).toHaveBeenCalledTimes(1);
    expect(consumeEphemeralState).toHaveBeenCalledTimes(1);
  });

  it("returns null when all sources fail to consume state", () => {
    const consumeHash = vi.fn(() => false);
    const consumeEphemeral = vi.fn(() => false);

    expect(
      consumeFxStateSources([
        {
          ...getFxTransportInfo("hash"),
          consume: consumeHash,
        },
        {
          ...getFxTransportInfo("static"),
          consume: vi.fn(() => false),
        },
        {
          ...getFxTransportInfo("ephemeral"),
          consume: consumeEphemeral,
        },
      ]),
    ).toBeNull();

    expect(consumeHash).toHaveBeenCalledTimes(1);
    expect(consumeEphemeral).toHaveBeenCalledTimes(1);
  });

  it("calls each consumer exactly once and stops after the first success", () => {
    const consumeHash = vi.fn(() => false);
    const consumeStatic = vi.fn(() => false);
    const consumeWindowName = vi.fn(() => true);
    const consumeEphemeral = vi.fn(() => true);

    consumeFxStateSources([
      {
        ...getFxTransportInfo("hash"),
        consume: consumeHash,
      },
      {
        ...getFxTransportInfo("static"),
        consume: consumeStatic,
      },
      {
        ...getFxTransportInfo("windowName"),
        consume: consumeWindowName,
      },
      {
        ...getFxTransportInfo("ephemeral"),
        consume: consumeEphemeral,
      },
    ]);

    expect(consumeHash).toHaveBeenCalledTimes(1);
    expect(consumeStatic).toHaveBeenCalledTimes(1);
    expect(consumeWindowName).toHaveBeenCalledTimes(1);
    expect(consumeEphemeral).not.toHaveBeenCalled();
  });
});

describe("findFxSourceOrderIssue", () => {
  it("accepts the canonical four-source ordering", () => {
    expect(
      findFxSourceOrderIssue([
        { ...getFxTransportInfo("hash") },
        { ...getFxTransportInfo("static") },
        { ...getFxTransportInfo("windowName") },
        { ...getFxTransportInfo("ephemeral") },
      ]),
    ).toBeNull();
  });

  it("accepts all authoritative-early-seed sources without a late-convergence entry", () => {
    expect(
      findFxSourceOrderIssue([
        { ...getFxTransportInfo("hash") },
        { ...getFxTransportInfo("static") },
        { ...getFxTransportInfo("windowName") },
      ]),
    ).toBeNull();
  });

  it("rejects an authoritative-early-seed source following a late-convergence source", () => {
    const violation = findFxSourceOrderIssue([
      { ...getFxTransportInfo("ephemeral") },
      { ...getFxTransportInfo("hash") },
    ]);

    expect(violation).toMatch(/hash/);
    expect(violation).toMatch(/authoritative-early-seed/);
    expect(violation).toMatch(/must not follow/);
  });

  it("rejects carrier-only transports in the runtime source ordering", () => {
    const violation = findFxSourceOrderIssue([{ ...getFxTransportInfo("userScript") }]);

    expect(violation).toMatch(/carrier-only/);
    expect(violation).toMatch(/userScript/);
  });

  it("rejects lower-priority static payload ahead of navigation seed sources", () => {
    const violation = findFxSourceOrderIssue([
      { ...getFxTransportInfo("static") },
      { ...getFxTransportInfo("hash") },
    ]);

    expect(violation).toMatch(/static/);
    expect(violation).toMatch(/higher-priority bootstrap source/);
  });

  it("accepts an empty consumer list", () => {
    expect(findFxSourceOrderIssue([])).toBeNull();
  });

  it("keeps the registry in the same order as the canonical consumer list", () => {
    expect(
      FX_TRANSPORTS.filter(
        ({ selectionScope }) => selectionScope === "bootstrap-source",
      ).map(({ source }) => source),
    ).toEqual([...FX_SOURCE_ORDER]);
  });
});
