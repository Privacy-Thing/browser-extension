import { planControlDCleanup } from "./cleanup";
import {
  cleanupFailure,
  executeControlDCleanup,
  type CleanupLocalState,
} from "./cleanup-execution";
import { ControlDClient } from "./client";
import {
  CONTROL_D_COMMANDS,
  type CleanupPlan,
  type CleanupResponse,
  type ControlDCommand,
} from "./contracts";
import { loadRecognitionState, saveRecognitionState } from "./recognition-setup";
import { hashControlDValue } from "./service-reconcile";
import {
  forgetControlDApiKey,
  loadControlDApiKey,
  loadControlDConfig,
  saveControlDConfig,
  toControlDPublicState,
} from "./storage";

const loadState = async (): Promise<CleanupLocalState> => ({
  config: await loadControlDConfig(),
  recognition: await loadRecognitionState(),
});
const checkpoint = async (state: CleanupLocalState): Promise<void> => {
  await saveControlDConfig(state.config);
  await saveRecognitionState(state.recognition);
};

export const createCleanupController = () => {
  let reviewed: { plan: CleanupPlan; localHash: string } | null = null;
  return {
    invalidate: () => {
      reviewed = null;
    },
    respond: async (command: ControlDCommand): Promise<CleanupResponse> => {
      const state = await loadState();
      const apiKey = await loadControlDApiKey();
      const publicState = await toControlDPublicState(state.config);
      if (!apiKey)
        return {
          ok: false,
          state: publicState,
          error: "Connect a Control D API key first.",
        };
      const client = new ControlDClient(apiKey);
      try {
        if (command.type === CONTROL_D_COMMANDS.planCleanup) {
          reviewed = null;
          const resources = await planControlDCleanup(
            client,
            state.config,
            state.recognition,
          );
          const plan = { token: crypto.randomUUID(), resources };
          reviewed = { plan, localHash: await hashControlDValue(state) };
          return { ok: true, state: publicState, plan };
        }
        const session = reviewed;
        reviewed = null;
        if (
          command.type !== CONTROL_D_COMMANDS.executeCleanup ||
          !session ||
          typeof command.cleanupToken !== "string" ||
          command.cleanupToken !== session.plan.token ||
          session.localHash !== (await hashControlDValue(state))
        ) {
          return {
            ok: false,
            state: publicState,
            error: "Cleanup preview changed. Review the cleanup plan again.",
          };
        }
        state.config = {
          ...state.config,
          connected: false,
          autoSyncEnabled: false,
          status: "disconnected",
          dnsVerification: null,
          lastError: null,
        };
        state.recognition = {
          ...state.recognition,
          phase: state.recognition.code ? "error" : "not-setup",
          resolverDoh: null,
          lastError: null,
        };
        await checkpoint(state);
        const results = await executeControlDCleanup({
          client,
          resources: session.plan.resources,
          state,
          checkpoint,
        });
        const retryAvailable = results.some((result) => result.status === "failed");
        if (!retryAvailable) await forgetControlDApiKey();
        return {
          ok: true,
          state: await toControlDPublicState(state.config),
          report: { results, retryAvailable },
        };
      } catch (error) {
        reviewed = null;
        return {
          ok: false,
          state: await toControlDPublicState(state.config),
          error: cleanupFailure(error),
        };
      }
    },
  };
};
