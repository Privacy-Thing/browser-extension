import { useCallback, useEffect, useRef, useState } from "react";

import {
  DIAGNOSTIC_COMMANDS,
  type DiagnosticCommand,
  type RecognitionPreview,
  type RecognitionResponse,
  type RecognitionSummary,
} from "./recognition-setup";
import { featureText as t } from "./ui-feature-copy";

import { fireAndForget } from "@/shared/async";
import { SettingsControlCard } from "@/ui/components/SettingsControlCard";
import { Button } from "@/ui/components/ui/button";
import { sendMessageOrThrow } from "@/ui/shared/runtime-messaging";

const phaseLabel = (state: RecognitionSummary | null): string => {
  if (state?.phase === "ready") return t.ready;
  if (state?.phase === "stale" || state?.phase === "error") return t.stale;
  return t.notReady;
};

export const ControlDRecognitionPanel = () => {
  const [state, setState] = useState<RecognitionSummary | null>(null);
  const [preview, setPreview] = useState<RecognitionPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const run = useCallback(async (command: DiagnosticCommand) => {
    const current = ++sequence.current;
    setBusy(true);
    setError(null);
    try {
      const reply = await sendMessageOrThrow<RecognitionResponse>(command);
      if (current !== sequence.current) return;
      if (!reply || !reply.summary) return;
      setState(reply.summary);
      setPreview(reply.preview ?? null);
      setError(reply.ok ? null : (reply.error ?? reply.summary.lastError));
    } catch (failure) {
      if (current === sequence.current)
        setError(
          failure instanceof Error ? failure.message : "Control D lookup setup failed.",
        );
    } finally {
      if (current === sequence.current) setBusy(false);
    }
  }, []);
  useEffect(() => {
    fireAndForget(run({ type: DIAGNOSTIC_COMMANDS.getState }));
    return () => {
      sequence.current += 1;
    };
  }, [run]);
  return (
    <SettingsControlCard
      title={<h3 className="text-sm font-semibold">{t.recognitionTitle}</h3>}
      description={t.recognitionDescription}
      className="mt-5"
    >
      <section
        data-control-d-recognition={state?.phase ?? "loading"}
        aria-busy={busy}
        className="space-y-3"
      >
        <p className="text-sm font-medium" role="status">
          {phaseLabel(state)}
        </p>
        <p className="text-xs text-muted-foreground">{t.recognitionScope}</p>
        {preview ? (
          <dl data-control-d-recognition-preview className="grid grid-cols-3 gap-2">
            {[
              [t.profiles, preview.profileCreateCount],
              [t.endpoints, preview.endpointCreateCount],
              [t.services, preview.serviceCount],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {(error ?? state?.lastError) ? (
          <p
            role="alert"
            className="text-xs text-tone-error-text [overflow-wrap:anywhere]"
          >
            {error ?? state?.lastError}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-control-d-recognition-action="preview"
            disabled={busy}
            onClick={() => fireAndForget(run({ type: DIAGNOSTIC_COMMANDS.preview }))}
          >
            {busy ? t.working : t.preview}
          </Button>
          {preview ? (
            <Button
              type="button"
              size="sm"
              data-control-d-recognition-action="apply"
              disabled={busy}
              onClick={() =>
                fireAndForget(
                  run({ type: DIAGNOSTIC_COMMANDS.apply, previewToken: preview.token }),
                )
              }
            >
              {t.apply}
            </Button>
          ) : null}
        </div>
      </section>
    </SettingsControlCard>
  );
};
