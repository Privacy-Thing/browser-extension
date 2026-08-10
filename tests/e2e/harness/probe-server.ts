import { readFileSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CHROMIUM_PAGE_SCRIPT } from "./chromium-page-script";
import { TEST_COOKIE_NAME } from "./probe-state";

export type StartedProbeServers = {
  primaryUrl: string;
  secondaryUrl: string;
  close: () => Promise<void>;
};

export type ProbeServerOptions = {
  primaryPort?: number;
  secondaryPort?: number;
  secondaryPublicHost?: string;
};

type RouteContext = {
  currentOrigin: string;
  otherOrigin: string;
};

const PROBES_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "probes",
);
const PRIMARY_HOST = "127.0.0.1";
const PRIMARY_PORT = 60722;
const SECONDARY_BIND_HOST = "127.0.0.1";
const SECONDARY_PUBLIC_HOST = "localhost";
const SECONDARY_PORT = 60723;
const WORKER_PROBE_PATH = path.join(PROBES_ROOT, "chromium-worker-probe.js");
const SHARED_WORKER_PROBE_PATH = path.join(
  PROBES_ROOT,
  "chromium-shared-worker-probe.js",
);
const SERVICE_WORKER_PATH = path.join(PROBES_ROOT, "chromium-service-worker-probe.js");
const INLINE_FIRST_PAGE_PATH = path.join(PROBES_ROOT, "chromium-inline-first.html");
const INLINE_BATTERY_PAGE_PATH = path.join(PROBES_ROOT, "chromium-inline-battery.html");
const INLINE_FRAME_PAGE_PATH = path.join(PROBES_ROOT, "chromium-inline-frame.html");
const INLINE_GEO_PAGE_PATH = path.join(PROBES_ROOT, "chromium-inline-geo.html");
const CHROMIUM_HOST_PAGE_PATH = path.join(PROBES_ROOT, "chromium-host.html");
const CHROMIUM_FRAME_PAGE_PATH = path.join(PROBES_ROOT, "chromium-frame.html");
const ACCEPT_CH_VALUE = [
  "Sec-CH-UA-Full-Version-List",
  "Sec-CH-UA-Platform-Version",
  "Sec-CH-UA-Arch",
  "Sec-CH-UA-Bitness",
  "Sec-CH-UA-Model",
].join(", ");
const closeServer = async (server: Server): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });

const send = (
  response: ServerResponse,
  statusCode: number,
  body: string,
  headers: Record<string, string>,
): void => {
  response.writeHead(statusCode, headers);
  response.end(body);
};

const readTextFile = (filePath: string): string => readFileSync(filePath, "utf8");

const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader
    .split(/;\s*/)
    .reduce<Record<string, string>>((accumulator, item) => {
      const separatorIndex = item.indexOf("=");
      if (separatorIndex === -1) {
        return accumulator;
      }

      const key = item.slice(0, separatorIndex).trim();
      const value = item.slice(separatorIndex + 1).trim();
      if (!key) {
        return accumulator;
      }

      accumulator[key] = value;
      return accumulator;
    }, {});
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const readRequestPayload = async (request: IncomingMessage): Promise<unknown> => {
  const buffers: Buffer[] = [];

  for await (const chunk of request) {
    buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (buffers.length === 0) {
    return null;
  }

  const rawBody = Buffer.concat(buffers).toString("utf8");
  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return rawBody;
  }
};

const buildEchoPayload = (request: IncomingMessage, currentOrigin: string) => {
  const requestUrl = new URL(request.url ?? "/", currentOrigin);

  return {
    method: request.method ?? "GET",
    href: requestUrl.href,
    path: requestUrl.pathname,
    search: requestUrl.search,
    headers: Object.fromEntries(
      Object.entries(request.headers).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(", ") : (value ?? ""),
      ]),
    ),
    cookies: parseCookies(request.headers.cookie),
  };
};

const applyCorsHeaders = (
  request: IncomingMessage,
  responseHeaders: Record<string, string>,
  context: RouteContext,
): void => {
  const requestOrigin = request.headers.origin;
  if (!requestOrigin) {
    return;
  }

  if (
    requestOrigin !== context.currentOrigin &&
    requestOrigin !== context.otherOrigin
  ) {
    return;
  }

  responseHeaders["Access-Control-Allow-Origin"] = requestOrigin;
  responseHeaders["Access-Control-Allow-Credentials"] = "true";
  responseHeaders["Access-Control-Allow-Headers"] = "content-type";
  responseHeaders["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
  responseHeaders["Vary"] = "Origin";
};

const buildCookieHeader = (
  requestUrl: URL,
  payload: Record<string, unknown>,
): string => {
  const name =
    typeof payload.name === "string" && payload.name ? payload.name : TEST_COOKIE_NAME;
  const value = typeof payload.value === "string" ? payload.value : "present";
  const cookiePath =
    typeof payload.path === "string" && payload.path.startsWith("/")
      ? payload.path
      : "/";
  const sameSite =
    payload.sameSite === "Strict" || payload.sameSite === "None"
      ? payload.sameSite
      : "Lax";
  const httpOnly = payload.httpOnly === true;
  const secure = payload.secure === true;
  const maxAge =
    typeof payload.maxAge === "number" && Number.isFinite(payload.maxAge)
      ? `; Max-Age=${Math.trunc(payload.maxAge)}`
      : "";
  const expires =
    typeof payload.expires === "string" && payload.expires
      ? `; Expires=${payload.expires}`
      : "";
  const domain =
    typeof payload.domain === "string" &&
    payload.domain &&
    requestUrl.hostname !== payload.domain
      ? `; Domain=${payload.domain}`
      : "";

  return `${name}=${value}; Path=${cookiePath}; SameSite=${sameSite}${httpOnly ? "; HttpOnly" : ""}${secure ? "; Secure" : ""}${maxAge}${expires}${domain}`;
};

const handleApiRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  context: RouteContext,
): Promise<boolean> => {
  if (!pathname.startsWith("/api/")) {
    return false;
  }

  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "Accept-CH": ACCEPT_CH_VALUE,
    "Critical-CH": ACCEPT_CH_VALUE,
  };
  applyCorsHeaders(request, headers, context);

  if (request.method === "OPTIONS") {
    send(response, 204, "", headers);
    return true;
  }

  if (pathname === "/api/echo-request") {
    send(
      response,
      200,
      JSON.stringify(buildEchoPayload(request, context.currentOrigin), null, 2),
      headers,
    );
    return true;
  }

  if (pathname === "/api/echo-request.html") {
    const htmlHeaders = {
      ...headers,
      "content-type": "text/html; charset=utf-8",
    };
    const body = escapeHtml(
      JSON.stringify(buildEchoPayload(request, context.currentOrigin), null, 2),
    );
    send(
      response,
      200,
      `<!doctype html><html><body><pre id="request-echo">${body}</pre></body></html>`,
      htmlHeaders,
    );
    return true;
  }

  if (pathname === "/api/set-cookie") {
    const requestUrl = new URL(request.url ?? "/", context.currentOrigin);
    const bodyPayload =
      request.method === "POST"
        ? ((await readRequestPayload(request)) as Record<string, unknown> | null)
        : null;
    const payload = {
      name: requestUrl.searchParams.get("name") ?? bodyPayload?.name,
      value: requestUrl.searchParams.get("value") ?? bodyPayload?.value,
      path: requestUrl.searchParams.get("path") ?? bodyPayload?.path,
      sameSite: requestUrl.searchParams.get("sameSite") ?? bodyPayload?.sameSite,
      secure:
        requestUrl.searchParams.get("secure") === "1" || bodyPayload?.secure === true,
      httpOnly:
        requestUrl.searchParams.get("httpOnly") === "1" ||
        bodyPayload?.httpOnly === true,
      maxAge:
        requestUrl.searchParams.get("maxAge") !== null
          ? Number(requestUrl.searchParams.get("maxAge"))
          : bodyPayload?.maxAge,
      domain: requestUrl.searchParams.get("domain") ?? bodyPayload?.domain,
      expires: requestUrl.searchParams.get("expires") ?? bodyPayload?.expires,
    };

    headers["Set-Cookie"] = buildCookieHeader(requestUrl, payload);
    send(
      response,
      200,
      JSON.stringify({ ok: true, cookie: headers["Set-Cookie"] }, null, 2),
      headers,
    );
    return true;
  }

  if (pathname === "/api/clear-cookie") {
    const requestUrl = new URL(request.url ?? "/", context.currentOrigin);
    const name = requestUrl.searchParams.get("name") ?? TEST_COOKIE_NAME;
    headers["Set-Cookie"] =
      `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    send(
      response,
      200,
      JSON.stringify({ ok: true, cookie: headers["Set-Cookie"] }, null, 2),
      headers,
    );
    return true;
  }

  return false;
};

const handleFaviconRequest = (response: ServerResponse, pathname: string): boolean => {
  if (pathname !== "/favicon.ico") {
    return false;
  }

  send(response, 204, "", {
    "Cache-Control": "no-store",
  });
  return true;
};

const handleRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  context: RouteContext,
): Promise<void> => {
  const requestUrl = new URL(request.url ?? "/", context.currentOrigin);
  const { pathname } = requestUrl;

  if (await handleApiRequest(request, response, pathname, context)) {
    return;
  }

  if (handleFaviconRequest(response, pathname)) {
    return;
  }

  if (pathname === "/pending-frame") {
    // Keep the navigation before response commit so E2E can inspect the
    // iframe's synchronous initial about:blank realm without wall-clock waits.
    request.once("close", () => response.destroy());
    return;
  }

  if (pathname === "/page.js") {
    send(
      response,
      200,
      `globalThis.__TEST_SERVER_EPOCH_MS__ = ${Date.now()};\n${CHROMIUM_PAGE_SCRIPT}`,
      {
        "content-type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store",
      },
    );
    return;
  }

  if (pathname === "/worker-probe.js") {
    send(response, 200, readTextFile(WORKER_PROBE_PATH), {
      "content-type": "application/javascript; charset=utf-8",
    });
    return;
  }

  if (pathname === "/shared-worker-probe.js") {
    send(response, 200, readTextFile(SHARED_WORKER_PROBE_PATH), {
      "content-type": "application/javascript; charset=utf-8",
    });
    return;
  }

  if (pathname === "/service-worker-probe.js") {
    send(response, 200, readTextFile(SERVICE_WORKER_PATH), {
      "content-type": "application/javascript; charset=utf-8",
    });
    return;
  }

  if (
    pathname === "/inline-first" ||
    pathname === "/inline-battery" ||
    pathname === "/inline-frame" ||
    pathname === "/inline-geo"
  ) {
    send(
      response,
      200,
      pathname === "/inline-geo"
        ? readTextFile(INLINE_GEO_PAGE_PATH)
        : pathname === "/inline-battery"
          ? readTextFile(INLINE_BATTERY_PAGE_PATH)
          : pathname === "/inline-first"
            ? readTextFile(INLINE_FIRST_PAGE_PATH)
            : readTextFile(INLINE_FRAME_PAGE_PATH),
      {
        "content-type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    );
    return;
  }

  if (pathname === "/echo-accept-language") {
    send(response, 200, request.headers["accept-language"] ?? "", {
      "content-type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    });
    return;
  }

  if (pathname === "/frame") {
    send(response, 200, readTextFile(CHROMIUM_FRAME_PAGE_PATH), {
      "content-type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    return;
  }

  if (
    pathname === "/" ||
    pathname === "/__test/host" ||
    pathname === "/__test/host/" ||
    pathname === "/csp"
  ) {
    const headers: Record<string, string> = {
      "content-type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    };

    if (pathname === "/csp") {
      headers["Content-Security-Policy"] =
        "worker-src 'self'; script-src 'self' 'unsafe-inline'";
    }

    send(response, 200, readTextFile(CHROMIUM_HOST_PAGE_PATH), headers);
    return;
  }

  send(response, 404, "Not found", {
    "content-type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
};

const listenOnPort = async (
  server: Server,
  host: string,
  port: number,
): Promise<number> =>
  new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error(`Probe server failed to bind ${host}:${port}.`));
        return;
      }

      resolve(address.port);
    });
  });

export const startProbeServers = async (
  options: ProbeServerOptions = {},
): Promise<StartedProbeServers> => {
  const origins = {
    primaryUrl: "",
    secondaryUrl: "",
  };
  const primaryServer = createServer(
    (request, response) =>
      void handleRequest(request, response, {
        currentOrigin: origins.primaryUrl,
        otherOrigin: origins.secondaryUrl,
      }),
  );
  const secondaryServer = createServer(
    (request, response) =>
      void handleRequest(request, response, {
        currentOrigin: origins.secondaryUrl,
        otherOrigin: origins.primaryUrl,
      }),
  );

  const primaryPort = await listenOnPort(
    primaryServer,
    PRIMARY_HOST,
    options.primaryPort ?? PRIMARY_PORT,
  );
  const secondaryPort = await listenOnPort(
    secondaryServer,
    SECONDARY_BIND_HOST,
    options.secondaryPort ?? SECONDARY_PORT,
  );

  origins.primaryUrl = `http://${PRIMARY_HOST}:${primaryPort}`;
  origins.secondaryUrl = `http://${options.secondaryPublicHost ?? SECONDARY_PUBLIC_HOST}:${secondaryPort}`;

  return {
    primaryUrl: origins.primaryUrl,
    secondaryUrl: origins.secondaryUrl,
    close: async () => {
      await Promise.all([closeServer(primaryServer), closeServer(secondaryServer)]);
    },
  };
};
