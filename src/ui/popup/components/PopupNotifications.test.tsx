import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PopupNotification } from "@/shared/types";
import {
  getNotificationState,
  PopupNotificationDetail,
  PopupNotificationList,
} from "@/ui/popup/components/PopupNotifications";

const createNotification = (
  id: string,
  readAt: string | null,
  resolvedAt: string | null,
  kind: PopupNotification["kind"] = "service-worker-block",
): PopupNotification => ({
  id,
  kind,
  scope: "site",
  dedupeKey: id,
  severity: "needs-action",
  hostname: "example.com",
  createdAt: "2026-07-13T12:00:00.000Z",
  lastDetectedAt: "2026-07-13T12:00:00.000Z",
  generation: 1,
  readAt,
  resolvedAt,
  autoPresentedAt: null,
  pulseShownAt: null,
  ...(kind === "significant-update" ? {} : { actionTarget: `policy:${kind}` }),
});

describe("PopupNotifications", () => {
  it("derives unread, acknowledged, and resolved states from persisted timestamps", () => {
    expect(getNotificationState(createNotification("unread", null, null))).toBe(
      "unread",
    );
    expect(
      getNotificationState(createNotification("ack", "2026-07-13T12:01:00.000Z", null)),
    ).toBe("acknowledged");
    expect(
      getNotificationState(
        createNotification(
          "resolved",
          "2026-07-13T12:01:00.000Z",
          "2026-07-13T12:02:00.000Z",
        ),
      ),
    ).toBe("resolved");
  });

  it("renders acknowledged active warnings differently and counts only unread items", () => {
    const markup = renderToStaticMarkup(
      <PopupNotificationList
        notifications={[
          createNotification("ack", "2026-07-13T12:01:00.000Z", null),
          createNotification("unread", null, null, "shared-worker-strict"),
        ]}
        onOpen={vi.fn()}
      />,
    );

    expect(markup).toContain('data-notification-state="acknowledged"');
    expect(markup).toContain('data-needs-attention="true"');
    expect(markup).toContain('data-notification-state="unread"');
    expect(markup).toContain(">Read<");
    expect(markup).toContain(">New<");
    expect(markup).toContain(">Needs attention<");
    expect(markup).not.toContain(">Review<");
    expect(markup).toContain(">1</span>");
  });

  it("opens on the extension scope when there are no active site notifications", () => {
    const extensionNotification: PopupNotification = {
      ...createNotification("extension", null, null, "significant-update"),
      scope: "extension",
      severity: "info",
    };

    const markup = renderToStaticMarkup(
      <PopupNotificationList
        notifications={[extensionNotification]}
        onOpen={vi.fn()}
      />,
    );

    expect(markup).toContain('data-notification-state="unread"');
    expect(markup).toContain("Privacy Thing was updated");
    expect(markup).not.toContain(">Review<");
  });

  it("keeps only meaningful notification-list actions", () => {
    const releaseWithLink: PopupNotification = {
      ...createNotification("release-link", null, null, "significant-update"),
      scope: "extension",
      severity: "info",
      actionTarget: "https://example.com/release",
    };
    const resolved: PopupNotification = {
      ...createNotification(
        "resolved",
        "2026-07-13T12:01:00.000Z",
        "2026-07-13T12:02:00.000Z",
      ),
      scope: "extension",
    };

    const releaseMarkup = renderToStaticMarkup(
      <PopupNotificationList notifications={[releaseWithLink]} onOpen={vi.fn()} />,
    );
    const resolvedMarkup = renderToStaticMarkup(
      <PopupNotificationList notifications={[resolved]} onOpen={vi.fn()} />,
    );

    expect(releaseMarkup).toContain(">Open link<");
    expect(releaseMarkup).not.toContain(">Review<");
    expect(resolvedMarkup).toContain(">Resolved<");
    expect(resolvedMarkup).not.toContain("gw-popup-notification-action-label");
  });

  it("offers site-scoped compatibility actions for policy notifications", () => {
    const commonProps = {
      onApplySuggestion: vi.fn(async () => undefined),
      onDismiss: vi.fn(async () => undefined),
      onDismissSuggestion: vi.fn(async () => undefined),
      onNotificationAction: vi.fn(async () => undefined),
    };
    const serviceWorkerMarkup = renderToStaticMarkup(
      <PopupNotificationDetail
        notification={createNotification("service", null, null)}
        {...commonProps}
      />,
    );
    const sharedWorkerMarkup = renderToStaticMarkup(
      <PopupNotificationDetail
        notification={createNotification("shared", null, null, "shared-worker-strict")}
        {...commonProps}
      />,
    );

    expect(serviceWorkerMarkup).toContain(
      "Privacy Thing is blocking Service Worker registration on this site.",
    );
    expect(serviceWorkerMarkup).toContain("What this affects");
    expect(serviceWorkerMarkup).toContain("may not work while blocking is on");
    expect(serviceWorkerMarkup).not.toContain("may stop working");
    expect(serviceWorkerMarkup).toContain(">Dismiss</button>");
    expect(serviceWorkerMarkup).toContain(">Allow Service Workers</button>");
    expect(sharedWorkerMarkup).toContain(
      "Privacy Thing blocks any Shared Worker it cannot spoof before it starts.",
    );
    // Strict mode leads with a neutral "What this affects" section, then the
    // Native/Spoof change options; dismissing keeps the current protection.
    expect(sharedWorkerMarkup).toContain("What this affects");
    // "What this affects" names the page features at risk instead of
    // restating the summary above it.
    expect(sharedWorkerMarkup).toContain(
      "Cross-tab sync, shared connections, and live collaboration may not work",
    );
    expect(sharedWorkerMarkup).not.toContain(
      "from seeing native browser values, but features",
    );
    expect(sharedWorkerMarkup).toContain("Choose how Shared Workers run on this site");
    expect(sharedWorkerMarkup).toContain("<strong>Native</strong>");
    expect(sharedWorkerMarkup).toContain("<strong>Spoof</strong>");
    expect(sharedWorkerMarkup).toContain("best compatibility");
    expect(sharedWorkerMarkup).toContain(
      "Tries an alternate protection method for Shared Workers.",
    );
    expect(sharedWorkerMarkup).toContain(">Keep strict mode</button>");
    expect(sharedWorkerMarkup).not.toContain(">Dismiss</button>");
    expect(sharedWorkerMarkup).toContain(">Native</button>");
    expect(sharedWorkerMarkup).toContain(">Spoof</button>");
    expect(sharedWorkerMarkup).not.toContain("for this site</button>");
    expect(serviceWorkerMarkup).not.toContain("Review settings");
    // The two mode changes pair on one row, then keeping the current
    // protection spans a full-width row of its own.
    expect(sharedWorkerMarkup.indexOf(">Native</button>")).toBeLessThan(
      sharedWorkerMarkup.indexOf(">Spoof</button>"),
    );
    expect(sharedWorkerMarkup.indexOf(">Spoof</button>")).toBeLessThan(
      sharedWorkerMarkup.indexOf(">Keep strict mode</button>"),
    );
    expect(sharedWorkerMarkup).toMatch(
      /data-wide="true"[^>]*>Keep strict mode<\/button>/,
    );
    expect(sharedWorkerMarkup).not.toContain('data-column-count="3"');
    // Explanatory sections are unboxed prose; only the option list keeps panel
    // chrome, and no panel inside notification content is warning-toned.
    expect(serviceWorkerMarkup).not.toContain("gw-popup-panel");
    expect(sharedWorkerMarkup).toMatch(
      /<section class="gw-popup-notification-impact"><h4[^>]*>What this affects<\/h4>/,
    );
    expect(sharedWorkerMarkup.match(/gw-popup-panel/g)).toHaveLength(1);
    expect(sharedWorkerMarkup).not.toContain('data-tone="warning"');
    expect(serviceWorkerMarkup).not.toContain('data-tone="warning"');
  });

  it("uses specific copy and clear actions for runtime worker failures", () => {
    const commonProps = {
      onApplySuggestion: vi.fn(async () => undefined),
      onDismiss: vi.fn(async () => undefined),
      onDismissSuggestion: vi.fn(async () => undefined),
      onNotificationAction: vi.fn(async () => undefined),
    };
    const cspMarkup = renderToStaticMarkup(
      <PopupNotificationDetail
        notification={createNotification("csp", null, null, "worker-csp-relaxation")}
        {...commonProps}
      />,
    );
    const sharedWorkerMarkup = renderToStaticMarkup(
      <PopupNotificationDetail
        notification={createNotification(
          "shared-runtime",
          null,
          null,
          "shared-worker-injection-relaxation",
        )}
        {...commonProps}
      />,
    );

    expect(cspMarkup).toContain("Worker spoofing was blocked by this site");
    expect(cspMarkup).toContain("Content Security Policy (CSP)");
    expect(cspMarkup).toContain(">Allow worker spoofing</button>");
    expect(cspMarkup).not.toContain("Apply suggestion");
    expect(sharedWorkerMarkup).toContain("Shared Worker spoofing failed");
    expect(sharedWorkerMarkup).toContain("Choose how Shared Workers run on this site");
    expect(sharedWorkerMarkup).toContain("<strong>Native</strong>");
    expect(sharedWorkerMarkup).toContain("<strong>Spoof</strong>");
    expect(sharedWorkerMarkup).toContain(">Native</button>");
    expect(sharedWorkerMarkup).toContain(">Spoof</button>");
  });

  it("renders a localized extension notification as separate paragraphs with version metadata", () => {
    const notification: PopupNotification = {
      ...createNotification(
        "notification-center-intro",
        null,
        null,
        "significant-update",
      ),
      scope: "extension",
      severity: "info",
      channel: "release",
      introducedInVersion: "0.9.0",
    };
    const markup = renderToStaticMarkup(
      <PopupNotificationDetail
        notification={notification}
        onApplySuggestion={vi.fn(async () => undefined)}
        onDismiss={vi.fn(async () => undefined)}
        onDismissSuggestion={vi.fn(async () => undefined)}
        onNotificationAction={vi.fn(async () => undefined)}
      />,
    );

    expect(markup).toContain("Notifications are now in the popup");
    expect(markup).toContain("Version 0.9.0");
    expect(markup).not.toContain(">Open link</button>");
    expect(markup.match(/<button/g)).toHaveLength(1);
    expect(markup).toContain(">Dismiss</button>");
    expect(markup).toContain(
      "Privacy Thing now shows important updates and compatibility notices in the popup.",
    );
    expect(markup).toContain(
      "Opening a notification marks it as read. It remains available until you dismiss it.",
    );
    expect(markup.match(/<p/g)).toHaveLength(3);
  });
});
