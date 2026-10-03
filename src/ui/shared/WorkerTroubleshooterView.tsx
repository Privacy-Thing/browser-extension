import type { GetXRayStateResponse } from "@privacy-brand/xray-protocol";

import type { WorkerTestKind } from "@/shared/host-protection-pause";
import type { WorkerTestState } from "@/shared/worker-test";
import { Button } from "@/ui/components/ui/button";
import { t } from "@/ui/i18n";
import { WorkerTestReport } from "@/ui/shared/WorkerTestReport";

export type WorkerTestAction =
  WorkerTestKind | "helped" | "failed" | "cancel" | "save" | "reload";
type PanelProps = {
  data: WorkerTestState;
  pending: boolean;
  onAction: (action: WorkerTestAction) => void;
  now: number;
};
const ActiveTest = ({ data, pending, onAction, now }: PanelProps) => {
  const session = data.session;
  if (!session) return null;
  return (
    <section
      className="rounded-md border border-primary/40 bg-primary/5 p-3"
      aria-label={t.sidebar.troubleshooter.active}
    >
      <p className="font-semibold">
        {session.kind === "service-worker"
          ? t.sidebar.troubleshooter.kinds.serviceWorker
          : t.sidebar.troubleshooter.kinds.sharedWorker}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {session.kind === "service-worker"
          ? t.sidebar.troubleshooter.effects.serviceWorker
          : t.sidebar.troubleshooter.effects.sharedWorker}
      </p>
      <p className="mt-2 text-xs">
        {t.sidebar.troubleshooter.remaining(
          Math.max(0, Math.ceil((session.expiresAt - now) / 60_000)),
        )}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {t.sidebar.troubleshooter.returnHint}
      </p>
      {session.phase === "helped" ? (
        <p className="mt-2 text-xs">{t.sidebar.troubleshooter.helpedHint}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {session.phase === "testing" ? (
          <>
            <Button
              size="sm"
              disabled={pending || data.reloadRequired}
              data-worker-test-helped
              onClick={() => onAction("helped")}
            >
              {t.sidebar.troubleshooter.helped}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending || data.reloadRequired}
              data-worker-test-failed
              onClick={() => onAction("failed")}
            >
              {t.sidebar.troubleshooter.failed}
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            disabled={pending || data.reloadRequired || data.blocked !== null}
            data-worker-test-save
            onClick={() => onAction("save")}
          >
            {t.sidebar.troubleshooter.save}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          data-worker-test-cancel
          onClick={() => onAction("cancel")}
        >
          {t.sidebar.troubleshooter.restore}
        </Button>
      </div>
    </section>
  );
};
const CandidateTests = ({
  data,
  pending,
  onAction,
  phase,
}: PanelProps & { phase: string }) => {
  const session = data.session;
  return (
    <>
      {session ? (
        <p
          role="status"
          data-worker-test-result
          className="rounded-md border border-border p-3"
        >
          {getResultCopy(phase)}
        </p>
      ) : null}
      {!data.blocked && data.candidates.length === 0 ? (
        <p data-worker-test-empty>{t.sidebar.troubleshooter.noCandidates}</p>
      ) : null}
      {!data.blocked
        ? data.candidates.map((candidate) => (
            <section
              key={candidate.kind}
              data-worker-test-candidate={candidate.kind}
              data-worker-test-evidence={candidate.evidence}
              className="rounded-md border border-border p-3"
            >
              <h3 className="font-semibold">
                {candidate.kind === "service-worker"
                  ? t.sidebar.troubleshooter.kinds.serviceWorker
                  : t.sidebar.troubleshooter.kinds.sharedWorker}
              </h3>
              <p className="mt-2 text-xs text-muted-foreground">
                {getEvidenceCopy(candidate.evidence)}
              </p>
              <p className="mt-2 text-xs">
                {candidate.kind === "service-worker"
                  ? t.sidebar.troubleshooter.effects.serviceWorker
                  : t.sidebar.troubleshooter.effects.sharedWorker}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t.sidebar.troubleshooter.returnHint}
              </p>
              <Button
                size="sm"
                className="mt-3"
                disabled={pending}
                data-worker-test-start={candidate.kind}
                onClick={() => onAction(candidate.kind)}
              >
                {t.sidebar.troubleshooter.start}
              </Button>
            </section>
          ))
        : null}
    </>
  );
};
const getEvidenceCopy = (evidence: "observed" | "missing" | "stale") => {
  if (evidence === "observed") return t.sidebar.troubleshooter.evidence.observed;
  if (evidence === "stale") return t.sidebar.troubleshooter.evidence.stale;
  return t.sidebar.troubleshooter.evidence.missing;
};
const getResultCopy = (phase: string) => {
  if (phase === "saved") return t.sidebar.troubleshooter.results.saved;
  if (phase === "failed") return t.sidebar.troubleshooter.results.failed;
  if (phase === "expired") return t.sidebar.troubleshooter.results.expired;
  return t.sidebar.troubleshooter.results.cancelled;
};
const getBlockedCopy = (reason: NonNullable<WorkerTestState["blocked"]>) => {
  if (reason === "trusted") return t.sidebar.troubleshooter.blocked.trusted;
  if (reason === "pause") return t.sidebar.troubleshooter.blocked.pause;
  if (reason === "inactive") return t.sidebar.troubleshooter.blocked.inactive;
  if (reason === "reload") return t.sidebar.troubleshooter.blocked.reload;
  return t.sidebar.troubleshooter.blocked.unsupported;
};
const getPhase = (session: WorkerTestState["session"], now: number) => {
  if (!session) return "ready";
  if (["testing", "helped"].includes(session.phase) && now >= session.expiresAt)
    return "expired";
  return session.phase;
};
const getException = (data: WorkerTestState, active: boolean | null) => {
  if (data.blocked === "trusted") return t.sidebar.trustedSite;
  if (data.blocked === "pause") return t.popup.pauseActive;
  return active ? t.sidebar.troubleshooter.active : t.sidebar.troubleshooter.none;
};
export const WorkerTroubleshooterView = ({
  data,
  xray,
  pending,
  onAction,
  now,
}: {
  data: WorkerTestState;
  xray: GetXRayStateResponse | null;
  pending: boolean;
  onAction: (action: WorkerTestAction) => void;
  now: number;
}) => {
  const session = data.session;
  const active =
    session &&
    (session.phase === "testing" || session.phase === "helped") &&
    now < session.expiresAt;
  const phase = getPhase(session, now);
  const state = xray?.ok ? xray : null;
  return (
    <div
      className="flex min-w-0 flex-col gap-3 text-sm"
      data-worker-test-phase={phase}
      aria-busy={pending}
    >
      <div className="rounded-md border border-border bg-muted/30 p-3">
        <p className="font-mono font-semibold break-all">
          {session?.hostname ?? state?.hostname}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t.sidebar.troubleshooter.rule}:{" "}
          {state?.rulePattern ??
            state?.explanation?.winningSource ??
            t.sidebar.troubleshooter.unknown}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t.sidebar.troubleshooter.exceptions}: {getException(data, Boolean(active))}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">{t.sidebar.troubleshooter.scope}</p>
      <p className="text-xs text-muted-foreground">{t.sidebar.troubleshooter.webrtc}</p>
      {data.blocked ? (
        <p
          role="status"
          className="rounded-md border border-border p-3"
          data-worker-test-blocked={data.blocked}
        >
          {getBlockedCopy(data.blocked)}
        </p>
      ) : null}
      {data.reloadRequired ? (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          data-worker-test-reload
          onClick={() => onAction("reload")}
        >
          {t.popup.pauseResumeReload}
        </Button>
      ) : null}
      {active ? (
        <ActiveTest data={data} pending={pending} onAction={onAction} now={now} />
      ) : (
        <CandidateTests
          data={data}
          pending={pending}
          onAction={onAction}
          now={now}
          phase={phase}
        />
      )}
      <p className="text-xs text-muted-foreground">
        {t.sidebar.troubleshooter.siteEffects}
      </p>
      {session ? <WorkerTestReport session={session} /> : null}
    </div>
  );
};
