import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fireAndForget } from "@/shared/async";
import {
  createContainer,
  hydrateAssignments,
  listContainers,
  removeContainer,
  updateContainer,
} from "@/shared/container-service";
import { reconcileContainerSeed } from "@/shared/rule-seed";
import type { ContainerAssignment, ContainerPresentation } from "@/shared/types";
import { notify } from "@/ui/components/ui/toast";
import { t } from "@/ui/i18n";
import type {
  ContainerEditorDraft,
  DefaultRulePreview,
} from "@/ui/options/components/modals/ContainerEditorModal";
import { setupAutoRefresh } from "@/ui/options/components/tabs/containers-auto-refresh";
import {
  compareContainerRows,
  type ContainerRow,
  createEditorDraft,
  getAssignmentLabel,
} from "@/ui/options/components/tabs/containers-table";
import type { ContainersViewProps } from "@/ui/options/components/tabs/containers-view";
import {
  isGlobalFallbackInactive,
  isFallbackIncomplete,
} from "@/ui/options/components/tabs/global-fallback-state";
import {
  getContainerAnchor,
  getContainerModalAnchor,
  isContainerAnchor,
} from "@/ui/options/navigation";
import { useSettings } from "@/ui/options/state/SettingsContext";

const containersT = t.firefoxContainers;
type Settings = ReturnType<typeof useSettings>;

const buildContainerRows = ({
  assignments,
  containers,
  fallback,
  profileLabels,
}: {
  assignments: ContainerAssignment[];
  containers: ContainerPresentation[] | null;
  fallback: Settings["globalFallbackRule"];
  profileLabels: ReadonlyMap<string, string>;
}): ContainerRow[] => {
  if (!containers) return [];
  const fallbackLabel = fallback?.locationId
    ? (profileLabels.get(fallback.locationId) ?? containersT.missingLocation)
    : t.rules.globalFallback.noPresetLabel;
  const fallbackStatus = isFallbackIncomplete(fallback)
    ? t.rules.globalFallback.setupHint
    : t.rules.globalFallback.tableHint;
  const { hydratedAssignments, orphanedAssignments } = hydrateAssignments(
    assignments,
    containers,
  );
  const assignmentById = new Map(
    hydratedAssignments.map((assignment) => [assignment.cookieStoreId, assignment]),
  );
  const rows: ContainerRow[] = [
    {
      id: "default-rule",
      kind: "default-rule",
      cookieStoreId: null,
      name: t.rules.globalFallback.title,
      description: fallbackStatus,
      badgeLabel: isGlobalFallbackInactive(fallback) ? t.rules.inactiveBadge : null,
      iconUrl: "",
      colorCode: "",
      isOrphaned: false,
      isInactive: isGlobalFallbackInactive(fallback),
      assignmentLocationId: fallback?.locationId ?? null,
      assignmentLabel: fallbackLabel,
      container: null,
    },
  ];
  for (const container of containers) {
    const assignment = assignmentById.get(container.cookieStoreId);
    rows.push({
      id: container.cookieStoreId,
      kind: "container",
      cookieStoreId: container.cookieStoreId,
      name: container.name,
      description: null,
      badgeLabel: null,
      iconUrl: container.iconUrl ?? "",
      colorCode: container.colorCode ?? "",
      isOrphaned: false,
      isInactive: assignment?.enabled === false,
      assignmentLocationId: assignment?.locationId ?? null,
      assignmentLabel: getAssignmentLabel(assignment?.locationId, profileLabels),
      container,
    });
  }
  for (const assignment of orphanedAssignments) {
    rows.push({
      id: assignment.cookieStoreId,
      kind: "container",
      cookieStoreId: assignment.cookieStoreId,
      name: containersT.deletedContainerLabel,
      description: null,
      badgeLabel: containersT.inactiveBadge,
      iconUrl: "",
      colorCode: "",
      isOrphaned: true,
      isInactive: assignment.enabled === false,
      assignmentLocationId: assignment.locationId ?? null,
      assignmentLabel: getAssignmentLabel(assignment.locationId, profileLabels),
      container: null,
    });
  }
  return rows.sort(compareContainerRows);
};

const useContainerData = (settings: Settings) => {
  const [containers, setContainers] = useState<ContainerPresentation[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [showInactive, setShowInactive] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");
  const refreshingRef = useRef(false);
  const fetchContainers = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const result = await listContainers();
      if (!result.available) {
        setContainers([]);
        setStatus("unavailable");
        return;
      }
      setStatus("loading");
      setContainers(result.containers);
      setStatus("ready");
    } catch {
      setContainers([]);
      setStatus("unavailable");
    } finally {
      refreshingRef.current = false;
    }
  }, []);
  useEffect(() => {
    fireAndForget(fetchContainers());
  }, [fetchContainers]);
  useEffect(
    () => setupAutoRefresh({ onRefresh: () => fireAndForget(fetchContainers()) }),
    [fetchContainers],
  );
  const profileLabels = useMemo(
    () => new Map(settings.profiles.map((profile) => [profile.id, profile.label])),
    [settings.profiles],
  );
  const allRows = useMemo(
    () =>
      buildContainerRows({
        assignments: settings.containerAssignments,
        containers,
        fallback: settings.globalFallbackRule,
        profileLabels,
      }),
    [
      containers,
      profileLabels,
      settings.containerAssignments,
      settings.globalFallbackRule,
    ],
  );
  const visibleRows = useMemo(
    () =>
      showInactive
        ? allRows
        : allRows.filter((row) => row.kind === "default-rule" || !row.isOrphaned),
    [allRows, showInactive],
  );
  const rows = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    return query
      ? visibleRows.filter((row) =>
          `${row.name} ${row.description ?? ""} ${row.cookieStoreId ?? ""} ${row.assignmentLabel}`
            .toLowerCase()
            .includes(query),
        )
      : visibleRows;
  }, [filterQuery, visibleRows]);
  return {
    allRows,
    fetchContainers,
    filterQuery,
    profileLabels,
    rows,
    setFilterQuery,
    setShowInactive,
    showInactive,
    status,
    visibleRows,
  };
};

type Data = ReturnType<typeof useContainerData>;

const getDefaultPreview = ({
  fallback,
  hasAssignment,
  profileLabels,
}: {
  fallback: Settings["globalFallbackRule"];
  hasAssignment: boolean;
  profileLabels: ReadonlyMap<string, string>;
}): DefaultRulePreview | null => {
  if (hasAssignment) return null;
  if (!fallback) return { status: "missing", locationLabel: null };
  if (fallback.enabled === false) return { status: "disabled", locationLabel: null };
  if (isFallbackIncomplete(fallback)) {
    return { status: "unconfigured", locationLabel: null };
  }
  if (
    fallback.fingerprintSurfaceOverrides?.geolocation === false ||
    !fallback.locationId
  ) {
    return { status: "active-protections", locationLabel: null };
  }
  return {
    status: "active-location",
    locationLabel:
      profileLabels.get(fallback.locationId) ?? containersT.missingLocation,
  };
};

const useEditorState = (settings: Settings, data: Data) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [cookieStoreId, setCookieStoreId] = useState<string | null>(null);
  const [hasAssignment, setHasAssignment] = useState(false);
  const [draft, setDraft] = useState<ContainerEditorDraft>(createEditorDraft());
  const [saving, setSaving] = useState(false);
  const create = useCallback(() => {
    setMode("create");
    setCookieStoreId(null);
    setHasAssignment(false);
    setDraft(createEditorDraft());
    setOpen(true);
  }, []);
  const edit = useCallback(
    (row: ContainerRow) => {
      if (row.kind !== "container" || !row.container) return;
      const assignment =
        settings.containerAssignments.find(
          (entry) => entry.cookieStoreId === row.cookieStoreId,
        ) ?? null;
      setMode("edit");
      setCookieStoreId(row.cookieStoreId);
      setHasAssignment(Boolean(assignment));
      setDraft(createEditorDraft(row.container, assignment));
      setOpen(true);
    },
    [settings.containerAssignments],
  );
  const preview = useMemo(
    () =>
      getDefaultPreview({
        fallback: settings.globalFallbackRule,
        hasAssignment,
        profileLabels: data.profileLabels,
      }),
    [data.profileLabels, hasAssignment, settings.globalFallbackRule],
  );
  return {
    cookieStoreId,
    create,
    draft,
    edit,
    mode,
    open,
    preview,
    saving,
    setDraft,
    setOpen,
    setSaving,
  };
};

type Editor = ReturnType<typeof useEditorState>;

const useAnchorSync = (settings: Settings, data: Data, editor: Editor): void => {
  const {
    anchorRequest,
    highlightedAnchorId,
    setAnchorRequest,
    triggerAnchorHighlight,
  } = settings;
  const { cookieStoreId, edit, open } = editor;
  useEffect(() => {
    const request = anchorRequest;
    if (!request?.anchorId || !isContainerAnchor(request.anchorId)) return;
    const row = data.allRows.find(
      (entry) =>
        entry.kind === "container" &&
        entry.cookieStoreId &&
        (getContainerAnchor(entry.cookieStoreId) === request.anchorId ||
          getContainerModalAnchor(entry.cookieStoreId) === request.anchorId),
    );
    if (!row?.container || !row.cookieStoreId) {
      if (data.allRows.length > 0) {
        setAnchorRequest((current) =>
          current?.nonce === request.nonce ? null : current,
        );
      }
      return;
    }
    const modalAnchor = getContainerModalAnchor(row.cookieStoreId);
    if (!open || cookieStoreId !== row.cookieStoreId) {
      edit(row);
      return;
    }
    if (highlightedAnchorId !== modalAnchor) {
      triggerAnchorHighlight(modalAnchor);
    }
    const element = document.getElementById(modalAnchor);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    setAnchorRequest((current) => (current?.nonce === request.nonce ? null : current));
  }, [
    anchorRequest,
    cookieStoreId,
    data.allRows,
    edit,
    highlightedAnchorId,
    open,
    setAnchorRequest,
    triggerAnchorHighlight,
  ]);
};

const upsertAssignment = (
  assignments: ContainerAssignment[],
  cookieStoreId: string,
  draft: ContainerEditorDraft,
): ContainerAssignment[] => {
  const previous =
    assignments.find((item) => item.cookieStoreId === cookieStoreId) ?? null;
  const next = assignments.filter((item) => item.cookieStoreId !== cookieStoreId);
  next.push(
    reconcileContainerSeed(
      {
        cookieStoreId,
        ...(draft.enabled ? {} : { enabled: false }),
        ...(draft.locationId ? { locationId: draft.locationId } : {}),
        ...(draft.surfaceOverrides
          ? { fingerprintSurfaceOverrides: draft.surfaceOverrides }
          : {}),
      },
      previous,
    ),
  );
  return next;
};

const saveEditor = async (
  settings: Settings,
  data: Data,
  editor: Editor,
): Promise<void> => {
  const name = editor.draft.name.trim();
  if (!name) {
    notify.warning(containersT.editor.nameRequired);
    return;
  }
  editor.setSaving(true);
  let browserChanged = false;
  try {
    let container: ContainerPresentation | null = null;
    if (editor.mode === "create") {
      container = await createContainer({
        name,
        color: editor.draft.color,
        icon: editor.draft.icon,
      });
    } else if (editor.cookieStoreId) {
      container = await updateContainer(editor.cookieStoreId, {
        name,
        color: editor.draft.color,
        icon: editor.draft.icon,
      });
    }
    if (!container) throw new Error(containersT.messages.saveFailed);
    browserChanged = true;
    await settings.saveContainerAssignments(
      upsertAssignment(
        settings.containerAssignments,
        container.cookieStoreId,
        editor.draft,
      ),
    );
    await data.fetchContainers();
    editor.setOpen(false);
    notify.success(
      editor.mode === "create"
        ? containersT.messages.created(container.name)
        : containersT.messages.updated(container.name),
    );
  } catch (error) {
    if (browserChanged) await data.fetchContainers();
    notify.error(
      error instanceof Error ? error.message : containersT.messages.saveFailed,
    );
  } finally {
    editor.setSaving(false);
  }
};

const deleteRow = async ({
  data,
  editor,
  row,
  settings,
  source = "table",
}: {
  data: Data;
  editor: Editor;
  row: ContainerRow;
  settings: Settings;
  source?: "table" | "editor";
}): Promise<void> => {
  const confirmed = await settings.requestConfirmation({
    title: row.isOrphaned
      ? containersT.confirmations.removeOrphanTitle
      : containersT.confirmations.deleteTitle(row.name),
    description: row.isOrphaned
      ? containersT.confirmations.removeOrphanBody
      : containersT.confirmations.deleteBody,
    confirmTone: "destructive",
    confirmLabel: row.isOrphaned
      ? containersT.removeAssignmentButton
      : containersT.deleteButton,
    cancelLabel: t.common.actions.cancel,
  });
  if (!confirmed || row.kind !== "container" || !row.cookieStoreId) return;
  try {
    if (!row.isOrphaned) await removeContainer(row.cookieStoreId);
    await settings.saveContainerAssignments(
      settings.containerAssignments.filter(
        (item) => item.cookieStoreId !== row.cookieStoreId,
      ),
    );
    if (!row.isOrphaned) await data.fetchContainers();
    if (source === "editor") editor.setOpen(false);
    notify.success(
      row.isOrphaned
        ? containersT.messages.orphanRemoved
        : containersT.messages.deleted(row.name),
    );
  } catch (error) {
    notify.error(
      error instanceof Error ? error.message : containersT.messages.deleteFailed,
    );
  }
};

const getEmptyDescription = (data: Data): string => {
  if (data.status === "loading") return containersT.loading;
  return data.visibleRows.length ? containersT.noResults : containersT.emptyBody;
};

export const useContainersModel = (): ContainersViewProps => {
  const settings = useSettings();
  const data = useContainerData(settings);
  const editor = useEditorState(settings, data);
  useAnchorSync(settings, data, editor);
  const modalAnchorId =
    editor.mode === "edit" && editor.cookieStoreId
      ? getContainerModalAnchor(editor.cookieStoreId)
      : undefined;
  const currentSeedKey =
    editor.mode === "edit" && editor.cookieStoreId
      ? (settings.containerAssignments.find(
          (item) => item.cookieStoreId === editor.cookieStoreId,
        )?.ruleSeedKey ?? null)
      : null;
  const deleteFromEditor = async (): Promise<void> => {
    const row = data.allRows.find(
      (item) => item.cookieStoreId === editor.cookieStoreId,
    );
    if (row) await deleteRow({ settings, data, editor, row, source: "editor" });
  };
  return {
    status: data.status,
    refresh: data.fetchContainers,
    create: editor.create,
    deleteRow: (row) => deleteRow({ settings, data, editor, row }),
    editRow: editor.edit,
    emptyDescription: getEmptyDescription(data),
    filterQuery: data.filterQuery,
    openFallback: settings.openFallbackDialog,
    rows: data.rows,
    setFilterQuery: data.setFilterQuery,
    setShowInactive: data.setShowInactive,
    showInactive: data.showInactive,
    showEmptyTitle: !data.visibleRows.length && data.status !== "loading",
    editor: {
      open: editor.open,
      mode: editor.mode,
      draft: editor.draft,
      defaultRulePreview: editor.preview,
      profiles: settings.profiles,
      saveInFlight: editor.saving,
      currentSeedKey,
      ...(modalAnchorId ? { modalAnchorId } : {}),
      onOpenChange: editor.setOpen,
      onDraftChange: editor.setDraft,
      onSave: () => fireAndForget(saveEditor(settings, data, editor)),
      ...(editor.mode === "edit" && editor.cookieStoreId
        ? {
            onRotateIdentity: () =>
              fireAndForget(
                settings.rotateContainerIdentity(
                  editor.cookieStoreId!,
                  editor.draft.name.trim() || containersT.editor.previewUntitled,
                ),
              ),
          }
        : {}),
      onDelete: () => fireAndForget(deleteFromEditor()),
    },
  };
};
