import type { GetXRayStateResponse } from "@privacy-brand/xray-protocol";
import {
  buildDiagnosticReport,
  reportBrowserFromUA,
  DiagnosticReportSchema,
} from "@privacy-brand/xray-protocol/diagnostic-report";
import { z } from "zod";

import { BUILD_CHANNEL } from "@/shared/build-flags";
import {
  EXTENSION_COMMAND_TYPES,
  EXTENSION_STORAGE_KEYS,
} from "@/shared/extension-contract";
import type { WorkerTestSession } from "@/shared/worker-test";

const sessionSchema = z.object({
  id: z.string(),
  hostname: z.string(),
  kind: z.enum(["service-worker", "shared-worker"]),
  expiresAt: z.number().finite(),
  phase: z.enum(["testing", "helped", "failed", "cancelled", "expired", "saved"]),
  configurationFingerprint: z.string(),
  before: DiagnosticReportSchema,
  after: DiagnosticReportSchema.nullable(),
});
export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal(EXTENSION_COMMAND_TYPES.getWorkerTest),
    tabId: z.number().int().nonnegative().optional(),
    hostname: z.string(),
  }),
  z.object({
    type: z.literal(EXTENSION_COMMAND_TYPES.startWorkerTest),
    tabId: z.number().int().nonnegative().optional(),
    hostname: z.string(),
    kind: z.enum(["service-worker", "shared-worker"]),
  }),
  z.object({
    type: z.literal(EXTENSION_COMMAND_TYPES.finishWorkerTest),
    tabId: z.number().int().nonnegative().optional(),
    hostname: z.string(),
    id: z.string(),
    action: z.enum(["helped", "failed", "cancel", "save"]),
  }),
]);
export const key = EXTENSION_STORAGE_KEYS.workerTestSessions;
export const readSessions = async (): Promise<Record<string, WorkerTestSession>> => {
  const stored = await chrome.storage.session.get(key);
  return z.record(sessionSchema).safeParse(stored[key]).data ?? {};
};
export const report = (state: GetXRayStateResponse | null) =>
  buildDiagnosticReport({
    state,
    generatedAt: Date.now(),
    collectionPending: false,
    extension: {
      version: chrome.runtime.getManifest().version,
      channel: BUILD_CHANNEL,
    },
    browser: reportBrowserFromUA(navigator.userAgent),
  });
