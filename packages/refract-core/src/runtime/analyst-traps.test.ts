import { describe, expect, it, vi } from "vitest";

import { bindAnalystTraps } from "./analyst-traps";

describe("selective API pauses", () => {
  it("returns the identical plain function without a selection", () => {
    const plain = vi.fn();
    expect(bindAnalystTraps(plain, undefined)).toBe(plain);
  });
  it("pauses once per selected method and preserves all usage calls", () => {
    const plain = vi.fn();
    const stop = vi.fn();
    const emit = bindAnalystTraps(
      plain,
      { methods: ["battery.manager.level", "date.now"], mode: "first-call" },
      stop,
    );
    emit("battery", "battery.getBattery");
    expect(stop).not.toHaveBeenCalled();
    emit("battery", "battery.manager.level");
    emit("battery", "battery.manager.level");
    expect(stop).toHaveBeenCalledTimes(1);
    emit("timeLocale", "date.now");
    emit("timeLocale", "date.now");
    expect(stop).toHaveBeenCalledTimes(2);
    expect(plain).toHaveBeenCalledTimes(5);
  });
  it("every-call pauses only selected methods and a fresh activation resets first-call", () => {
    const stop = vi.fn();
    const config = {
      methods: ["battery.manager.level"] as const,
      mode: "every-call" as const,
    };
    const emit = bindAnalystTraps(vi.fn(), config, stop);
    emit("timeLocale", "date.now");
    emit("battery", "battery.manager.level");
    emit("battery", "battery.manager.level");
    expect(stop).toHaveBeenCalledTimes(2);
    for (let i = 0; i < 2; i += 1) {
      const first = bindAnalystTraps(vi.fn(), { ...config, mode: "first-call" }, stop);
      first("battery", "battery.manager.level");
      first("battery", "battery.manager.level");
    }
    expect(stop).toHaveBeenCalledTimes(4);
  });
});
