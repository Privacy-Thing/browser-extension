import type { CleanupPlan } from "@/shared/types";

export const buildPopupCleanupPlan = ({
  browserTarget,
  cookieStoreId,
  hasOpenPage,
}: {
  browserTarget: "chromium" | "firefox";
  cookieStoreId: string | undefined;
  hasOpenPage: boolean;
}): CleanupPlan => {
  const firefoxContainer = browserTarget === "firefox" && Boolean(cookieStoreId);
  const browserWorkerCleanup = browserTarget === "chromium" || !firefoxContainer;
  const workerCleanupAvailable = browserWorkerCleanup || hasOpenPage;
  let target: CleanupPlan["target"] = "firefox-default";
  if (browserTarget === "chromium") {
    target = "chromium";
  } else if (firefoxContainer) {
    target = "firefox-container";
  }
  const surfaces: CleanupPlan["surfaces"] = [
    { key: "cookies", available: true },
    { key: "local-storage", available: true },
    { key: "indexed-db", available: true },
    {
      key: "cache-storage",
      available: browserTarget === "chromium" || hasOpenPage,
      ...(!(browserTarget === "chromium" || hasOpenPage)
        ? { reasonKey: "open-page-required" as const }
        : {}),
    },
    {
      key: "service-workers",
      available: workerCleanupAvailable,
      ...(!workerCleanupAvailable ? { reasonKey: "open-page-required" as const } : {}),
    },
    {
      key: "page-storage",
      available: hasOpenPage,
      ...(!hasOpenPage ? { reasonKey: "open-page-required" as const } : {}),
    },
  ];

  return {
    target,
    expectedOutcome: surfaces.every((surface) => surface.available)
      ? "complete"
      : "partial",
    surfaces,
  };
};
