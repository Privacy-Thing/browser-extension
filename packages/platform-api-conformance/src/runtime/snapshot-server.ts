import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import { BRAND_DISPLAY_NAME } from "@privacy-brand/tooling-shared/brand";

import { TEST_SERVER_HOST } from "./snapshot-fixtures.js";

const CONFORMANCE_PAGE_TITLE = `${BRAND_DISPLAY_NAME} Conformance`;

const DEDICATED_WORKER_SOURCE = `
self.__PT_CONFORMANCE_SERIALIZE__ = (val) => {
  if (val === undefined) return "undefined";
  if (val === null) return "null";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
};
self.__PT_CONFORMANCE_ERROR__ = (error) =>
  "[Error: " + (error instanceof Error ? error.name : String(error)) + "]";
self.__PT_CONFORMANCE_EVAL__ = (expression) =>
  new Function("return " + expression)();
self.__PT_CONFORMANCE_FUNCTION_LIES__ = (probe) => {
  const target = self.__PT_CONFORMANCE_EVAL__(probe.expression);
  if (typeof target !== "function") {
    return {
      targetType: typeof target,
      targetMissing: target == null
    };
  }

  const outcome = (callback) => {
    try {
      return self.__PT_CONFORMANCE_SERIALIZE__(callback());
    } catch (error) {
      return self.__PT_CONFORMANCE_ERROR__(error);
    }
  };

  const result = {
    name: target.name,
    length: target.length,
    hasPrototype: "prototype" in target,
    ownNames: Object.getOwnPropertyNames(target).sort(),
    descriptorKeys: Object.keys(Object.getOwnPropertyDescriptors(target)).sort(),
    sourceLooksNative: Function.prototype.toString.call(target).includes("[native code]"),
    toStringLooksNative: Function.prototype.toString.call(target.toString).includes("[native code]"),
    newOutcome: outcome(() => Reflect.construct(target, [])),
    classExtendsOutcome: outcome(() => {
      const subclass = class extends target {};
      return typeof subclass === "function" ? "ok" : "unexpected";
    })
  };

  if (probe.receiverExpression || probe.callArgsExpression) {
    const receiver = probe.receiverExpression
      ? self.__PT_CONFORMANCE_EVAL__(probe.receiverExpression)
      : undefined;
    const rawArgs = probe.callArgsExpression
      ? self.__PT_CONFORMANCE_EVAL__(probe.callArgsExpression)
      : [];
    const args = Array.isArray(rawArgs) ? rawArgs : [];
    result.callOutcome = outcome(() => Reflect.apply(target, receiver, args));
    result.applyOutcome = outcome(() =>
      Reflect.apply(Function.prototype.apply, target, [receiver, args])
    );
  }

  return result;
};
self.addEventListener("message", async (event) => {
  try {
    const probe = event.data.probe;
    const value =
      probe.kind === "function-lies"
        ? self.__PT_CONFORMANCE_FUNCTION_LIES__(probe)
        : await Promise.resolve(self.__PT_CONFORMANCE_EVAL__(probe.expression));
    self.postMessage({
      ok: true,
      value: typeof value === "string"
        ? value
        : self.__PT_CONFORMANCE_SERIALIZE__(value)
    });
  } catch (error) {
    self.postMessage({
      ok: false,
      value: "[Error: " + (error instanceof Error ? error.message : String(error)) + "]"
    });
  }
}, { once: false });`;

const SHARED_WORKER_SOURCE = `
self.__PT_CONFORMANCE_SERIALIZE__ = (val) => {
  if (val === undefined) return "undefined";
  if (val === null) return "null";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
};
self.__PT_CONFORMANCE_ERROR__ = (error) =>
  "[Error: " + (error instanceof Error ? error.name : String(error)) + "]";
self.__PT_CONFORMANCE_EVAL__ = (expression) =>
  new Function("return " + expression)();
self.__PT_CONFORMANCE_FUNCTION_LIES__ = (probe) => {
  const target = self.__PT_CONFORMANCE_EVAL__(probe.expression);
  if (typeof target !== "function") {
    return {
      targetType: typeof target,
      targetMissing: target == null
    };
  }

  const outcome = (callback) => {
    try {
      return self.__PT_CONFORMANCE_SERIALIZE__(callback());
    } catch (error) {
      return self.__PT_CONFORMANCE_ERROR__(error);
    }
  };

  const result = {
    name: target.name,
    length: target.length,
    hasPrototype: "prototype" in target,
    ownNames: Object.getOwnPropertyNames(target).sort(),
    descriptorKeys: Object.keys(Object.getOwnPropertyDescriptors(target)).sort(),
    sourceLooksNative: Function.prototype.toString.call(target).includes("[native code]"),
    toStringLooksNative: Function.prototype.toString.call(target.toString).includes("[native code]"),
    newOutcome: outcome(() => Reflect.construct(target, [])),
    classExtendsOutcome: outcome(() => {
      const subclass = class extends target {};
      return typeof subclass === "function" ? "ok" : "unexpected";
    })
  };

  if (probe.receiverExpression || probe.callArgsExpression) {
    const receiver = probe.receiverExpression
      ? self.__PT_CONFORMANCE_EVAL__(probe.receiverExpression)
      : undefined;
    const rawArgs = probe.callArgsExpression
      ? self.__PT_CONFORMANCE_EVAL__(probe.callArgsExpression)
      : [];
    const args = Array.isArray(rawArgs) ? rawArgs : [];
    result.callOutcome = outcome(() => Reflect.apply(target, receiver, args));
    result.applyOutcome = outcome(() =>
      Reflect.apply(Function.prototype.apply, target, [receiver, args])
    );
  }

  return result;
};
self.addEventListener("connect", (event) => {
  const port = event.ports[0];

  port.addEventListener("message", async (messageEvent) => {
    try {
      const probe = messageEvent.data.probe;
      const value =
        probe.kind === "function-lies"
          ? self.__PT_CONFORMANCE_FUNCTION_LIES__(probe)
          : await Promise.resolve(self.__PT_CONFORMANCE_EVAL__(probe.expression));
      port.postMessage({
        ok: true,
        value: typeof value === "string"
          ? value
          : self.__PT_CONFORMANCE_SERIALIZE__(value)
      });
    } catch (error) {
      port.postMessage({
        ok: false,
        value: "[Error: " + (error instanceof Error ? error.message : String(error)) + "]"
      });
    }
  });

  port.start();
});`;

const sendJavaScript = (response: ServerResponse, source: string): void => {
  response.writeHead(200, {
    "Content-Type": "application/javascript; charset=utf-8",
  });
  response.end(source);
};

const handleRequest = (request: IncomingMessage, response: ServerResponse): void => {
  if (request.url === "/__conformance_worker__.js") {
    sendJavaScript(response, DEDICATED_WORKER_SOURCE);
    return;
  }
  if (request.url === "/__conformance_shared_worker__.js") {
    sendJavaScript(response, SHARED_WORKER_SOURCE);
    return;
  }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(
    `<!DOCTYPE html><html><head><title>${CONFORMANCE_PAGE_TITLE}</title></head><body></body></html>`,
  );
};

export const startTestServer = (): Promise<{ url: string; server: Server }> =>
  new Promise((resolve, reject) => {
    const server = createServer(handleRequest);
    server.on("error", reject);
    server.listen(0, TEST_SERVER_HOST, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Test server failed to start"));
        return;
      }
      resolve({ url: `http://${TEST_SERVER_HOST}:${address.port}`, server });
    });
  });

export function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
}
