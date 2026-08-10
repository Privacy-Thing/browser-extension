type PageBufferKind = "bootstrap-log" | "bootstrap-heartbeat";

const getQueueAttr = (kind: PageBufferKind): string =>
  `data-${__PT_FIREFOX_STATE_PORT_ID__}-${kind}`;

const getReadyAttr = (kind: PageBufferKind): string =>
  `data-${__PT_FIREFOX_STATE_PORT_ID__}-${kind}-ready`;

const getQueueHost = (): ParentNode | null =>
  document.head ?? document.documentElement ?? document.body ?? null;

export const isPageBufferReady = (kind: PageBufferKind): boolean =>
  document.documentElement?.hasAttribute(getReadyAttr(kind)) === true;

export const markPageBufferReady = (kind: PageBufferKind): void => {
  document.documentElement?.setAttribute(getReadyAttr(kind), "");
};

export const queuePagePayload = (
  kind: PageBufferKind,
  payload: Record<string, unknown>,
): boolean => {
  const host = getQueueHost();
  if (!host) {
    return false;
  }

  const script = document.createElement("script");
  script.type = "application/json";
  script.setAttribute(getQueueAttr(kind), "");
  script.textContent = JSON.stringify(payload);
  host.appendChild(script);
  return true;
};

export const drainPagePayloads = (
  kind: PageBufferKind,
): Array<Record<string, unknown>> => {
  const nodes = [
    ...document.querySelectorAll(
      `script[type="application/json"][${getQueueAttr(kind)}]`,
    ),
  ];
  const payloads: Array<Record<string, unknown>> = [];

  for (const node of nodes) {
    try {
      const text = node.textContent;
      if (!text) {
        continue;
      }

      const payload = JSON.parse(text) as Record<string, unknown>;
      payloads.push(payload);
    } catch {
      // Ignore malformed queued payloads.
    } finally {
      node.remove();
    }
  }

  return payloads;
};
