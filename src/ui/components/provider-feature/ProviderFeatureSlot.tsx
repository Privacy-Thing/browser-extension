import { useId, useState } from "react";

import type {
  JoinInfo,
  ProviderFeature,
  ProviderFeatureVariant,
  SlotModel,
} from "./model";
import type { ProviderFeatureMessages } from "./provider-feature-copy";
import { ProviderDecoratorBadge } from "./ProviderDecoratorBadge";
import { ProviderFeatureMenu } from "./ProviderFeatureMenu";

import { cn } from "@/ui/components/lib/utils";
import { Button } from "@/ui/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/components/ui/popover";

export type RequestPending = "status" | "lookup" | "preparing";

export type ProviderFeatureSlotProps = {
  variant?: ProviderFeatureVariant;
  model: SlotModel;
  copy: ProviderFeatureMessages;
  features: readonly ProviderFeature[];
  sharedHosts?: readonly string[];
  removing: boolean;
  groupRemoval?: boolean;
  removalService?: string;
  pending?: RequestPending;
  notice?: string | null;
  joinFor: (featureId: string) => JoinInfo | null;
  onAccept: () => void;
  onDecline: () => void;
  onJoin: () => void;
  onChoose: (feature: ProviderFeature) => void;
  onDetach: () => void;
  onClear: () => void;
};

const ChevronDown = () => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    data-provider-feature-chevron
    className="size-3 shrink-0 text-muted-foreground"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const pendingLabel = (kind: RequestPending, copy: ProviderFeatureMessages): string => {
  if (kind === "preparing") return copy.preparing;
  if (kind === "lookup") return copy.checking;
  return copy.checkingStatus;
};

export const ProviderFeaturePending = ({
  kind,
  copy,
  providerName,
}: {
  kind: RequestPending;
  copy: ProviderFeatureMessages;
  providerName?: string;
}) => {
  const label = pendingLabel(kind, copy);
  const accessible =
    kind === "lookup" && providerName ? copy.checkingLabel(providerName) : label;
  return (
    <span
      data-provider-request-pending={kind}
      role="status"
      aria-label={accessible}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
    >
      <span
        aria-hidden="true"
        className="inline-block size-3 shrink-0 animate-spin rounded-full border border-border border-t-foreground"
      />
      {label}
    </span>
  );
};

const keepMenuOpen = (event: {
  target: EventTarget | null;
  preventDefault: () => void;
}) => {
  const target = event.target;
  if (target instanceof Element && target.closest("[data-slot='popover-content']")) {
    event.preventDefault();
  }
};

const SuggestionRow = ({
  model,
  copy,
  question,
  confirm,
  action,
  onConfirm,
  onDecline,
  note,
}: {
  model: SlotModel;
  copy: ProviderFeatureMessages;
  question: string;
  confirm: string;
  action: "accept" | "join";
  onConfirm: () => void;
  onDecline: () => void;
  note: string;
}) => {
  const noteId = useId();
  const decorator = model.decorator;
  if (!decorator) return null;
  return (
    <div className="space-y-1">
      <div className="space-y-1">
        <ProviderDecoratorBadge decorator={decorator} label={question} wrap />
        <span className="flex gap-1.5 pl-[30px]">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            data-provider-feature-action={action}
            aria-describedby={noteId}
            onClick={onConfirm}
          >
            {confirm}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            data-provider-feature-action="decline"
            onClick={onDecline}
          >
            {copy.no}
          </Button>
        </span>
      </div>
      <p
        id={noteId}
        data-provider-feature-scope
        className="text-xs text-muted-foreground"
      >
        {note}
      </p>
    </div>
  );
};

const FeatureChip = ({
  props,
  label,
  mode,
}: {
  props: ProviderFeatureSlotProps;
  label: string;
  mode: "linked" | "staged" | "manual";
}) => {
  const { model, copy } = props;
  const decorator = model.decorator;
  const [open, setOpen] = useState(false);
  if (!decorator) return null;
  const serviceLabel = decorator.label;
  const menuLabel =
    mode === "manual"
      ? copy.pickerLabel(decorator.providerName)
      : copy.menuHeader(serviceLabel, decorator.providerName);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-provider-feature-action="open"
          data-provider-feature-chip={mode}
          aria-label={copy.chipLabel(
            mode === "linked" && model.groupSize > 1
              ? `${label}, ${copy.siteCount(model.groupSize)}`
              : label,
            decorator.providerName,
          )}
          className={cn(
            "inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-transparent px-2 py-0.5 text-left hover:bg-accent",
            mode === "staged" && "border-dashed",
          )}
        >
          <ProviderDecoratorBadge
            decorator={decorator}
            label={label}
            {...(mode === "linked" ? { groupSize: model.groupSize } : {})}
          />
          <ChevronDown />
        </button>
      </PopoverTrigger>
      <PopoverContent
        aria-label={menuLabel}
        className="w-[17rem] p-3"
        onInteractOutside={keepMenuOpen}
        onFocusOutside={keepMenuOpen}
      >
        {open ? (
          <ProviderFeatureMenu
            copy={copy}
            providerName={decorator.providerName}
            serviceLabel={serviceLabel}
            sharedHosts={props.sharedHosts ?? []}
            features={props.features}
            mode={mode}
            joinFor={props.joinFor}
            onChoose={props.onChoose}
            onDetach={props.onDetach}
            onClear={props.onClear}
            onDone={() => setOpen(false)}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  );
};

const SlotBody = (props: ProviderFeatureSlotProps) => {
  const { model, copy } = props;
  const decorator = model.decorator;
  if (model.view === "suggest" && decorator) {
    return (
      <SuggestionRow
        model={model}
        copy={copy}
        question={copy.suggestQuestion(decorator.label)}
        confirm={copy.yes}
        action="accept"
        onConfirm={props.onAccept}
        onDecline={props.onDecline}
        note={copy.scope(decorator.providerName, decorator.label)}
      />
    );
  }
  if (model.view === "join" && decorator && model.join) {
    const joinNote = `${copy.joinHint(model.join.pattern, model.join.extra)} ${copy.joinReplaces}`;
    return (
      <SuggestionRow
        model={model}
        copy={copy}
        question={copy.joinQuestion(decorator.label)}
        confirm={copy.yes}
        action="join"
        onConfirm={props.onJoin}
        onDecline={props.onDecline}
        note={joinNote}
      />
    );
  }
  if (model.view === "checking" && decorator) {
    return (
      <ProviderFeaturePending
        kind="lookup"
        copy={copy}
        providerName={decorator.providerName}
      />
    );
  }
  if (model.view === "linked") {
    return <FeatureChip props={props} label={decorator?.label ?? ""} mode="linked" />;
  }
  if (model.view === "staged" && decorator) {
    return (
      <FeatureChip
        props={props}
        label={copy.stagedLabel(decorator.label)}
        mode="staged"
      />
    );
  }
  if (model.view === "manual") {
    return <FeatureChip props={props} label={copy.addService} mode="manual" />;
  }
  return null;
};

const stagedJoinLine = (model: SlotModel, copy: ProviderFeatureMessages): string => {
  if (model.view !== "staged" || !model.join) return "";
  const hint = model.join.pattern
    ? copy.joinHint(model.join.pattern, model.join.extra)
    : "";
  return [hint, copy.joinReplaces].filter((line) => line.length > 0).join(" ");
};

const SlotNotes = (props: ProviderFeatureSlotProps) => {
  const { model, copy } = props;
  const service = props.removalService ?? model.decorator?.label ?? "";
  const removal = props.groupRemoval
    ? copy.pendingRemovalGroup(service)
    : copy.pendingRemoval(service);
  const joinLine = stagedJoinLine(model, copy);
  const providerName = model.decorator?.providerName;
  const pendingProps = props.pending
    ? {
        kind: props.pending,
        copy,
        ...(providerName ? { providerName } : {}),
      }
    : null;
  const showPending = pendingProps !== null && model.view !== "checking";
  return (
    <>
      {showPending && pendingProps ? (
        <ProviderFeaturePending {...pendingProps} />
      ) : null}
      {joinLine ? (
        <p data-provider-feature-join className="text-xs text-muted-foreground">
          {joinLine}
        </p>
      ) : null}
      {props.removing ? (
        <p data-provider-feature-pending className="text-xs text-muted-foreground">
          {removal}
        </p>
      ) : null}
      {props.notice ? (
        <p data-provider-feature-error className="text-xs text-tone-warning-text">
          {props.notice}
        </p>
      ) : null}
    </>
  );
};

export const ProviderFeatureSlot = (props: ProviderFeatureSlotProps) => {
  const { model, variant = "default" } = props;
  if (model.view === "hidden") return null;
  return (
    <div
      data-provider-feature
      data-provider-feature-state={model.view}
      data-provider-feature-variant={variant}
      data-provider-feature-provider={model.decorator?.providerId ?? ""}
      {...(model.view === "linked"
        ? { "data-provider-feature-group-size": model.groupSize }
        : {})}
      aria-busy={props.pending || model.view === "checking" ? true : undefined}
      className={cn("min-w-0", variant === "compact" ? "space-y-1" : "space-y-1.5")}
    >
      <SlotBody {...props} />
      <SlotNotes {...props} />
    </div>
  );
};
