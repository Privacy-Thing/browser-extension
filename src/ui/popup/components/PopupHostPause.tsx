import * as Popover from "@radix-ui/react-popover";
import { useEffect, useId, useState } from "react";
import type { ReactNode } from "react";

import {
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  PauseIcon,
  ResumeIcon,
} from "./PopupIcons";

import type { HostPauseStatus } from "@/shared/host-protection-pause";
import { t } from "@/ui/i18n";

type Props = {
  hostname: string;
  status: HostPauseStatus | undefined;
  disabled: boolean;
  pending: boolean;
  onPause: (duration: "ten-minutes" | "session" | "resume") => void;
  onExpired: () => void;
};

const getPauseView = (status: HostPauseStatus | undefined, now: number) => {
  const pause = status?.pause;
  const expiresAt = pause?.expiresAt;
  const active = Boolean(
    pause && (expiresAt === null || (expiresAt !== undefined && now < expiresAt)),
  );
  const reloadRequired = status?.reloadRequired === true || Boolean(pause && !active);
  let label: string = t.popup.pauseProtection;
  let countdown: string | undefined;
  let phase = "none";
  if (reloadRequired) {
    label = t.popup.pauseReloadRequired;
    phase = "reload-required";
  }
  if (active && !reloadRequired) {
    phase = "active";
    label = t.popup.pauseSessionActive;
    if (expiresAt !== null && expiresAt !== undefined) {
      const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1_000));
      countdown = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
      label = t.popup.pauseCountdown(countdown);
    }
  }
  return { active, reloadRequired, label, phase, countdown };
};

type OptionProps = {
  id: string;
  label: string;
  hint: string;
  icon: ReactNode;
  disabled: boolean;
  resume?: boolean;
  onClick: () => void;
};

const PauseOption = ({
  id,
  label,
  hint,
  icon,
  disabled,
  resume,
  onClick,
}: OptionProps) => (
  <button
    type="button"
    id={id}
    className="gw-popup-pause-option"
    data-action={resume ? "resume" : undefined}
    disabled={disabled}
    onClick={onClick}
  >
    <span className="gw-popup-pause-option-icon" aria-hidden="true">
      {icon}
    </span>
    <span className="gw-popup-pause-copy">
      <span className="gw-popup-pause-label">{label}</span>
      <span className="gw-popup-pause-caption">{hint}</span>
    </span>
    <ChevronRightIcon className="gw-popup-pause-chevron" aria-hidden="true" />
  </button>
);

const PauseMenuHeader = ({
  hostname,
  titleId,
}: {
  hostname: string;
  titleId: string;
}) => (
  <div className="gw-popup-pause-header">
    <span className="gw-popup-pause-symbol" aria-hidden="true">
      <PauseIcon />
    </span>
    <div className="gw-popup-pause-copy">
      <h2 id={titleId} className="gw-popup-pause-title">
        {t.popup.pauseProtection}
      </h2>
      <span className="gw-popup-pause-host" title={hostname}>
        {hostname}
      </span>
    </div>
    <Popover.Close className="gw-popup-pause-close" aria-label={t.common.actions.close}>
      <CloseIcon aria-hidden="true" />
    </Popover.Close>
  </div>
);

const usePauseClock = (expiresAt: number | null | undefined, onExpired: () => void) => {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    if (expiresAt === null || expiresAt === undefined) return;
    const timer = window.setInterval(() => {
      const next = Date.now();
      setNow(next);
      if (next >= expiresAt) {
        window.clearInterval(timer);
        onExpired();
      }
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [expiresAt, onExpired]);
  return now;
};

const getTriggerHint = (
  active: boolean,
  reloadRequired: boolean,
  countdown: string | undefined,
) => {
  if (active) return countdown ? t.popup.pauseTimedHint : t.popup.pauseSessionActive;
  if (reloadRequired) return t.popup.pauseResumeHint;
  return undefined;
};

export const PopupHostPause = ({
  hostname,
  status,
  disabled,
  pending,
  onPause,
  onExpired,
}: Props) => {
  const titleId = useId();
  const now = usePauseClock(status?.pause?.expiresAt, onExpired);
  const { active, reloadRequired, label, phase, countdown } = getPauseView(status, now);
  const triggerTitle = active ? t.popup.pauseManage : label;
  const triggerHint = getTriggerHint(active, reloadRequired, countdown);
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          id="host-protection-pause"
          className="gw-popup-pause-trigger"
          disabled={pending || (disabled && !active && !reloadRequired)}
          data-pause-state={phase}
          aria-label={active ? `${triggerTitle}. ${label}` : label}
        >
          <span className="gw-popup-pause-symbol" aria-hidden="true">
            {reloadRequired && !active ? <ResumeIcon /> : <PauseIcon />}
          </span>
          <span className="gw-popup-pause-copy">
            <span className="gw-popup-pause-label">{triggerTitle}</span>
            {triggerHint ? (
              <span className="gw-popup-pause-caption">{triggerHint}</span>
            ) : null}
          </span>
          {countdown ? (
            <span className="gw-popup-pause-countdown" aria-hidden="true">
              {countdown}
            </span>
          ) : null}
          <ChevronRightIcon className="gw-popup-pause-chevron" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="gw-popup-pause-popover"
          data-pause-state={phase}
          side="top"
          sideOffset={8}
          collisionPadding={12}
          aria-labelledby={titleId}
        >
          <PauseMenuHeader hostname={hostname} titleId={titleId} />
          {reloadRequired ? (
            <p className="gw-popup-pause-notice" role="status">
              {active ? t.popup.pauseStartReloadRequired : t.popup.pauseExpiredSummary}
            </p>
          ) : null}
          <div className="gw-popup-pause-actions">
            {active || reloadRequired ? (
              <PauseOption
                id="resume-host-protection"
                resume
                label={t.popup.pauseResumeReload}
                hint={t.popup.pauseResumeHint}
                icon={<ResumeIcon />}
                disabled={pending}
                onClick={() => onPause("resume")}
              />
            ) : null}
            {!disabled ? (
              <>
                <PauseOption
                  id="pause-host-ten-minutes"
                  label={t.popup.pauseTenMinutes}
                  hint={t.popup.pauseAutoResume}
                  icon={<ClockIcon />}
                  disabled={pending}
                  onClick={() => onPause("ten-minutes")}
                />
                <PauseOption
                  id="pause-host-session"
                  label={t.popup.pauseUntilSessionEnd}
                  hint={t.popup.pauseSessionOptionHint}
                  icon={<PauseIcon />}
                  disabled={pending}
                  onClick={() => onPause("session")}
                />
              </>
            ) : null}
          </div>
          <p className="gw-popup-pause-reload-note">{t.popup.pauseReloadNotice}</p>
          <details className="gw-popup-pause-details">
            <summary>{t.popup.pauseDetails}</summary>
            <div>
              <p>{t.popup.pauseScope(hostname)}</p>
              <p>{t.popup.pauseReloadHint}</p>
              <p>{t.popup.pauseLimits}</p>
              <p>{t.popup.pauseSessionHint}</p>
            </div>
          </details>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
