// @vitest-environment jsdom

import {
  publishFxMainHandoff,
  takeFxMainHandoff,
  type FirefoxShimState,
} from "@privacy-brand/refract-browser/common/firefox-shim-state";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FX_HANDOFF_READY_EVENT } from "@/shared/build-id-test-values";
const createState = (revision: number): FirefoxShimState => ({
  bootstrap: { revision },
  geoStatus: "absent",
  geo: null,
  timeLocaleStatus: "absent",
  timeLocale: null,
  fingerprintStatus: "absent",
  fingerprint: null,
  debug: null,
  blockServiceWorkerRegistration: false,
});

describe("Firefox early-to-main handoff", () => {
  afterEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("notifies main and removes the replay mailbox after one read", () => {
    const notified = vi.fn();
    document.addEventListener(FX_HANDOFF_READY_EVENT, notified, {
      once: true,
    });
    const state = createState(1);

    publishFxMainHandoff(document, state);

    expect(notified).toHaveBeenCalledOnce();
    const handoff = takeFxMainHandoff(document);
    expect(handoff).toEqual({ protocol: 1, revision: 1, state });
    expect(takeFxMainHandoff(document)).toBeNull();
    expect(document.querySelectorAll('script[type="application/json"]')).toHaveLength(
      0,
    );
  });

  it("keeps only the newest replay mailbox", () => {
    publishFxMainHandoff(document, createState(1));
    publishFxMainHandoff(document, createState(2));

    expect(document.querySelectorAll('script[type="application/json"]')).toHaveLength(
      1,
    );
    expect(takeFxMainHandoff(document)?.revision).toBe(2);
  });

  it("removes a malformed mailbox", () => {
    publishFxMainHandoff(document, createState(1));
    const mailbox = document.querySelector<HTMLScriptElement>(
      'script[type="application/json"]',
    );
    expect(mailbox).not.toBeNull();
    mailbox!.textContent = JSON.stringify({
      protocol: 1,
      revision: 2,
      state: createState(1),
    });

    expect(takeFxMainHandoff(document)).toBeNull();
    expect(mailbox!.isConnected).toBe(false);
  });
});
