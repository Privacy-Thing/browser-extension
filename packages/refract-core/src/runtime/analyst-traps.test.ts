import { expect, it } from "vitest";

import { createAnalystTrapState } from "./analyst-traps";
import { privateSetHas, privateSetDelete, privateSetClear } from "./primordials";

it("builds independent private method selections for each activation", () => {
  const config = {
    methods: ["battery.manager.level"] as const,
    mode: "first-call" as const,
  };
  const first = createAnalystTrapState(config);
  const second = createAnalystTrapState(config);
  expect(first.first).toBe(true);
  expect(privateSetHas(first.methods, "battery.manager.level")).toBe(true);
  expect(privateSetHas(first.methods, "date.now")).toBe(false);
  privateSetDelete(first.methods, "battery.manager.level");
  expect(privateSetHas(first.methods, "battery.manager.level")).toBe(false);
  expect(privateSetHas(second.methods, "battery.manager.level")).toBe(true);
  privateSetClear(second.methods);
  expect(privateSetHas(second.methods, "battery.manager.level")).toBe(false);
});
