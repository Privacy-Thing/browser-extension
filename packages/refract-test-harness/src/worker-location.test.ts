import { installWorkerLocation } from "@privacy-brand/refract-worker/worker-location";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const WORKER_URL = "https://www.facebook.com/path/worker.js";
const RELATIVE = "/ajax/foo?x=1";
const ABSOLUTE = "https://example.com/abs?y=2";

// installWorkerLocation reads worker globals (`self`, XMLHttpRequest,
// WebSocket, EventSource). The vitest env is "node", so stub them on globalThis
// and restore afterwards to keep tests deterministic and isolated.
type MutableGlobal = typeof globalThis & {
  self?: typeof globalThis;
  WorkerLocation?: unknown;
  XMLHttpRequest?: unknown;
  WebSocket?: unknown;
  EventSource?: unknown;
};

const snapshotKeys = [
  "self",
  "WorkerLocation",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
] as const;
const original: Record<(typeof snapshotKeys)[number], PropertyDescriptor | undefined> =
  {
    self: undefined,
    WorkerLocation: undefined,
    XMLHttpRequest: undefined,
    WebSocket: undefined,
    EventSource: undefined,
  };

let openCalls: unknown[][] = [];
let wsUrls: string[] = [];
let esUrls: string[] = [];

class FakeXHR {
  open(...args: unknown[]): void {
    openCalls.push(args);
  }
}

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  constructor(url: string) {
    wsUrls.push(url);
  }
}

class FakeEventSource {
  constructor(url: string) {
    esUrls.push(url);
  }
}

beforeEach(() => {
  for (const key of snapshotKeys) {
    original[key] = Object.getOwnPropertyDescriptor(globalThis, key);
  }
  openCalls = [];
  wsUrls = [];
  esUrls = [];

  const g = globalThis as MutableGlobal;
  Object.defineProperty(globalThis, "self", { configurable: true, value: globalThis });
  Object.defineProperty(globalThis, "XMLHttpRequest", {
    configurable: true,
    writable: true,
    value: FakeXHR,
  });
  Object.defineProperty(globalThis, "WebSocket", {
    configurable: true,
    writable: true,
    value: FakeWebSocket,
  });
  Object.defineProperty(globalThis, "EventSource", {
    configurable: true,
    writable: true,
    value: FakeEventSource,
  });
  // WorkerLocation intentionally left undefined — the location-getter branch is
  // optional and not under test here.
  delete g.WorkerLocation;
});

afterEach(() => {
  for (const key of snapshotKeys) {
    const descriptor = original[key];
    if (descriptor) {
      Object.defineProperty(globalThis, key, descriptor);
    } else {
      delete (globalThis as MutableGlobal)[key];
    }
  }
});

describe("installWorkerLocation relative-URL repair", () => {
  it("resolves a relative XMLHttpRequest.open URL against the real worker URL", () => {
    installWorkerLocation(WORKER_URL);

    const xhr = new (globalThis as MutableGlobal).XMLHttpRequest!() as InstanceType<
      typeof FakeXHR
    >;
    xhr.open("GET", RELATIVE, true, "user", "pass");

    expect(openCalls).toHaveLength(1);
    expect(openCalls[0]).toEqual([
      "GET",
      "https://www.facebook.com/ajax/foo?x=1",
      true,
      "user",
      "pass",
    ]);
  });

  it("leaves an absolute XMLHttpRequest.open URL unchanged", () => {
    installWorkerLocation(WORKER_URL);

    const xhr = new (globalThis as MutableGlobal).XMLHttpRequest!() as InstanceType<
      typeof FakeXHR
    >;
    xhr.open("POST", ABSOLUTE);

    expect(openCalls[0]).toEqual(["POST", ABSOLUTE]);
  });

  it("preserves XMLHttpRequest.open native-shape (name, length, toString)", () => {
    installWorkerLocation(WORKER_URL);

    const patched = (globalThis as MutableGlobal).XMLHttpRequest as unknown as {
      prototype: { open: (...args: unknown[]) => void };
    };
    expect(patched.prototype.open.name).toBe("open");
    expect(Function.prototype.toString.call(patched.prototype.open)).toContain(
      "[native code]",
    );
  });

  it("resolves a relative WebSocket URL and preserves readyState constants", () => {
    installWorkerLocation(WORKER_URL);

    const PatchedWS = (globalThis as MutableGlobal).WebSocket as unknown as {
      new (url: string): unknown;
      OPEN: number;
      CLOSED: number;
    };
    new PatchedWS(RELATIVE);

    expect(wsUrls).toEqual(["https://www.facebook.com/ajax/foo?x=1"]);
    expect(PatchedWS.OPEN).toBe(1);
    expect(PatchedWS.CLOSED).toBe(3);
    expect(Function.prototype.toString.call(PatchedWS)).toContain("[native code]");
  });

  it("resolves a relative EventSource URL and forwards an absolute one unchanged", () => {
    installWorkerLocation(WORKER_URL);

    const PatchedES = (globalThis as MutableGlobal).EventSource as unknown as {
      new (url: string): unknown;
    };
    new PatchedES(RELATIVE);
    new PatchedES(ABSOLUTE);

    expect(esUrls).toEqual(["https://www.facebook.com/ajax/foo?x=1", ABSOLUTE]);
  });
});
