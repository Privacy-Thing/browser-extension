import type { GetXRayStateResponse } from "@privacy-brand/xray-protocol";

import {
  configurationFingerprint,
  readConfiguration,
} from "@/background/settings-import-storage";
import {
  withConfigurationLock,
  withConfigMutation,
} from "@/background/settings-import-transaction";
import {
  getHostPause,
  getHostPauseStatus,
  initializeHostPauses,
  setHostPause,
} from "@/background/storage/host-protection-pauses";
import { getPreferences } from "@/background/storage/preferences";
import { finishWorkerTest } from "@/background/worker-test-finish";
import {
  commandSchema,
  key,
  readSessions,
  report,
} from "@/background/worker-test-state";
import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import type { HostPauseStatus } from "@/shared/host-protection-pause";
import { HOST_PAUSE_DURATION_MS } from "@/shared/host-protection-pause";
import type {
  WorkerTestCommand,
  WorkerTestResponse,
  WorkerTestSession,
  WorkerTestState,
} from "@/shared/worker-test";
import { workerTestCandidates } from "@/shared/worker-test";

const getBlocked = (
  state: GetXRayStateResponse,
  status: HostPauseStatus,
): WorkerTestState["blocked"] => {
  if (!state.ok || !state.hostname) return "unsupported";
  if (state.explanation?.winningSource === "trusted-site") return "trusted";
  if (status.pause) return "pause";
  if (status.reloadRequired) return "reload";
  return state.snapshot ? null : "inactive";
};

type Deps = {
  getXRayState: (tabId?: number) => Promise<GetXRayStateResponse>;
  activate: (hostname: string) => Promise<void>;
};
const activateTest = async ({
  command,
  state,
  store,
  deps,
}: {
  command: Extract<
    WorkerTestCommand,
    { type: typeof EXTENSION_COMMAND_TYPES.startWorkerTest }
  >;
  state: GetXRayStateResponse;
  store: (next: WorkerTestSession) => Promise<void>;
  deps: Deps;
}): Promise<void> => {
  const hostname = command.hostname;
  const id = crypto.randomUUID();
  const next: WorkerTestSession = {
    id,
    hostname,
    kind: command.kind,
    phase: "testing",
    expiresAt: Date.now() + HOST_PAUSE_DURATION_MS,
    configurationFingerprint: await configurationFingerprint(await readConfiguration()),
    before: report(state),
    after: null,
  };
  await store(next);
  await setHostPause(hostname, "ten-minutes", command.kind, id);
  try {
    await deps.activate(hostname);
  } catch (error) {
    if (getHostPause(hostname)?.id === id) await setHostPause(hostname, "resume");
    await store({ ...next, phase: "failed" });
    await deps.activate(hostname).catch(() => undefined);
    throw error;
  }
};
const matchesTestHost = (tab: chrome.tabs.Tab | undefined, hostname: string): boolean =>
  Boolean(
    tab?.url &&
    tab.id !== undefined &&
    /^https?:/.test(tab.url) &&
    new URL(tab.url).hostname === hostname,
  );
const runWorkerTest = async (
  command: WorkerTestCommand,
  deps: Deps,
): Promise<WorkerTestResponse> => {
  await initializeHostPauses();
  const tab =
    command.tabId === undefined
      ? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
      : await chrome.tabs.get(command.tabId).catch(() => undefined);
  const sameHost = matchesTestHost(tab, command.hostname);
  const cancelling =
    command.type === EXTENSION_COMMAND_TYPES.finishWorkerTest &&
    command.action === "cancel";
  if (!sameHost && !cancelling) return { ok: false, error: "site-changed" };
  const hostname = command.hostname;
  const sessions = await readSessions();
  let session = sessions[hostname] ?? null;
  const store = async (next: WorkerTestSession) => {
    sessions[hostname] = next;
    await chrome.storage.session.set({ [key]: sessions });
    session = next;
  };
  const state: GetXRayStateResponse = sameHost
    ? await deps.getXRayState(tab?.id)
    : { ok: false, error: "site-changed" };
  const active = getHostPause(hostname);
  if (
    session &&
    (session.phase === "testing" || session.phase === "helped") &&
    active?.id !== session.id
  ) {
    await store({
      ...session,
      phase: "expired",
      after: session.after ?? report(state),
    });
  }
  const status = getHostPauseStatus(hostname, tab?.id);
  const blocked = getBlocked(state, status);
  if (command.type === EXTENSION_COMMAND_TYPES.startWorkerTest) {
    if (
      blocked ||
      active ||
      !workerTestCandidates(state, Date.now()).some(
        (candidate) => candidate.kind === command.kind,
      )
    )
      return { ok: false, error: "test-unavailable" };
    await activateTest({ command, state, store, deps });
  }
  if (command.type === EXTENSION_COMMAND_TYPES.finishWorkerTest) {
    const failure = await finishWorkerTest({
      command,
      session,
      active,
      status,
      blocked,
      state,
      tab,
      store,
      activate: deps.activate,
    });
    if (failure) return failure;
  }
  const current = getHostPauseStatus(hostname, tab?.id);
  const savedException = (await getPreferences()).workerPolicyExceptions[hostname];
  return {
    ...(savedException ? { savedException } : {}),
    ok: true,
    session,
    candidates: workerTestCandidates(state, Date.now()),
    blocked,
    reloadRequired: current.reloadRequired,
  };
};
export const createWorkerTestCtl =
  (getXRayState: Deps["getXRayState"], activate: Deps["activate"]) =>
  async (input: WorkerTestCommand): Promise<WorkerTestResponse> => {
    const parsed = commandSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "invalid-command" };
    try {
      const coordinate =
        input.type === EXTENSION_COMMAND_TYPES.finishWorkerTest &&
        input.action === "save"
          ? withConfigMutation
          : withConfigurationLock;
      return await coordinate(() =>
        runWorkerTest(parsed.data, { getXRayState, activate }),
      );
    } catch {
      return { ok: false, error: "test-failed" };
    }
  };
