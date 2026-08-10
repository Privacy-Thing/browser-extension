import { describe, expect, it } from "vitest";

import { isWorkerCspViolation } from "./worker-csp-listener";

const makeEvent = (
  effectiveDirective: string,
  violatedDirective: string,
): SecurityPolicyViolationEvent =>
  ({
    effectiveDirective,
    violatedDirective,
  }) as unknown as SecurityPolicyViolationEvent;

describe("isWorkerCspViolation", () => {
  it("matches when effectiveDirective contains worker-src", () => {
    expect(isWorkerCspViolation(makeEvent("worker-src blob:", ""))).toBe(true);
  });

  it("matches when violatedDirective contains worker-src (effectiveDirective absent)", () => {
    expect(isWorkerCspViolation(makeEvent("", "worker-src 'none'"))).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isWorkerCspViolation(makeEvent("Worker-Src blob:", ""))).toBe(true);
  });

  it("does not match unrelated directives", () => {
    expect(
      isWorkerCspViolation(makeEvent("script-src 'none'", "script-src 'none'")),
    ).toBe(false);
  });

  it("does not match when both directives are empty", () => {
    expect(isWorkerCspViolation(makeEvent("", ""))).toBe(false);
  });
});
