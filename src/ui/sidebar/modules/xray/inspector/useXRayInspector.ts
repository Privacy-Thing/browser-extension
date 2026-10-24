import type {
  XRayInspectorApply,
  XRayInspectorAppliedVia,
  XRayInspectorMode,
  XRayInspectorState,
  XRayLiveCoverage,
} from "@privacy-brand/xray-protocol";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  InspectorMissingError,
  unavailableInspector,
  type InspectorApi,
} from "./inspector-api";
import { armableSelection, sameMethodSet } from "./inspector-selection";

import { fireAndForget } from "@/shared/async";

export interface InspectorPendingAction {
  kind: "set" | "clear";
  apply: XRayInspectorApply;
}

export interface InspectorResult {
  kind: "armed" | "disarmed";
  appliedVia: XRayInspectorAppliedVia;
  count: number;
  /** Documents of the tab a live update reached or left for their next load. */
  liveCoverage?: XRayLiveCoverage;
}

export interface XRayInspectorController {
  state: XRayInspectorState | null;
  loadError: string | null;
  selection: ReadonlySet<string>;
  /** Selected IDs that the background can arm, in catalog order. */
  armableMethodIds: readonly string[];
  mode: XRayInspectorMode;
  /** Armed, but the draft selection or mode differs from what is armed. */
  dirty: boolean;
  pending: InspectorPendingAction | null;
  result: InspectorResult | null;
  actionError: string | null;
  setSelection: (next: ReadonlySet<string>) => void;
  setMode: (mode: XRayInspectorMode) => void;
  revert: () => void;
  /** Arms the draft selection, or disarms when the selection is empty. */
  apply: (apply: XRayInspectorApply) => void;
  disarm: (apply: XRayInspectorApply) => void;
  /** Reloads the tab for documents that a live update left pending. */
  reload: () => void;
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/**
 * The user's draft selection and mode. It follows the armed configuration
 * until the user edits it; edits are never overwritten by a refresh.
 */
const useInspectorDraft = () => {
  const [selection, setSelectionState] = useState<ReadonlySet<string>>(new Set());
  const [mode, setModeState] = useState<XRayInspectorMode>("first-call");
  const editedRef = useRef(false);

  const replace = useCallback(
    (methodIds: Iterable<string>, nextMode: XRayInspectorMode) => {
      editedRef.current = false;
      setSelectionState(new Set(methodIds));
      setModeState(nextMode);
    },
    [],
  );
  const follow = useCallback(
    (next: XRayInspectorState, force: boolean) => {
      if (next.armed && (force || !editedRef.current)) {
        replace(next.methodIds, next.mode);
      }
    },
    [replace],
  );
  const setSelection = useCallback((next: ReadonlySet<string>) => {
    editedRef.current = true;
    setSelectionState(next);
  }, []);
  const setMode = useCallback((next: XRayInspectorMode) => {
    editedRef.current = true;
    setModeState(next);
  }, []);

  return { selection, mode, replace, follow, setSelection, setMode };
};

/** Loads the background's per-tab arming state; switching tabs resets everything. */
const useInspectorState = (
  api: InspectorApi,
  tabId: number | undefined,
  refreshKey: unknown,
  draft: ReturnType<typeof useInspectorDraft>,
) => {
  const [state, setState] = useState<XRayInspectorState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Loads and commands are versioned separately so a refresh never orphans an
  // in-flight command; switching tabs invalidates both.
  const tabGenerationRef = useRef(0);
  const loadRef = useRef(0);
  const { follow, replace } = draft;

  const adopt = useCallback(
    (next: XRayInspectorState, force: boolean) => {
      // A load that started before a command must not overwrite its result.
      if (force) loadRef.current += 1;
      setState(next);
      follow(next, force);
    },
    [follow],
  );

  useEffect(() => {
    tabGenerationRef.current += 1;
    setState(null);
    setLoadError(null);
    replace([], "first-call");
  }, [tabId, replace]);

  useEffect(() => {
    if (tabId === undefined) return;
    const loadId = ++loadRef.current;
    const generation = tabGenerationRef.current;
    const isCurrent = () =>
      loadId === loadRef.current && generation === tabGenerationRef.current;
    fireAndForget(
      api.get(tabId).then(
        (next) => {
          if (!isCurrent()) return;
          setLoadError(null);
          adopt(next, false);
        },
        (error: unknown) => {
          if (!isCurrent()) return;
          setLoadError(errorMessage(error));
        },
      ),
    );
  }, [api, tabId, refreshKey, adopt]);

  return { state, setState, loadError, adopt, tabGenerationRef };
};

/**
 * Owns the per-tab Inspector draft and mirrors the arming state held by the
 * background for that tab.
 */
export const useXRayInspector = ({
  api,
  tabId,
  refreshKey,
}: {
  api: InspectorApi;
  tabId: number | undefined;
  /** Changes whenever the X-Ray state was re-fetched (navigation, reload). */
  refreshKey: unknown;
}): XRayInspectorController => {
  const draft = useInspectorDraft();
  const { selection, mode, replace } = draft;
  const { state, setState, loadError, adopt, tabGenerationRef } = useInspectorState(
    api,
    tabId,
    refreshKey,
    draft,
  );
  const [pending, setPending] = useState<InspectorPendingAction | null>(null);
  const [result, setResult] = useState<InspectorResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setPending(null);
    setResult(null);
    setActionError(null);
  }, [tabId]);

  const trappable = useMemo(
    () => new Set(state?.trappableMethodIds ?? []),
    [state?.trappableMethodIds],
  );
  const armableMethodIds = useMemo(
    () => armableSelection(selection, trappable),
    [selection, trappable],
  );
  const dirty = Boolean(
    state?.armed &&
    (mode !== state.mode || !sameMethodSet(armableMethodIds, state.methodIds)),
  );

  const run = useCallback(
    (action: InspectorPendingAction, count: number) => {
      if (tabId === undefined) return;
      const generation = tabGenerationRef.current;
      setPending(action);
      setActionError(null);
      setResult(null);
      const request =
        action.kind === "set"
          ? api.set({ tabId, methodIds: armableMethodIds, mode, apply: action.apply })
          : api.clear({ tabId, apply: action.apply });
      fireAndForget(
        request.then(
          ({ state: next, appliedVia, liveCoverage }) => {
            if (generation !== tabGenerationRef.current) return;
            setPending(null);
            adopt(next, true);
            const kind = action.kind === "set" ? "armed" : "disarmed";
            setResult({
              kind,
              appliedVia,
              count,
              ...(liveCoverage ? { liveCoverage } : {}),
            });
          },
          (error: unknown) => {
            if (generation !== tabGenerationRef.current) return;
            setPending(null);
            if (error instanceof InspectorMissingError) {
              setState(unavailableInspector("no-runtime"));
              return;
            }
            setActionError(errorMessage(error));
          },
        ),
      );
    },
    [api, tabId, armableMethodIds, mode, adopt, setState, tabGenerationRef],
  );

  const disarm = useCallback(
    (apply: XRayInspectorApply) => run({ kind: "clear", apply }, 0),
    [run],
  );
  const apply = useCallback(
    (applyMode: XRayInspectorApply) => {
      if (armableMethodIds.length > 0) {
        run({ kind: "set", apply: applyMode }, armableMethodIds.length);
      } else if (state?.armed) {
        disarm(applyMode);
      }
    },
    [armableMethodIds.length, state?.armed, disarm, run],
  );
  const revert = useCallback(() => {
    if (state?.armed) replace(state.methodIds, state.mode);
  }, [state, replace]);
  const reload = useCallback(() => {
    if (tabId === undefined) return;
    setResult(null);
    setActionError(null);
    fireAndForget(
      api.reload(tabId).catch((error: unknown) => setActionError(errorMessage(error))),
    );
  }, [api, tabId]);

  return {
    state,
    loadError,
    selection,
    armableMethodIds,
    mode,
    dirty,
    pending,
    result,
    actionError,
    setSelection: draft.setSelection,
    setMode: draft.setMode,
    revert,
    apply,
    disarm,
    reload,
  };
};
