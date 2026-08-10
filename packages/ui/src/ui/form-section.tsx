import { useLayoutEffect, useRef, useState } from "react";

import { cn } from "../lib/utils";

import { Separator } from "./separator";

type FormSectionProps = {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initiallyHiddenLabel?: string;
  showCollapsedStateLabel?: boolean;
  variant?: "plain" | "card";
  className?: string;
  contentClassName?: string;
  titleClassName?: string;
  activeTitleClassName?: string;
};

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("transition-transform duration-200", open && "rotate-180")}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const useContentHeight = (children: React.ReactNode) => {
  const [contentHeight, setContentHeight] = useState(0);
  const contentInnerRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const contentElement = contentInnerRef.current;
    if (!contentElement) return;
    const syncHeight = () => setContentHeight(contentElement.scrollHeight);
    syncHeight();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(syncHeight);
    observer.observe(contentElement);
    return () => observer.disconnect();
  }, [children]);
  return { contentHeight, contentInnerRef };
};

export const FormSection = ({
  title,
  description,
  children,
  collapsible = true,
  defaultOpen = true,
  open,
  onOpenChange,
  initiallyHiddenLabel = "Show section",
  showCollapsedStateLabel = true,
  variant = "card",
  className,
  contentClassName,
  titleClassName,
  activeTitleClassName,
}: FormSectionProps) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isOpen = collapsible ? (open ?? uncontrolledOpen) : true;
  const { contentHeight, contentInnerRef } = useContentHeight(children);

  const setSectionOpen = (nextOpen: boolean) => {
    if (open === undefined) {
      setUncontrolledOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  };

  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <Separator className="bg-border/80" />
      {collapsible ? (
        <button
          type="button"
          data-form-section-title={title}
          className="group flex w-full items-start justify-between gap-3 rounded-md text-left transition-colors hover:text-foreground"
          onClick={() => setSectionOpen(!isOpen)}
          aria-expanded={isOpen}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4
                className={cn(
                  "text-sm font-semibold",
                  titleClassName,
                  isOpen && activeTitleClassName,
                )}
              >
                {title}
              </h4>
              {!isOpen && showCollapsedStateLabel ? (
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-foreground">
                  {initiallyHiddenLabel}
                </span>
              ) : null}
            </div>
            {description ? (
              <p className="mt-1 max-w-[42ch] text-xs leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          <span className="mt-0.5 text-muted-foreground transition-colors group-hover:text-foreground/80">
            <Chevron open={isOpen} />
          </span>
        </button>
      ) : (
        <div>
          <h4 className={cn("text-sm font-semibold", titleClassName)}>{title}</h4>
          {description ? (
            <p className="mt-1 max-w-[42ch] text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      )}

      <div
        className={cn(
          "transition-[max-height,opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transform-none motion-reduce:transition-none",
          isOpen
            ? "max-h-[var(--form-section-content-height)] overflow-x-visible overflow-y-clip opacity-100 translate-y-0"
            : "pointer-events-none max-h-0 opacity-0 -translate-y-1",
          !isOpen && "overflow-hidden",
        )}
        style={
          {
            "--form-section-content-height": `${Math.max(contentHeight, 1)}px`,
          } as React.CSSProperties
        }
      >
        <div ref={contentInnerRef} aria-hidden={!isOpen} inert={!isOpen}>
          <div
            className={cn(
              variant === "card"
                ? "rounded-xl border border-border/70 bg-card/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
                : "pt-4 pb-8",
              contentClassName,
            )}
          >
            <div className="flex flex-col gap-4">{children}</div>
          </div>
        </div>
      </div>
    </section>
  );
};
