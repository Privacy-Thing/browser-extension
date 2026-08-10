import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

// The emitter uses a module-scope Set; re-import fresh per test to avoid
// cross-test state leakage.
describe("markSurfaceFailed", () => {
  const dispatchEvent = vi.fn();
  let setTimeoutSpy: MockInstance;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    vi.stubGlobal("document", { dispatchEvent, addEventListener: vi.fn() });
    dispatchEvent.mockClear();
    setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const getEmitter = async () => {
    const mod =
      await import("@privacy-brand/refract-browser/common/surface-error-emitter");
    return mod.markSurfaceFailed as unknown as (category: string) => void;
  };

  it("defers the CustomEvent dispatch by one tick and then fires", async () => {
    const markSurfaceFailed = await getEmitter();
    markSurfaceFailed("geolocation");
    // Before tick: no dispatch yet
    expect(dispatchEvent).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(dispatchEvent).toHaveBeenCalledOnce();
    const event = dispatchEvent.mock.calls[0]?.[0] as CustomEvent;
    const detail = JSON.parse(event.detail as string) as { categories: string[] };
    expect(detail.categories).toContain("geolocation");
  });

  it("does not dispatch again for the same category (deduplication)", async () => {
    const markSurfaceFailed = await getEmitter();
    markSurfaceFailed("canvas");
    markSurfaceFailed("canvas");
    vi.runAllTimers();
    expect(dispatchEvent).toHaveBeenCalledOnce();
  });

  it("dispatches separately for each unique category", async () => {
    const markSurfaceFailed = await getEmitter();
    markSurfaceFailed("webGL");
    markSurfaceFailed("audio");
    vi.runAllTimers();
    expect(dispatchEvent).toHaveBeenCalledTimes(2);
  });

  it("does not throw when dispatchEvent throws", async () => {
    dispatchEvent.mockImplementationOnce(() => {
      throw new Error("denied");
    });
    const markSurfaceFailed = await getEmitter();
    expect(() => {
      markSurfaceFailed("screen");
      vi.runAllTimers();
    }).not.toThrow();
  });

  it("schedules setTimeout with delay 0", async () => {
    const markSurfaceFailed = await getEmitter();
    markSurfaceFailed("timeLocale");
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 0);
  });
});
