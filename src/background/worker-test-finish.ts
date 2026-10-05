import type { GetXRayStateResponse } from "@privacy-brand/xray-protocol";

import {
  configurationFingerprint,
  readConfiguration,
} from "@/background/settings-import-storage";
import { setHostPause } from "@/background/storage/host-protection-pauses";
import { saveWorkerTestException } from "@/background/worker-test-rule";
import { report } from "@/background/worker-test-state";
import type { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import type {
  HostPauseStatus,
  HostProtectionPause,
} from "@/shared/host-protection-pause";
import type {
  WorkerTestCommand,
  WorkerTestResponse,
  WorkerTestSession,
} from "@/shared/worker-test";
export const finishWorkerTest = async ({
  command,
  session,
  active,
  status,
  blocked,
  state,
  tab,
  store,
  activate,
}: {
  command: Extract<
    WorkerTestCommand,
    { type: typeof EXTENSION_COMMAND_TYPES.finishWorkerTest }
  >;
  session: WorkerTestSession | null;
  active: HostProtectionPause | undefined;
  status: HostPauseStatus;
  blocked: string | null;
  state: GetXRayStateResponse;
  tab: chrome.tabs.Tab | undefined;
  store: (next: WorkerTestSession) => Promise<void>;
  activate: (hostname: string) => Promise<void>;
}): Promise<WorkerTestResponse | undefined> => {
  const hostname = command.hostname;

  if (!session || session.id !== command.id)
    return { ok: false, error: "test-changed" };
  if (active?.id !== session.id) return { ok: false, error: "test-expired" };
  if (command.action !== "cancel" && status.reloadRequired)
    return { ok: false, error: "reload-required" };
  const after = session.after ?? report(state);
  if (command.action === "helped") {
    await store({ ...session, phase: "helped", after });
  } else {
    if (command.action === "save") {
      if (
        session.phase !== "helped" ||
        blocked ||
        session.configurationFingerprint !==
          (await configurationFingerprint(await readConfiguration()))
      )
        return { ok: false, error: "configuration-changed" };
      await saveWorkerTestException(tab, session);
    }
    await setHostPause(hostname, "resume");
    await store({
      ...session,
      after,
      phase: finishPhase(command.action),
    });
    await activate(hostname);
  }
};

const finishPhase = (
  action: "save" | "failed" | "cancel",
): "saved" | "failed" | "cancelled" => {
  if (action === "save") return "saved";
  return action === "failed" ? "failed" : "cancelled";
};
