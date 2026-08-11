import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

import { resolveRepoPath } from "../repo-paths.js";

import { escapeMarkdownInline, escapeMarkdownTableCell } from "./markdown-escape.js";
import type { ReportInput } from "./report-input.js";

/**
 * Generates a Markdown summary suitable for GitHub Actions Job Summary
 * ($GITHUB_STEP_SUMMARY). The output contains a header with severity emoji
 * and counts, followed by a collapsible `<details>` block with the full
 * findings table.
 */
export class GithubSummaryReporter {
  static report(input: ReportInput) {
    const { config, findings, scannedApis, targets } = input;
    const outputFileName = input.outputFileName ?? "github-summary.md";
    const criticals = findings.filter((f) => f.severity === "CRITICAL");
    const warnings = findings.filter((f) => f.severity === "WARNING");
    const infos = findings.filter((f) => f.severity === "INFO");

    const statusEmoji =
      criticals.length > 0
        ? "\u{1F534}"
        : warnings.length > 0
          ? "\u{1F7E1}"
          : "\u{1F7E2}";

    const targetsLabel = targets
      .map((t) => escapeMarkdownInline(`${t.name} ${t.version}`))
      .join(", ");

    const lines: string[] = [];

    // ---- Header ----
    lines.push(
      `## ${statusEmoji} API Conformance — ${criticals.length} critical \u00B7 ${warnings.length} warning \u00B7 ${infos.length} info`,
    );
    lines.push("");
    lines.push(`**Targets:** ${targetsLabel}`);
    lines.push(`**Scanned APIs:** ${scannedApis.length}`);
    lines.push("");

    // ---- Collapsible findings table ----
    if (findings.length > 0) {
      lines.push(`<details>`);
      lines.push(`<summary>All findings (${findings.length})</summary>`);
      lines.push("");
      lines.push("| Severity | Category | API | Message | Targets |");
      lines.push("|----------|----------|-----|---------|---------|");

      // Sort: CRITICAL first, then WARNING, then INFO; alpha within severity
      const weight: Record<string, number> = { CRITICAL: 3, WARNING: 2, INFO: 1 };
      const sorted = [...findings].sort((a, b) => {
        const w = (weight[b.severity] ?? 0) - (weight[a.severity] ?? 0);
        if (w !== 0) return w;
        return a.api.localeCompare(b.api);
      });

      for (const f of sorted) {
        const sevEmoji =
          f.severity === "CRITICAL"
            ? "\u{1F534}"
            : f.severity === "WARNING"
              ? "\u{1F7E1}"
              : "\u{1F7E2}";
        const targetsCell = f.affectedTargets?.length
          ? escapeMarkdownTableCell(f.affectedTargets.join(", "))
          : "—";
        const message = escapeMarkdownTableCell(f.message);
        const api = escapeMarkdownTableCell(f.api);
        const category = escapeMarkdownTableCell(f.category);
        const severity = escapeMarkdownTableCell(f.severity);
        lines.push(
          `| ${sevEmoji} ${severity} | ${category} | \`${api}\` | ${message} | ${targetsCell} |`,
        );
      }

      lines.push("");
      lines.push("</details>");
    } else {
      lines.push("No findings detected.");
    }

    lines.push("");

    // ---- Write to file ----
    const outDir = resolveRepoPath(config.outputDir);
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }

    const outputPath = join(outDir, outputFileName);
    writeFileSync(outputPath, lines.join("\n"), "utf-8");
    console.log(`\nGitHub Summary written to ${outputPath}`);
  }
}
