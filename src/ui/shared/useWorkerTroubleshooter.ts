import type { GetXRayStateResponse } from "@privacy-brand/xray-protocol";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  EXTENSION_COMMAND_TYPES,
  EXTENSION_STORAGE_KEYS,
} from "@/shared/extension-contract";
import type {
  WorkerTestCommand,
  WorkerTestState,
  WorkerTestResponse,
} from "@/shared/worker-test";
import { t } from "@/ui/i18n";
import { sendMessageOrThrow } from "@/ui/shared/runtime-messaging";
import type { WorkerTestAction } from "@/ui/shared/WorkerTroubleshooterView";
type Target = { tabId: number; hostname: string };
const useWorkerState = () => {
  const [target, setTarget] = useState<Target | null>(null);
  const [data, setData] = useState<WorkerTestState | null>(null);
  const [xray, setXray] = useState<GetXRayStateResponse | null>(null);
  const [pending, setPending] = useState<"loading" | "action" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const generation = useRef(0);
  return {
    target,
    setTarget,
    data,
    setData,
    xray,
    setXray,
    pending,
    setPending,
    error,
    setError,
    now,
    setNow,
    generation,
  };
};
type Model = ReturnType<typeof useWorkerState>;
const useWorkerLoader = (model: Model) => {
  const { generation, setData, setXray } = model;
  const load = useCallback(
    async (current: Target) => {
      const id = ++generation.current;
      const [response, state] = await Promise.all([
        sendMessageOrThrow<WorkerTestResponse>({
          type: EXTENSION_COMMAND_TYPES.getWorkerTest,
          ...current,
        }),
        sendMessageOrThrow<GetXRayStateResponse>({
          type: EXTENSION_COMMAND_TYPES.getXRayState,
          tabId: current.tabId,
        }),
      ]);
      if (id !== generation.current) return;
      if (!response.ok) throw new Error(response.error);
      setData(response);
      setXray(state);
    },
    [generation, setData, setXray],
  );
  return load;
};
type Loader = ReturnType<typeof useWorkerLoader>;
const createTestActions = (model: Model, load: Loader, tabId: number | undefined) => {
  const {
    target,
    setTarget,
    data,
    setData,
    pending,
    setPending,
    setError,
    generation,
  } = model;
  const open = async () => {
    setPending("loading");
    setError(null);
    setData(null);
    try {
      const tab =
        tabId === undefined
          ? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
          : await chrome.tabs.get(tabId);
      if (!tab?.url || tab.id === undefined || !/^https?:/.test(tab.url))
        throw new Error("unsupported");
      const current = { tabId: tab.id, hostname: new URL(tab.url).hostname };
      setTarget(current);
      await load(current);
    } catch {
      setError(t.sidebar.troubleshooter.error);
    } finally {
      setPending(null);
    }
  };
  const action = async (value: WorkerTestAction) => {
    if (!target || pending) return;
    setPending("action");
    setError(null);
    try {
      if (value === "reload") {
        await chrome.tabs.reload(target.tabId);
      } else {
        const command: WorkerTestCommand =
          value === "service-worker" || value === "shared-worker"
            ? { type: EXTENSION_COMMAND_TYPES.startWorkerTest, ...target, kind: value }
            : {
                type: EXTENSION_COMMAND_TYPES.finishWorkerTest,
                ...target,
                id: data?.session?.id ?? "",
                action: value,
              };
        const response = await sendMessageOrThrow<WorkerTestResponse>(command);
        if (!response.ok) throw new Error(response.error);
        setData(response);
      }
      await load(target);
    } catch {
      setError(t.sidebar.troubleshooter.error);
    } finally {
      setPending(null);
    }
  };
  const close = async () => {
    if (pending) return;
    if (
      data?.session &&
      (data.session.phase === "testing" || data.session.phase === "helped")
    ) {
      setPending("action");
      try {
        const response = await sendMessageOrThrow<WorkerTestResponse>({
          type: EXTENSION_COMMAND_TYPES.finishWorkerTest,
          ...target!,
          id: data.session.id,
          action: "cancel",
        });
        if (!response.ok && response.error !== "test-expired")
          throw new Error(response.error);
      } catch {
        setError(t.sidebar.troubleshooter.error);
        return;
      } finally {
        setPending(null);
      }
    }
    generation.current++;
    setTarget(null);
  };
  return { open, action, close };
};
const useWorkerUpdates = (model: Model, load: Loader) => {
  const { target, data, setError, setNow } = model;
  useEffect(() => {
    if (!target) return;
    const refresh = () =>
      void load(target).catch(() => setError(t.sidebar.troubleshooter.error));
    const onUpdated: Parameters<typeof chrome.tabs.onUpdated.addListener>[0] = (
      id,
      info,
    ) => {
      if (id === target.tabId && info.status === "complete") refresh();
    };
    const onChanged: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
    ) => {
      const keys = EXTENSION_STORAGE_KEYS;
      if (
        [
          keys.preferences,
          keys.rules,
          keys.locations,
          keys.controlState,
          keys.containerAssignments,
          keys.trustedSites,
          keys.hostProtectionPauses,
          keys.pausedDocuments,
          keys.workerTestSessions,
        ].some((key) => key in changes)
      )
        refresh();
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, [target, load, setError]);
  useEffect(() => {
    const session = data?.session;
    if (!target || !session || !["testing", "helped"].includes(session.phase)) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= session.expiresAt) {
        window.clearInterval(timer);
        void load(target).catch(() => setError(t.sidebar.troubleshooter.error));
      }
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [target, data?.session, load, setError, setNow]);
};
const useAbandonedTest = (model: Model) => {
  const latest = useRef(model);
  useEffect(() => {
    latest.current = model;
  });
  useEffect(() => {
    const cancel = () => {
      const { data, target } = latest.current;
      const session = data?.session;
      if (!target || !session || !["testing", "helped"].includes(session.phase)) return;
      void chrome.runtime
        .sendMessage({
          type: EXTENSION_COMMAND_TYPES.finishWorkerTest,
          ...target,
          id: session.id,
          action: "cancel",
        })
        .catch(() => undefined);
    };
    window.addEventListener("pagehide", cancel);
    return () => {
      window.removeEventListener("pagehide", cancel);
      cancel();
    };
  }, []);
};
export const useWorkerTroubleshooter = (tabId: number | undefined) => {
  const model = useWorkerState();
  const load = useWorkerLoader(model);
  useWorkerUpdates(model, load);
  useAbandonedTest(model);
  return { ...model, ...createTestActions(model, load, tabId) };
};
