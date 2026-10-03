import { serializeDiagnosticJson } from "@privacy-brand/xray-protocol/diagnostic-report";
import { useState } from "react";

import type { WorkerTestSession } from "@/shared/worker-test";
import { Button } from "@/ui/components/ui/button";
import { t } from "@/ui/i18n";
import { downloadLocalText } from "@/ui/shared/local-download";

export const WorkerTestReport = ({ session }: { session: WorkerTestSession }) => {
  const [selected, setSelected] = useState<"before" | "after">("before");
  const [error, setError] = useState<string | null>(null);
  const value = selected === "before" ? session.before : session.after;
  const preview = value ? serializeDiagnosticJson(value) : "";
  const download = () => {
    if (!value) return;
    try {
      downloadLocalText(
        `privacy-thing-test-${selected}-v1.json`,
        preview,
        "application/json",
      );
    } catch {
      setError(t.sidebar.report.error);
    }
  };
  return (
    <details
      data-worker-test-report
      className="rounded-md border border-border p-3 text-xs"
    >
      <summary className="cursor-pointer font-medium">
        {t.sidebar.troubleshooter.report}
      </summary>
      <p className="mt-2 text-muted-foreground">
        {t.sidebar.troubleshooter.reportHint}
      </p>
      <div
        className="my-2 flex gap-2"
        role="group"
        aria-label={t.sidebar.report.preview}
      >
        {(["before", "after"] as const).map((phase) => (
          <Button
            key={phase}
            size="sm"
            variant={phase === selected ? "secondary" : "ghost"}
            aria-pressed={phase === selected}
            disabled={phase === "after" && !session.after}
            data-worker-report-phase={phase}
            onClick={() => setSelected(phase)}
          >
            {t.sidebar.troubleshooter[phase]}
          </Button>
        ))}
      </div>
      <textarea
        readOnly
        value={preview}
        data-worker-report-preview
        aria-label={t.sidebar.report.preview}
        className="h-40 w-full resize-none rounded-md border border-border bg-muted/30 p-2 font-mono text-[10px]"
      />
      {error ? <p role="alert">{error}</p> : null}
      <Button
        size="sm"
        variant="outline"
        className="mt-2"
        disabled={!value}
        onClick={download}
        data-worker-report-download
      >
        {t.sidebar.report.downloadJson}
      </Button>
    </details>
  );
};
