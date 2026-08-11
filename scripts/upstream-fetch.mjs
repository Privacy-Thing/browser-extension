import { URL } from "node:url";
import { TextDecoder } from "node:util";

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;

const assertAllowedUrl = (url, allowedOrigins) => {
  if (url.protocol !== "https:" || !allowedOrigins.has(url.origin)) {
    throw new Error(`Upstream URL is not allowlisted: ${url.href}`);
  }
};

const readLimitedUtf8 = async (response, maxBytes) => {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
      throw new Error(`Upstream Content-Length is invalid: ${declaredLength}`);
    }
    if (parsedLength > maxBytes) {
      throw new Error(`Upstream response exceeds ${maxBytes} bytes`);
    }
  }

  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new Error(`Upstream response exceeds ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("Upstream response is not valid UTF-8");
  }
};

export const fetchTrustedText = async ({
  url,
  allowedOrigins,
  acceptedContentTypes,
  accept,
  maxBytes = DEFAULT_MAX_BYTES,
  maxRedirects = DEFAULT_MAX_REDIRECTS,
  fetchImpl = globalThis.fetch,
}) => {
  const allowedOriginSet = new Set(allowedOrigins);
  const acceptedTypeSet = new Set(
    acceptedContentTypes.map((value) => value.toLowerCase()),
  );
  let currentUrl = new URL(url);

  for (let redirectCount = 0; ; redirectCount += 1) {
    assertAllowedUrl(currentUrl, allowedOriginSet);
    const response = await fetchImpl(currentUrl, {
      headers: { Accept: accept },
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      if (redirectCount >= maxRedirects) {
        throw new Error(`Upstream exceeded ${maxRedirects} redirects`);
      }
      const location = response.headers.get("location");
      if (!location) throw new Error("Upstream redirect is missing Location");
      currentUrl = new URL(location, currentUrl);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Upstream request failed with status ${response.status}`);
    }

    const contentTypeHeader = response.headers.get("content-type");
    const [mediaType, ...contentTypeParameters] = contentTypeHeader?.split(";") ?? [];
    const contentType = mediaType?.trim().toLowerCase();
    if (!contentType || !acceptedTypeSet.has(contentType)) {
      throw new Error(
        `Upstream Content-Type is not accepted: ${contentType ?? "missing"}`,
      );
    }
    for (const parameter of contentTypeParameters) {
      const separatorIndex = parameter.indexOf("=");
      if (separatorIndex === -1) continue;
      const name = parameter.slice(0, separatorIndex).trim().toLowerCase();
      if (name !== "charset") continue;
      let charset = parameter.slice(separatorIndex + 1).trim();
      if (charset.startsWith('"') && charset.endsWith('"')) {
        charset = charset.slice(1, -1);
      }
      charset = charset.toLowerCase();
      if (charset !== "utf-8" && charset !== "utf8") {
        throw new Error(`Upstream charset is not accepted: ${charset || "missing"}`);
      }
    }

    return readLimitedUtf8(response, maxBytes);
  }
};
