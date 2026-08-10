import type { Finding, BrowserTarget } from "../types.js";

export class ConsoleReporter {
  static report(findings: Finding[], targets: BrowserTarget[], scannedApis: string[]) {
    const criticals = findings.filter((f) => f.severity === "CRITICAL");
    const warnings = findings.filter((f) => f.severity === "WARNING");
    const infos = findings.filter((f) => f.severity === "INFO");

    console.log(
      `\nTargets: ${targets.map((t) => `${t.name} ${t.version}`).join(", ")}\n`,
    );

    console.log(`Detected API changes (${scannedApis.length}):`);
    console.log(`  ${scannedApis.join("\n  ")}\n`);

    const printFinding = (icon: string, f: (typeof findings)[number]) => {
      const targetSuffix = f.affectedTargets?.length
        ? ` [${f.affectedTargets.join(", ")}]`
        : "";
      console.log(`  ${icon} [${f.category}] ${f.api}${targetSuffix}`);
      console.log(`    ${f.message}`);
      if (f.location) console.log(`    → ${f.location}\n`);
    };

    if (criticals.length > 0) {
      console.log(`CRITICAL (${criticals.length}):`);
      for (const f of criticals) printFinding("✗", f);
    }

    if (warnings.length > 0) {
      console.log(`WARNING (${warnings.length}):`);
      for (const f of warnings) printFinding("⚠", f);
    }

    if (infos.length > 0) {
      console.log(`INFO (${infos.length}):`);
      for (const f of infos) printFinding("ℹ", f);
    }

    console.log(
      `\nSummary: ${criticals.length} critical · ${warnings.length} warning · ${infos.length} info`,
    );
  }
}
