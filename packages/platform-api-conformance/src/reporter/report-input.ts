import type { BrowserTarget, Config, Finding } from "../types.js";

export type ReportInput = {
  config: Config;
  findings: Finding[];
  outputFileName?: string;
  scannedApis: string[];
  targets: BrowserTarget[];
};
