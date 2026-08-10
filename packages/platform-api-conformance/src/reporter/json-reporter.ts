import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

import { resolveRepoPath } from "../repo-paths.js";
import type { ConformanceReport } from "../types.js";

import type { ReportInput } from "./report-input.js";

export class JsonReporter {
  static report(input: ReportInput) {
    const { config, findings, scannedApis, targets } = input;
    const outputFileName = input.outputFileName ?? "api-conformance-report.json";
    const report: ConformanceReport = {
      timestamp: new Date().toISOString(),
      targets,
      scannedApis,
      findings,
    };

    const outDir = resolveRepoPath(config.outputDir);
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }

    const outputPath = join(outDir, outputFileName);
    writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf-8");
    console.log(`\nJSON report successfully written to ${outputPath}`);
  }
}
