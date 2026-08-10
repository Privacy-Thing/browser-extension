/**
 * Assertion helpers for Refract installation verification.
 *
 * Used in integration tests to verify:
 * - installRuntimeOnce behavior in realm simulations
 * - No double-wrapping of APIs
 * - Descriptor shape compliance
 * - Native toString masking
 */

import type { RefractRuntimeState } from "@privacy-brand/refract-core";
import { expect } from "vitest";

/**
 * Asserts that a runtime state object is fully initialized after installation.
 */
export const assertStateInstalled = (
  state: RefractRuntimeState | undefined,
  expectedModules?: string[],
): void => {
  expect(state, "RefractRuntimeState must exist after installation").toBeDefined();
  expect(state!.installed, "state.installed must be true").toBe(true);
  expect(state!.installedAt, "state.installedAt must be set").toBeGreaterThan(0);

  if (expectedModules) {
    for (const mod of expectedModules) {
      expect(
        state!.modules.has(mod as any),
        `module "${mod}" must be registered in state.modules`,
      ).toBe(true);
    }
  }
};

/**
 * Asserts that calling the installer a second time does NOT reset the state.
 * Verifies idempotency: installedAt and modules are unchanged after re-install.
 */
export const assertInstallIdempotent = (
  firstState: RefractRuntimeState,
  secondState: RefractRuntimeState,
): void => {
  expect(secondState, "second install must return the same state reference").toBe(
    firstState,
  );
  expect(secondState.installed, "installed flag must remain true").toBe(true);
  expect(secondState.installedAt, "installedAt must not be reset").toBe(
    firstState.installedAt,
  );
};

/**
 * Asserts that a patched function has native-looking toString output.
 * Per spec §7 (Native Prototype & Descriptor Shape Verification).
 */
export const assertNativeToString = (fn: Function, expectedName: string): void => {
  const str = Function.prototype.toString.call(fn);
  expect(str, `${expectedName}.toString() must look native`).toMatch(
    /\{ \[native code\] \}/,
  );
};

/**
 * Asserts that a property descriptor on a target object is correctly shaped.
 * Per spec §7: configurable, enumerable, writable as specified.
 */
export const assertDescriptorShape = (
  target: object,
  property: string,
  expected: Partial<PropertyDescriptor>,
): void => {
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  expect(descriptor, `Property "${property}" must have a descriptor`).toBeDefined();

  for (const [key, value] of Object.entries(expected)) {
    expect(
      descriptor![key as keyof PropertyDescriptor],
      `descriptor.${key} for "${property}"`,
    ).toBe(value);
  }
};

/**
 * Asserts that a method throws "Illegal invocation" when called on an
 * invalid receiver. Per spec §7.
 */
export const assertIllegalInvocation = (
  fn: Function,
  invalidReceiver: unknown,
  args: unknown[] = [],
): void => {
  expect(
    () => fn.call(invalidReceiver, ...args),
    "Must throw on invalid receiver",
  ).toThrow();
};
