import type { GetXRayStateResponse } from "@privacy-brand/xray-protocol";
import {
  buildDiagnosticReport,
  type DiagnosticReport,
  reportBrowserFromUA,
  serializeDiagnosticJson,
  serializeDiagnosticText,
} from "@privacy-brand/xray-protocol/diagnostic-report";
import { useState } from "react";

import { BUILD_CHANNEL } from "@/shared/build-flags";
import { Button } from "@/ui/components/ui/button";
import { Checkbox } from "@/ui/components/ui/checkbox";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog";
import { t } from "@/ui/i18n";
import { downloadLocalText } from "@/ui/shared/local-download";

type ReportSession = {
  redacted: DiagnosticReport;
  withSite: DiagnosticReport;
  includeSite: boolean;
  format: "json" | "text";
};

const prepareReport = (
  state: GetXRayStateResponse | null,
  collectionPending: boolean,
): ReportSession => {
  const manifestVersion = globalThis.chrome?.runtime?.getManifest?.().version;
  const version =
    manifestVersion && /^\d{1,5}(?:\.\d{1,5}){2,3}$/.test(manifestVersion)
      ? manifestVersion
      : null;
  const input = {
    state,
    generatedAt: Date.now(),
    extension: { version, channel: BUILD_CHANNEL },
    browser: reportBrowserFromUA(navigator.userAgent),
    collectionPending,
  };
  return {
    redacted: buildDiagnosticReport(input),
    withSite: buildDiagnosticReport({ ...input, includeSiteData: true }),
    includeSite: false,
    format: "text",
  };
};

const activeReport = (session: ReportSession): DiagnosticReport =>
  session.includeSite ? session.withSite : session.redacted;

type DialogProps = {
  session: ReportSession;
  error: string | null;
  update: (change: Partial<Pick<ReportSession, "includeSite" | "format">>) => void;
  cancel: () => void;
  download: (format: ReportSession["format"]) => void;
};
const ReportSiteChoice = ({
  session,
  update,
}: Pick<DialogProps, "session" | "update">) => (
  <div className="flex flex-col gap-2 text-xs">
    <p className="rounded-md border border-border bg-muted/40 p-2" data-report-summary>
      {activeReport(session).status === "partial"
        ? t.sidebar.report.partial
        : t.sidebar.report.complete}{" "}
      {t.sidebar.report.evidenceHint}
    </p>
    <label className="flex items-start gap-2">
      <Checkbox
        data-report-site-toggle
        checked={session.includeSite}
        onChange={(event) => update({ includeSite: event.target.checked })}
      />
      <span>
        {t.sidebar.report.includeSite}
        <span className="block text-muted-foreground">{t.sidebar.report.siteHint}</span>
      </span>
    </label>
  </div>
);
const ReportPreview = ({ session, error, update, cancel, download }: DialogProps) => {
  const report = activeReport(session);
  const preview =
    session.format === "json"
      ? serializeDiagnosticJson(report)
      : serializeDiagnosticText(report);
  return (
    <DialogContent
      className="max-h-[92vh] max-w-2xl w-[calc(100%-1.5rem)] min-w-0 grid-rows-[auto_auto_auto_minmax(0,1fr)_auto] gap-3 p-4"
      data-diagnostic-report
      data-report-status={report.status}
      data-report-format={session.format}
      data-report-site={session.includeSite ? "included" : "excluded"}
    >
      <DialogCloseButton label={t.sidebar.report.cancel} />
      <DialogHeader className="pr-8">
        <DialogTitle>{t.sidebar.report.title}</DialogTitle>
        <DialogDescription>{t.sidebar.report.localOnly}</DialogDescription>
      </DialogHeader>
      <ReportSiteChoice session={session} update={update} />
      <div className="flex gap-2" role="group" aria-label={t.sidebar.report.preview}>
        {(["text", "json"] as const).map((format) => (
          <Button
            key={format}
            size="sm"
            variant={session.format === format ? "secondary" : "ghost"}
            aria-pressed={session.format === format}
            data-report-view={format}
            onClick={() => update({ format })}
          >
            {format === "json" ? "JSON" : t.sidebar.report.text}
          </Button>
        ))}
      </div>
      <textarea
        readOnly
        aria-label={t.sidebar.report.preview}
        data-report-preview
        value={preview}
        className="min-h-0 h-[40vh] w-full resize-none overflow-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-[10px] leading-relaxed"
      />
      <div className="flex flex-col gap-2">
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" size="sm" data-report-cancel onClick={cancel}>
            {t.sidebar.report.cancel}
          </Button>
          <Button
            variant="outline"
            size="sm"
            data-report-download="text"
            onClick={() => download("text")}
          >
            {t.sidebar.report.downloadText}
          </Button>
          <Button
            size="sm"
            data-report-download="json"
            onClick={() => download("json")}
          >
            {t.sidebar.report.downloadJson}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
};

export const XRayDiagnosticReport = ({
  state,
  collectionPending,
}: {
  state: GetXRayStateResponse | null;
  collectionPending: boolean;
}) => {
  const [session, setSession] = useState<ReportSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancel = () => {
    setSession(null);
    setError(null);
  };
  const prepare = () => {
    setError(null);
    try {
      setSession(prepareReport(state, collectionPending));
    } catch {
      setError(t.sidebar.report.error);
    }
  };
  const update: DialogProps["update"] = (change) =>
    setSession((current) => (current ? { ...current, ...change } : null));
  const download = (format: ReportSession["format"]) => {
    if (!session) return;
    try {
      const report = activeReport(session);
      downloadLocalText(
        `privacy-thing-diagnostic-v1.${format === "json" ? "json" : "txt"}`,
        format === "json"
          ? serializeDiagnosticJson(report)
          : serializeDiagnosticText(report),
        format === "json" ? "application/json" : "text/plain",
      );
    } catch {
      setError(t.sidebar.report.error);
    }
  };
  return (
    <div data-xray-report-entry className="flex flex-col gap-2">
      <Button
        variant="outline"
        className="w-full"
        onClick={prepare}
        data-report-prepare
      >
        <i className="fa-solid fa-file-lines mr-2" aria-hidden="true" />
        {t.sidebar.report.prepare}
      </Button>
      {!session && error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <Dialog
        open={session !== null}
        onOpenChange={(open) => {
          if (!open) cancel();
        }}
      >
        {session ? (
          <ReportPreview
            session={session}
            error={error}
            update={update}
            cancel={cancel}
            download={download}
          />
        ) : null}
      </Dialog>
    </div>
  );
};
