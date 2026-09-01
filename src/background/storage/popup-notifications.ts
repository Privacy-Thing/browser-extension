import type { BuildChannel } from "@/shared/build-flags";
import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";
import { compareNoticeVersions } from "@/shared/notification-version";
import {
  isPopupPolicyNoticeKind,
  isSuggestionNotice,
  POLICY_NOTICE_KINDS,
} from "@/shared/popup-notification-kinds";
import type { ReleaseNotice } from "@/shared/release-notification";
import type {
  PopupNotification,
  PopupNotificationKind,
  PopupPolicyNoticeKind,
  SiteSuggestionKind,
} from "@/shared/types";

export const NOTICES_STORAGE_KEY = EXTENSION_STORAGE_KEYS.popupNotifications;
const MAX_SITE_NOTIFICATIONS = 50;
const MAX_NOTICES = 20;
const RESOLVED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

let mutationQueue: Promise<unknown> = Promise.resolve();

export type NotificationSyncContext = "install" | "update" | "startup";

type StoredNotificationInput = Partial<PopupNotification> & { version?: unknown };

const resolveNotificationKind = (
  kind: StoredNotificationInput["kind"],
): PopupNotificationKind | null =>
  kind === "significant-update" ||
  isSuggestionNotice(kind) ||
  isPopupPolicyNoticeKind(kind)
    ? kind
    : null;

const getReleaseFields = (
  item: StoredNotificationInput,
  kind: PopupNotificationKind,
):
  | Pick<PopupNotification, "channel" | "introducedInVersion">
  | Record<string, never> => {
  if (kind !== "significant-update") return {};
  let introducedInVersion = "";
  if (typeof item.introducedInVersion === "string") {
    introducedInVersion = item.introducedInVersion;
  } else if (typeof item.version === "string") {
    introducedInVersion = item.version;
  }
  return {
    channel:
      item.channel === "beta" || item.channel === "release" ? item.channel : "release",
    introducedInVersion,
  };
};

const normalizeNotification = (value: unknown): PopupNotification | null => {
  if (!value || typeof value !== "object") return null;
  const item = value as StoredNotificationInput;
  const kind = resolveNotificationKind(item.kind);
  if (
    !kind ||
    typeof item.id !== "string" ||
    typeof item.dedupeKey !== "string" ||
    (item.scope !== "site" && item.scope !== "extension") ||
    (item.severity !== "info" && item.severity !== "needs-action") ||
    typeof item.createdAt !== "string" ||
    typeof item.lastDetectedAt !== "string" ||
    typeof item.generation !== "number" ||
    (item.actionTarget !== undefined && typeof item.actionTarget !== "string") ||
    (kind !== "significant-update" && typeof item.actionTarget !== "string")
  ) {
    return null;
  }

  return {
    id: item.id,
    kind,
    scope: item.scope,
    dedupeKey: item.dedupeKey,
    severity: item.severity,
    ...(typeof item.hostname === "string" ? { hostname: item.hostname } : {}),
    ...(typeof item.cookieStoreId === "string"
      ? { cookieStoreId: item.cookieStoreId }
      : {}),
    ...getReleaseFields(item, kind),
    createdAt: item.createdAt,
    lastDetectedAt: item.lastDetectedAt,
    generation: item.generation,
    readAt: typeof item.readAt === "string" ? item.readAt : null,
    resolvedAt: typeof item.resolvedAt === "string" ? item.resolvedAt : null,
    autoPresentedAt:
      typeof item.autoPresentedAt === "string" ? item.autoPresentedAt : null,
    pulseShownAt: typeof item.pulseShownAt === "string" ? item.pulseShownAt : null,
    ...(typeof item.actionTarget === "string"
      ? { actionTarget: item.actionTarget }
      : {}),
  };
};

const loadRaw = async (): Promise<PopupNotification[]> => {
  const stored = await chrome.storage.local.get(NOTICES_STORAGE_KEY);
  const raw = stored[NOTICES_STORAGE_KEY];
  return Array.isArray(raw)
    ? raw
        .map(normalizeNotification)
        .filter((item): item is PopupNotification => item !== null)
    : [];
};

const prune = (
  items: readonly PopupNotification[],
  now: string,
): PopupNotification[] => {
  const cutoff = new Date(now).getTime() - RESOLVED_RETENTION_MS;
  // Read site warnings and catalog notifications double as durable suppression records.
  const retained = items.filter(
    (item) =>
      item.kind === "significant-update" ||
      (item.scope === "site" &&
        item.severity === "needs-action" &&
        item.readAt !== null) ||
      item.resolvedAt === null ||
      new Date(item.resolvedAt).getTime() >= cutoff,
  );
  const trimScope = (scope: PopupNotification["scope"], limit: number) => {
    const scoped = retained
      .filter((item) => item.scope === scope)
      .sort((left, right) => right.lastDetectedAt.localeCompare(left.lastDetectedAt));
    const durableEntries = scoped.filter(
      (item) =>
        item.kind === "significant-update" ||
        (item.scope === "site" &&
          item.severity === "needs-action" &&
          item.readAt !== null),
    );
    const transient = scoped.filter((item) => !durableEntries.includes(item));
    const unresolved = transient.filter((item) => item.resolvedAt === null);
    const resolved = transient.filter((item) => item.resolvedAt !== null);
    return [
      ...durableEntries,
      ...unresolved,
      ...resolved.slice(0, Math.max(0, limit - unresolved.length)),
    ];
  };
  return [
    ...trimScope("site", MAX_SITE_NOTIFICATIONS),
    ...trimScope("extension", MAX_NOTICES),
  ];
};

const saveRaw = async (
  items: readonly PopupNotification[],
  now: string,
): Promise<void> => {
  await chrome.storage.local.set({
    [NOTICES_STORAGE_KEY]: prune(items, now),
  });
};

const mutate = <T>(operation: () => Promise<T>): Promise<T> => {
  const next = mutationQueue.then(operation, operation);
  mutationQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
};

export const loadPopupNotifications = async (): Promise<PopupNotification[]> =>
  prune(await loadRaw(), new Date().toISOString());

export const selectPopupNotifications = (
  notifications: readonly PopupNotification[],
  hostname: string | null,
  cookieStoreId?: string,
): PopupNotification[] =>
  notifications
    .filter(
      (item) =>
        item.scope === "extension" ||
        (item.hostname === hostname && item.cookieStoreId === cookieStoreId),
    )
    .sort((left, right) => right.lastDetectedAt.localeCompare(left.lastDetectedAt));

export const recordSiteNotice = async ({
  hostname,
  cookieStoreId,
  kind,
  generation,
  detectedAt,
}: {
  hostname: string;
  cookieStoreId?: string;
  kind: SiteSuggestionKind;
  generation: number;
  detectedAt: string;
}): Promise<PopupNotification> =>
  mutate(async () => {
    const items = await loadRaw();
    const dedupeKey = `site:${cookieStoreId ?? "default"}:${hostname}:${kind}`;
    const current = items.find((item) => item.dedupeKey === dedupeKey);
    const next: PopupNotification = {
      id: current?.id ?? dedupeKey,
      kind,
      scope: "site",
      dedupeKey,
      severity: "needs-action",
      hostname,
      ...(cookieStoreId ? { cookieStoreId } : {}),
      createdAt: current?.createdAt ?? detectedAt,
      lastDetectedAt: detectedAt,
      generation: Math.max(generation, current?.generation ?? generation),
      readAt: current?.readAt ?? null,
      resolvedAt: current?.resolvedAt ?? null,
      autoPresentedAt: current?.autoPresentedAt ?? null,
      pulseShownAt: current?.pulseShownAt ?? null,
      actionTarget: `suggestion:${kind}`,
    };
    await saveRaw(
      [...items.filter((item) => item.dedupeKey !== dedupeKey), next],
      detectedAt,
    );
    return next;
  });

export const syncSiteNotices = async ({
  hostname,
  cookieStoreId,
  applicableKinds,
  activeKinds,
  detectedAt = new Date().toISOString(),
}: {
  hostname: string;
  cookieStoreId?: string;
  applicableKinds: readonly PopupPolicyNoticeKind[];
  activeKinds: readonly PopupPolicyNoticeKind[];
  detectedAt?: string;
}): Promise<PopupNotification[]> =>
  mutate(async () => {
    const items = await loadRaw();
    const scopePrefix = `site:${cookieStoreId ?? "default"}:${hostname}:`;
    const applicableKindSet = new Set(applicableKinds);
    const activeKindSet = new Set(
      activeKinds.filter((kind) => applicableKindSet.has(kind)),
    );
    let changed = false;
    const nextItems = items.flatMap((item) => {
      if (
        !isPopupPolicyNoticeKind(item.kind) ||
        !item.dedupeKey.startsWith(scopePrefix)
      ) {
        return [item];
      }

      if (!applicableKindSet.has(item.kind)) {
        changed = true;
        return [];
      }

      if (
        activeKindSet.has(item.kind) ||
        item.resolvedAt !== null ||
        item.readAt !== null
      ) {
        return [item];
      }

      changed = true;
      // An unseen condition may alert again after the surface is genuinely used.
      return [];
    });

    for (const kind of POLICY_NOTICE_KINDS) {
      if (!activeKindSet.has(kind)) continue;
      const dedupeKey = `${scopePrefix}${kind}`;
      const currentIndex = nextItems.findIndex((item) => item.dedupeKey === dedupeKey);
      const current = currentIndex >= 0 ? nextItems[currentIndex] : undefined;
      if (current) continue;

      const next: PopupNotification = {
        id: dedupeKey,
        kind,
        scope: "site",
        dedupeKey,
        severity: "needs-action",
        hostname,
        ...(cookieStoreId ? { cookieStoreId } : {}),
        createdAt: detectedAt,
        lastDetectedAt: detectedAt,
        generation: 1,
        readAt: null,
        resolvedAt: null,
        autoPresentedAt: null,
        pulseShownAt: null,
        actionTarget: `policy:${kind}`,
      };
      nextItems.push(next);
      changed = true;
    }

    if (changed) await saveRaw(nextItems, detectedAt);
    return prune(nextItems, detectedAt);
  });

const selectStoredChannelItems = ({
  items,
  buildChannel,
  currentVersion,
}: {
  items: readonly PopupNotification[];
  buildChannel: BuildChannel;
  currentVersion?: string;
}): PopupNotification[] => {
  if (buildChannel === "local" || !currentVersion) return [...items];
  return items.filter((item) => {
    if (item.kind !== "significant-update") return true;
    if (item.channel !== buildChannel) return false;
    if (typeof item.introducedInVersion !== "string") return false;
    return (
      compareNoticeVersions(buildChannel, item.introducedInVersion, currentVersion) !==
      1
    );
  });
};

const agePreviousNotices = ({
  items,
  buildChannel,
  currentVersion,
  detectedAt,
}: {
  items: readonly PopupNotification[];
  buildChannel: BuildChannel;
  currentVersion?: string;
  detectedAt: string;
}): PopupNotification[] => {
  if (buildChannel === "local" || !currentVersion) return [...items];
  return items.map((item) => {
    if (
      item.kind !== "significant-update" ||
      item.channel !== buildChannel ||
      item.readAt !== null ||
      item.resolvedAt !== null ||
      !item.introducedInVersion
    ) {
      return item;
    }
    return compareNoticeVersions(
      buildChannel,
      item.introducedInVersion,
      currentVersion,
    ) === -1
      ? { ...item, readAt: detectedAt }
      : item;
  });
};

const selectCatalogNotices = ({
  notifications,
  buildChannel,
  currentVersion,
}: {
  notifications: readonly ReleaseNotice[];
  buildChannel: BuildChannel;
  currentVersion?: string;
}): readonly ReleaseNotice[] => {
  if (buildChannel === "local") return notifications;
  if (!currentVersion) return [];
  return notifications.filter(
    (item) =>
      item.channel === buildChannel &&
      compareNoticeVersions(buildChannel, item.introducedInVersion, currentVersion) !==
        1,
  );
};

const shouldAutoPresentNotice = ({
  notification,
  buildChannel,
  currentVersion,
  context,
}: {
  notification: ReleaseNotice;
  buildChannel: BuildChannel;
  currentVersion?: string;
  context: NotificationSyncContext;
}): boolean => {
  if (buildChannel === "local") return true;
  if (!currentVersion) return false;
  return (
    compareNoticeVersions(
      buildChannel,
      notification.introducedInVersion,
      currentVersion,
    ) === 0 &&
    (context === "update" || notification.delivery === "all-current-users")
  );
};

const upsertCatalogNotice = ({
  items,
  notification,
  shouldAutoPresent,
  detectedAt,
}: {
  items: PopupNotification[];
  notification: ReleaseNotice;
  shouldAutoPresent: boolean;
  detectedAt: string;
}): void => {
  const dedupeKey = `extension:update:${notification.id}`;
  const legacyDedupeKey = `extension:update:${notification.introducedInVersion}`;
  const currentIndex = items.findIndex(
    (item) =>
      item.kind === "significant-update" &&
      (item.id === notification.id ||
        item.dedupeKey === dedupeKey ||
        (item.id === legacyDedupeKey && item.dedupeKey === legacyDedupeKey)),
  );
  const current = currentIndex >= 0 ? items[currentIndex] : undefined;
  if (current) {
    const currentWithoutTarget = { ...current };
    delete currentWithoutTarget.actionTarget;
    items[currentIndex] = {
      ...currentWithoutTarget,
      id: notification.id,
      dedupeKey,
      channel: notification.channel,
      introducedInVersion: notification.introducedInVersion,
      ...(notification.actionUrl ? { actionTarget: notification.actionUrl } : {}),
    };
    return;
  }

  items.push({
    id: notification.id,
    kind: "significant-update",
    scope: "extension",
    dedupeKey,
    severity: "info",
    channel: notification.channel,
    introducedInVersion: notification.introducedInVersion,
    createdAt: detectedAt,
    lastDetectedAt: detectedAt,
    generation: 1,
    readAt: shouldAutoPresent ? null : detectedAt,
    resolvedAt: null,
    autoPresentedAt: shouldAutoPresent ? null : detectedAt,
    pulseShownAt: null,
    ...(notification.actionUrl ? { actionTarget: notification.actionUrl } : {}),
  });
};

export const syncUpdateNotices = async ({
  notifications,
  buildChannel,
  currentVersion,
  context,
  detectedAt = new Date().toISOString(),
}: {
  notifications: readonly ReleaseNotice[];
  buildChannel: BuildChannel;
  currentVersion?: string;
  context: NotificationSyncContext;
  detectedAt?: string;
}): Promise<PopupNotification[]> =>
  mutate(async () => {
    const items = await loadRaw();
    const channelItems = selectStoredChannelItems({
      items,
      buildChannel,
      ...(currentVersion ? { currentVersion } : {}),
    });
    const agedItems = agePreviousNotices({
      items: channelItems,
      buildChannel,
      ...(currentVersion ? { currentVersion } : {}),
      detectedAt,
    });
    const catalogNotifications = selectCatalogNotices({
      notifications,
      buildChannel,
      ...(currentVersion ? { currentVersion } : {}),
    });
    const nextItems = [...agedItems];

    for (const notification of catalogNotifications) {
      const shouldAutoPresent = shouldAutoPresentNotice({
        notification,
        buildChannel,
        ...(currentVersion ? { currentVersion } : {}),
        context,
      });
      upsertCatalogNotice({
        items: nextItems,
        notification,
        shouldAutoPresent,
        detectedAt,
      });
    }

    await saveRaw(nextItems, detectedAt);
    return prune(nextItems, detectedAt);
  });

const updateNotification = async (
  id: string,
  patch: (item: PopupNotification, now: string) => PopupNotification,
): Promise<PopupNotification | null> =>
  mutate(async () => {
    const items = await loadRaw();
    const now = new Date().toISOString();
    const current = items.find((item) => item.id === id);
    if (!current) return null;
    const next = patch(current, now);
    await saveRaw([...items.filter((item) => item.id !== id), next], now);
    return next;
  });

export const markNoticeRead = (id: string): Promise<PopupNotification | null> =>
  updateNotification(id, (item, now) => ({ ...item, readAt: item.readAt ?? now }));

export const markNoticesAutoPresented = (
  ids: readonly string[],
): Promise<PopupNotification[]> =>
  mutate(async () => {
    const idSet = new Set(ids);
    if (idSet.size === 0) return [];

    const items = await loadRaw();
    const now = new Date().toISOString();
    const updated = items.map((item) =>
      idSet.has(item.id)
        ? { ...item, autoPresentedAt: item.autoPresentedAt ?? now }
        : item,
    );
    await saveRaw(updated, now);
    return updated.filter((item) => idSet.has(item.id));
  });

export const resolvePopupNotification = (
  id: string,
): Promise<PopupNotification | null> =>
  updateNotification(id, (item, now) => ({
    ...item,
    readAt: item.readAt ?? now,
    resolvedAt: now,
  }));

export const markNoticePulseShown = (id: string): Promise<PopupNotification | null> =>
  updateNotification(id, (item, now) => ({
    ...item,
    pulseShownAt: item.pulseShownAt ?? now,
  }));
