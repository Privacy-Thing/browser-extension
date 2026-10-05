import { expect, it } from "vitest";

import { normalizePreferences } from "./settings-defaults";
import {
  applyWorkerException,
  isWorkerPolicyExceptions,
  normalizeWorkerPolicies,
} from "./worker-policy-exceptions";
it("accepts only explicit policy exceptions for canonical exact hosts", () => {
  for (const value of [
    { "*.example.com": { serviceWorker: false } },
    { "example.com/path": { serviceWorker: false } },
    { "example.com": { canvas: false } },
    { "example.com": {} },
    { "example.com": { sharedWorker: "spoof" } },
    JSON.parse('{"__proto__":{"serviceWorker":false}}'),
  ]) {
    expect(isWorkerPolicyExceptions(value)).toBe(false);
    expect(normalizeWorkerPolicies(value)).toEqual({});
  }
  expect(normalizePreferences({}).workerPolicyExceptions).toEqual({});
});
it("changes only the selected policy and never activates Trusted Sites or disabled protection", () => {
  const baseline = {
    geo: { latitude: 52 },
    authKey: "unchanged",
    fingerprint: { canvasNoiseSeed: 123 },
    blockServiceWorkerRegistration: true,
    sharedWorkerHandlingMode: "strict",
  };
  const exceptions = { "h.example": { sharedWorker: "native" as const } };
  expect(applyWorkerException(baseline, "h.example", exceptions)).toEqual({
    ...baseline,
    sharedWorkerHandlingMode: "native",
    sharedWorkerCompatibilityMode: true,
  });
  expect(applyWorkerException(baseline, "k.example", exceptions)).toBe(baseline);
  expect(applyWorkerException(null, "h.example", exceptions)).toBeNull();
});
