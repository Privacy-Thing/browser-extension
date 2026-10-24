import { useState } from "react";

import { cleanupText as t } from "./cleanup-copy";
import {
  CONTROL_D_COMMANDS,
  type CleanupPlan,
  type CleanupReason,
  type CleanupReport,
  type CleanupResource,
  type CleanupResponse,
  type ControlDPublicState,
} from "./contracts";

import { Button } from "@/ui/components/ui/button";
import { Checkbox } from "@/ui/components/ui/checkbox";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog";

const reasonText = (reason: CleanupReason | null): string | null => {
  if (!reason) return null;
  return {
    "name-changed": t.nameChanged,
    "content-changed": t.contentChanged,
    "not-recorded": t.notRecorded,
    "contains-preserved": t.containsPreserved,
    "shared-profile": t.sharedProfile,
    "already-deleted": t.alreadyDeleted,
    "dependency-failed": t.dependencyFailed,
  }[reason];
};

const ResourceRow = ({
  item,
  status,
  reason,
  failed,
  retained,
}: {
  item: CleanupResource;
  status: string;
  reason: CleanupReason | null;
  failed: boolean;
  retained: boolean;
}) => (
  <li
    className="space-y-1 border-b border-border py-2 last:border-0"
    data-cleanup-resource={item.key}
    data-cleanup-retained={retained}
  >
    <p
      className={`break-words text-sm font-medium ${retained ? "text-muted-foreground" : ""}`}
    >
      {t[item.kind]}: {item.name} <span className="font-normal">({item.id})</span>
    </p>
    <p className="text-xs text-muted-foreground">
      {status}
      {reason ? ` · ${reasonText(reason)}` : ""}
    </p>
    {failed ? <p className="text-xs text-tone-error-text">{t.failedRequest}</p> : null}
    {item.ruleHostnames.length > 0 ? (
      <ul className="list-inside list-disc break-words text-xs text-muted-foreground">
        {item.ruleHostnames.map((host) => (
          <li key={host}>
            {t.rule}: {host}
          </li>
        ))}
      </ul>
    ) : null}
  </li>
);

export type CleanupDialogProps = {
  phase: "choice" | "plan" | "result";
  plan: CleanupPlan | null;
  report: CleanupReport | null;
  busy: boolean;
  error: string | null;
  close: () => void;
  disconnect: () => void;
  review: () => void;
  execute: () => void;
};

const ChoicePanel = ({
  choice,
  setChoice,
  busy,
}: {
  choice: "keep" | "delete";
  setChoice: (choice: "keep" | "delete") => void;
  busy: boolean;
}) => (
  <fieldset className="space-y-3" disabled={busy}>
    <legend className="sr-only">{t.title}</legend>
    {(["keep", "delete"] as const).map((value) => (
      <label
        key={value}
        className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm"
      >
        <input
          type="radio"
          name="cleanup-choice"
          value={value}
          checked={choice === value}
          onChange={() => setChoice(value)}
          className="mt-1 shrink-0"
        />
        <span>{value === "keep" ? t.keepChoice : t.deleteChoice}</span>
      </label>
    ))}
  </fieldset>
);

const PlanList = ({ plan }: { plan: CleanupPlan }) => (
  <ul
    tabIndex={0}
    aria-label={t.planTitle}
    data-cleanup-plan
    className="min-h-32 flex-auto overflow-y-auto"
  >
    {plan.resources.map((item) => (
      <ResourceRow
        key={item.key}
        item={item}
        status={item.disposition === "delete" ? t.deleteLabel : t.skipped}
        reason={item.reason}
        failed={false}
        retained={item.disposition !== "delete"}
      />
    ))}
  </ul>
);

const PlanPanel = ({
  plan,
  dns,
  setDns,
  busy,
}: {
  plan: CleanupPlan;
  dns: "unchanged" | "changed";
  setDns: (dns: "unchanged" | "changed") => void;
  busy: boolean;
}) => (
  <>
    <PlanList plan={plan} />
    {plan.resources.length === 0 ? <p className="text-sm">{t.empty}</p> : null}
    <p className="rounded-lg border border-tone-warning-border bg-tone-warning-bg p-3 text-sm text-tone-warning-text">
      {t.dnsWarning}
    </p>
    <label className="flex items-start gap-3 text-sm">
      <Checkbox
        data-cleanup-dns
        checked={dns === "changed"}
        disabled={busy}
        onChange={(event) => setDns(event.target.checked ? "changed" : "unchanged")}
      />
      <span>{t.dnsConfirmed}</span>
    </label>
  </>
);

const ResultPanel = ({
  report,
  busy,
  disconnect,
}: {
  report: CleanupReport;
  busy: boolean;
  disconnect: () => void;
}) => (
  <>
    <p data-cleanup-counts className="text-sm font-medium">
      {t.deleted}: {report.results.filter((item) => item.status === "deleted").length} ·{" "}
      {t.skipped}: {report.results.filter((item) => item.status === "skipped").length} ·{" "}
      {t.failed}: {report.results.filter((item) => item.status === "failed").length}
    </p>
    <ul
      tabIndex={0}
      aria-label={t.resultTitle}
      data-cleanup-results
      className="min-h-32 flex-auto overflow-y-auto"
    >
      {report.results.map((item) => (
        <ResourceRow
          key={item.resource.key}
          item={item.resource}
          status={t[item.status]}
          reason={item.reason}
          failed={item.status === "failed" && item.message !== null}
          retained={item.status === "skipped"}
        />
      ))}
    </ul>
    {report.retryAvailable ? (
      <Button
        className="h-auto min-h-9 whitespace-normal"
        variant="outline"
        disabled={busy}
        onClick={disconnect}
      >
        {t.forgetKey}
      </Button>
    ) : null}
  </>
);

const ChoiceAction = ({
  choice,
  busy,
  disconnect,
  review,
}: {
  choice: "keep" | "delete";
  busy: boolean;
  disconnect: () => void;
  review: () => void;
}) => {
  const label = choice === "keep" ? t.keepChoice : t.review;
  return (
    <Button
      className="h-auto min-h-9 whitespace-normal"
      disabled={busy}
      onClick={choice === "keep" ? disconnect : review}
      data-cleanup-choice-confirm
    >
      {busy ? t.working : label}
    </Button>
  );
};

const DialogActions = ({
  phase,
  choice,
  dns,
  error,
  busy,
  report,
  close,
  disconnect,
  review,
  execute,
}: CleanupDialogProps & {
  choice: "keep" | "delete";
  dns: "unchanged" | "changed";
}) => {
  const deletionDisabled = busy || dns !== "changed" || error !== null;
  const showRetry = phase === "result" && report?.retryAvailable;
  const buttonClass = "h-auto min-h-9 whitespace-normal";
  return (
    <DialogFooter className="flex-wrap gap-2 sm:space-x-0">
      <Button
        className={buttonClass}
        variant="secondary"
        disabled={busy}
        onClick={close}
      >
        {phase === "result" ? t.close : t.cancel}
      </Button>
      {phase === "choice" ? (
        <ChoiceAction
          choice={choice}
          busy={busy}
          disconnect={disconnect}
          review={review}
        />
      ) : null}
      {phase === "plan" ? (
        <>
          {error ? (
            <Button
              className={buttonClass}
              variant="outline"
              disabled={busy}
              onClick={review}
            >
              {t.review}
            </Button>
          ) : null}
          <Button
            className={buttonClass}
            variant="destructive"
            disabled={deletionDisabled}
            onClick={execute}
            data-cleanup-confirm
          >
            {busy ? t.working : t.confirm}
          </Button>
        </>
      ) : null}
      {showRetry ? (
        <Button
          className={buttonClass}
          disabled={busy}
          onClick={review}
          data-cleanup-retry
        >
          {busy ? t.working : t.retry}
        </Button>
      ) : null}
    </DialogFooter>
  );
};

export const CleanupDialogView = (props: CleanupDialogProps) => {
  const { phase, plan, report, busy, error, close, review } = props;
  const [choice, setChoice] = useState<"keep" | "delete">("keep");
  const [dns, setDns] = useState<"unchanged" | "changed">("unchanged");
  const reviewAgain = () => {
    setDns("unchanged");
    review();
  };
  const title = { choice: t.title, plan: t.planTitle, result: t.resultTitle }[phase];
  const resultDescription = report?.retryAvailable ? t.retainedKey : t.finished;
  const description = {
    choice: t.keepDescription,
    plan: t.planDescription,
    result: resultDescription,
  }[phase];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <DialogContent
        className="flex max-h-[90dvh] max-w-xl flex-col overflow-y-auto"
        data-control-d-cleanup={phase}
        aria-busy={busy}
      >
        {!busy ? <DialogCloseButton label={t.close} /> : null}
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {phase === "choice" ? (
          <ChoicePanel choice={choice} setChoice={setChoice} busy={busy} />
        ) : null}
        {phase === "plan" && plan ? (
          <PlanPanel plan={plan} dns={dns} setDns={setDns} busy={busy} />
        ) : null}
        {phase === "result" && report ? (
          <ResultPanel report={report} busy={busy} disconnect={props.disconnect} />
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-tone-error-text">
            {error}
          </p>
        ) : null}
        <DialogActions {...props} choice={choice} dns={dns} review={reviewAgain} />
      </DialogContent>
    </Dialog>
  );
};

type SessionProps = {
  close: () => void;
  disconnect: () => void;
  onState: (state: ControlDPublicState) => void;
};
const CleanupDialogSession = ({ close, disconnect, onState }: SessionProps) => {
  const [phase, setPhase] = useState<CleanupDialogProps["phase"]>("choice");
  const [plan, setPlan] = useState<CleanupPlan | null>(null);
  const [report, setReport] = useState<CleanupReport | null>(null);
  const [activity, setActivity] = useState<"idle" | "busy">("idle");
  const [error, setError] = useState<string | null>(null);
  const request = async (execute: boolean) => {
    setActivity("busy");
    setError(null);
    try {
      const response = (await chrome.runtime.sendMessage(
        execute
          ? { type: CONTROL_D_COMMANDS.executeCleanup, cleanupToken: plan?.token }
          : { type: CONTROL_D_COMMANDS.planCleanup },
      )) as CleanupResponse;
      if (!response.ok) {
        setError(t.failedRequest);
        return;
      }
      if (response.plan) {
        setPlan(response.plan);
        setPhase("plan");
      }
      if (response.report) {
        setReport(response.report);
        setPhase("result");
        onState(response.state);
      }
    } catch {
      setError(t.failedRequest);
    } finally {
      setActivity("idle");
    }
  };
  return (
    <CleanupDialogView
      phase={phase}
      plan={plan}
      report={report}
      busy={activity === "busy"}
      error={error}
      close={close}
      disconnect={disconnect}
      review={() => void request(false)}
      execute={() => void request(true)}
    />
  );
};

export const ControlDDisconnectDialog = ({
  open,
  ...props
}: SessionProps & { open: boolean }) =>
  open ? <CleanupDialogSession {...props} /> : null;

export const CleanupRetryButton = ({
  state,
  onClick,
}: {
  state: ControlDPublicState | null;
  onClick: () => void;
}) =>
  state?.hasApiKey && !state.connected ? (
    <Button variant="outline" onClick={onClick}>
      {t.keepChoice}
    </Button>
  ) : null;
