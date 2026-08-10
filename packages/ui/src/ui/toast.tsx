import { useEffect, useRef, useState } from "react";
import { toast, Toaster as SonnerToaster } from "sonner";
import "sonner/dist/styles.css";

import { cn } from "../lib/utils";

import { TOAST_DATA_ATTRIBUTES } from "./toast-data-attributes";

export type ToastTone = "success" | "info" | "warning" | "error";

type NotifyOptions = {
  duration?: number;
  id?: string | number;
  description?: string;
  dismissible?: boolean;
};

type AppToastProps = {
  toastId: string | number;
  tone: ToastTone;
  message: string;
  description?: string;
  duration: number;
  dismissible: boolean;
};

const DEFAULT_DURATION_MS = 3600;
const ERROR_DURATION_MS = 5600;

const toneClasses: Record<ToastTone, string> = {
  success: "border-tone-success-border bg-card text-card-foreground",
  info: "border-tone-info-border bg-card text-card-foreground",
  warning: "border-tone-warning-border bg-card text-card-foreground",
  error: "border-tone-error-border bg-card text-card-foreground",
};

const toneAccentClasses: Record<ToastTone, string> = {
  success: "bg-tone-success-text",
  info: "bg-tone-info-text",
  warning: "bg-tone-warning-text",
  error: "bg-tone-error-text",
};

const toneProgressClasses: Record<ToastTone, string> = {
  success: "bg-tone-success-text/85",
  info: "bg-tone-info-text/85",
  warning: "bg-tone-warning-text/85",
  error: "bg-tone-error-text/85",
};

const resolveDuration = (tone: ToastTone, duration?: number): number =>
  duration ?? (tone === "error" ? ERROR_DURATION_MS : DEFAULT_DURATION_MS);

const CloseIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="h-3.5 w-3.5"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

export const AppToast = ({
  toastId,
  tone,
  message,
  description,
  duration,
  dismissible,
}: AppToastProps) => {
  const [paused, setPaused] = useState(false);
  const [remainingMs, setRemainingMs] = useState(duration);
  const remainingRef = useRef(duration);

  useEffect(() => {
    remainingRef.current = remainingMs;
  }, [remainingMs]);

  useEffect(() => {
    if (paused || duration <= 0) {
      return;
    }

    let animationFrame = 0;
    const initialRemaining = remainingRef.current;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const nextRemaining = Math.max(initialRemaining - (now - startedAt), 0);
      setRemainingMs(nextRemaining);

      if (nextRemaining > 0) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [paused, duration]);

  const progress =
    duration <= 0 ? 0 : Math.max(0, Math.min(100, (remainingMs / duration) * 100));
  const liveRole = tone === "error" || tone === "warning" ? "alert" : "status";
  const livePriority = tone === "error" || tone === "warning" ? "assertive" : "polite";

  return (
    <div
      {...{ [TOAST_DATA_ATTRIBUTES.toast]: "" }}
      data-tone={tone}
      data-paused={paused ? "true" : "false"}
      role={liveRole}
      aria-live={livePriority}
      aria-atomic="true"
      className={cn(
        "pointer-events-auto relative w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-2xl border shadow-[0_14px_38px_rgba(0,0,0,0.12)] backdrop-blur-sm",
        "dark:shadow-[0_16px_42px_rgba(0,0,0,0.38)]",
        toneClasses[tone],
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <span
          aria-hidden="true"
          className={cn(
            "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
            toneAccentClasses[tone],
          )}
        />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{message}</p>
          {description ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>

        {dismissible ? (
          <button
            type="button"
            aria-label="Dismiss notification"
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={() => toast.dismiss(toastId)}
          >
            <CloseIcon />
          </button>
        ) : null}
      </div>

      <div className="h-0.5 w-full bg-border/45">
        <div
          {...{ [TOAST_DATA_ATTRIBUTES.toastProgress]: "" }}
          className={cn(
            "h-full origin-left transition-none",
            toneProgressClasses[tone],
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

const showToast = (tone: ToastTone, message: string, options: NotifyOptions = {}) => {
  const toastId = options.id ?? crypto.randomUUID();
  const duration = resolveDuration(tone, options.duration);
  const dismissible = options.dismissible ?? true;

  toast.custom(
    () => (
      <AppToast
        toastId={toastId}
        tone={tone}
        message={message}
        duration={duration}
        dismissible={dismissible}
        {...(options.description ? { description: options.description } : {})}
      />
    ),
    {
      id: toastId,
      duration,
    },
  );

  return toastId;
};

export const notify = {
  success: (message: string, options?: NotifyOptions) =>
    showToast("success", message, options),
  info: (message: string, options?: NotifyOptions) =>
    showToast("info", message, options),
  warning: (message: string, options?: NotifyOptions) =>
    showToast("warning", message, options),
  error: (message: string, options?: NotifyOptions) =>
    showToast("error", message, options),
  dismiss: (toastId?: string | number) => toast.dismiss(toastId),
};

export const AppToaster = () => (
  <SonnerToaster
    position="top-right"
    expand={false}
    closeButton={false}
    visibleToasts={5}
    offset={16}
    gap={10}
    toastOptions={{
      unstyled: true,
    }}
  />
);
