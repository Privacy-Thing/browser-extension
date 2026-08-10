import { useEffect, useLayoutEffect, useRef } from "react";

import { cn } from "../lib/utils";

import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";

export type FormDialogCloseReason =
  "close-button" | "escape-key" | "pointer-down-outside" | "open-change";

const RESIZE_DURATION_MS = 180;
const RESIZE_MIN_DELTA_PX = 8;
const OPEN_COMBOBOX_SELECTOR = '[role="combobox"][aria-expanded="true"][aria-controls]';

const useOpenComboboxAtDown = (
  open: boolean,
  dialogContentRef: React.RefObject<HTMLDivElement | null>,
) => {
  const openComboboxAtDownRef = useRef(false);

  useEffect(() => {
    if (!open) {
      openComboboxAtDownRef.current = false;
      return;
    }

    const ownerDocument = dialogContentRef.current?.ownerDocument ?? document;
    const captureExpandedCombobox = () => {
      openComboboxAtDownRef.current = Boolean(
        dialogContentRef.current?.querySelector(OPEN_COMBOBOX_SELECTOR),
      );
    };

    ownerDocument.addEventListener("pointerdown", captureExpandedCombobox, true);
    return () => {
      ownerDocument.removeEventListener("pointerdown", captureExpandedCombobox, true);
      openComboboxAtDownRef.current = false;
    };
  }, [dialogContentRef, open]);

  return openComboboxAtDownRef;
};

const useDialogResize = (
  open: boolean,
  dialogContentRef: React.RefObject<HTMLDivElement | null>,
  shellRef: React.RefObject<HTMLDivElement | null>,
): void => {
  const animationRef = useRef<Animation | null>(null);
  const frameRef = useRef<number | null>(null);
  const heightRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    const dialog = dialogContentRef.current;
    const shell = shellRef.current;
    const reset = () => {
      animationRef.current?.cancel();
      animationRef.current = null;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      if (dialog) dialog.style.height = "";
      heightRef.current = null;
    };
    if (!open || !dialog || !shell) {
      reset();
      return;
    }
    heightRef.current = shell.offsetHeight;
    const animateHeight = (nextHeight: number) => {
      const previousHeight = heightRef.current;
      heightRef.current = nextHeight;
      if (
        previousHeight === null ||
        document.documentElement.hasAttribute("data-reduce-motion") ||
        Math.abs(nextHeight - previousHeight) < RESIZE_MIN_DELTA_PX
      ) {
        dialog.style.height = "";
        return;
      }
      const fromHeight = dialog.offsetHeight || previousHeight;
      if (Math.abs(nextHeight - fromHeight) < RESIZE_MIN_DELTA_PX) {
        dialog.style.height = "";
        return;
      }
      animationRef.current?.cancel();
      dialog.style.height = `${fromHeight}px`;
      const animation = dialog.animate(
        { height: [`${fromHeight}px`, `${nextHeight}px`] },
        { duration: RESIZE_DURATION_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
      animationRef.current = animation;
      animation.finished
        .catch(() => undefined)
        .finally(() => {
          if (animationRef.current !== animation) return;
          dialog.style.height = "";
          animationRef.current = null;
        });
    };
    const scheduleMeasure = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        animateHeight(shell.offsetHeight);
      });
    };
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(shell);
    return () => {
      observer.disconnect();
      reset();
    };
  }, [dialogContentRef, open, shellRef]);
};

type FormDialogShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  closeLabel: string;
  children: React.ReactNode;
  id?: string;
  busy?: boolean;
  preventCloseWhenBusy?: boolean;
  onRequestClose?: (reason: FormDialogCloseReason) => void;
  contentClassName?: string;
  contentStyle?: React.CSSProperties;
  headerClassName?: string;
  headerProps?: React.HTMLAttributes<HTMLDivElement> & {
    [key: `data-${string}`]: string | undefined;
  };
  titleClassName?: string;
  descriptionClassName?: string;
  bodyClassName?: string;
  footer?: React.ReactNode;
  footerClassName?: string;
  scrollableBody?: boolean;
  showCloseButton?: boolean;
  formProps?: React.ComponentPropsWithoutRef<"form">;
  onOpenAutoFocus?: React.ComponentPropsWithoutRef<
    typeof DialogContent
  >["onOpenAutoFocus"];
};

const bodyWrapperClassName = (
  scrollableBody: boolean | undefined,
  footer: React.ReactNode | undefined,
  hasHeaderSeparator: boolean,
  bodyClassName?: string,
) =>
  cn(
    "min-h-0 flex-1 px-6",
    scrollableBody ? "overflow-y-auto overscroll-contain" : undefined,
    hasHeaderSeparator ? "pt-4" : "pt-2",
    footer ? "pb-4" : "pb-6",
    bodyClassName,
  );

type DialogBodyProps = {
  bodyClassName: string | undefined;
  children: React.ReactNode;
  footer: React.ReactNode | undefined;
  footerClassName: string | undefined;
  hasHeaderSeparator: boolean;
  scrollableBody: boolean | undefined;
};

const DialogBody = ({
  bodyClassName,
  children,
  footer,
  footerClassName,
  hasHeaderSeparator,
  scrollableBody,
}: DialogBodyProps) => (
  <>
    <div
      className={bodyWrapperClassName(
        scrollableBody,
        footer,
        hasHeaderSeparator,
        bodyClassName,
      )}
    >
      {children}
    </div>
    {footer ? (
      <>
        <div className="mx-6 border-t border-border/80" aria-hidden="true" />
        <DialogFooter className={cn("px-6 pb-6 pt-4 sm:space-x-0", footerClassName)}>
          {footer}
        </DialogFooter>
      </>
    ) : null}
  </>
);

type DialogShellContentProps = {
  bodyClassName: string | undefined;
  children: React.ReactNode;
  closeBlocked: boolean;
  closeLabel: string;
  description: React.ReactNode | undefined;
  descriptionClassName: string | undefined;
  footer: React.ReactNode | undefined;
  footerClassName: string | undefined;
  formProps: React.ComponentPropsWithoutRef<"form"> | undefined;
  headerClassName: string | undefined;
  headerProps: FormDialogShellProps["headerProps"];
  onCloseButton: () => void;
  scrollableBody: boolean | undefined;
  shellRef: React.RefObject<HTMLDivElement | null>;
  showCloseButton: boolean | undefined;
  title: React.ReactNode;
  titleClassName: string | undefined;
};

const DialogShellContent = ({
  bodyClassName,
  children,
  closeBlocked,
  closeLabel,
  description,
  descriptionClassName,
  footer,
  footerClassName,
  formProps,
  headerClassName,
  headerProps,
  onCloseButton,
  scrollableBody,
  shellRef,
  showCloseButton,
  title,
  titleClassName,
}: DialogShellContentProps) => {
  const hasHeaderSeparator = Boolean(description);
  const body = (
    <DialogBody
      bodyClassName={bodyClassName}
      footer={footer}
      footerClassName={footerClassName}
      hasHeaderSeparator={hasHeaderSeparator}
      scrollableBody={scrollableBody}
    >
      {children}
    </DialogBody>
  );

  return (
    <>
      {showCloseButton ? (
        <DialogCloseButton
          label={closeLabel}
          disabled={closeBlocked}
          onClick={onCloseButton}
        />
      ) : null}
      <div
        ref={shellRef}
        className="flex max-h-[calc(100vh-2rem)] min-h-0 flex-col overflow-hidden rounded-[var(--gw-dialog-corner-radius)]"
      >
        <DialogHeader
          className={cn(
            "px-6 pt-6 pr-14",
            hasHeaderSeparator ? "pb-4" : "pb-2",
            headerClassName,
          )}
          {...headerProps}
        >
          <DialogTitle className={titleClassName}>{title}</DialogTitle>
          {description ? (
            <DialogDescription className={descriptionClassName}>
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {hasHeaderSeparator ? (
          <div className="mx-6 border-b border-border/80" aria-hidden="true" />
        ) : null}
        {formProps ? (
          <form
            {...formProps}
            className={cn("flex min-h-0 flex-1 flex-col", formProps.className)}
          >
            {body}
          </form>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">{body}</div>
        )}
      </div>
    </>
  );
};

export const FormDialogShell = ({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  children,
  id,
  busy = false,
  preventCloseWhenBusy = false,
  onRequestClose,
  contentClassName,
  contentStyle,
  headerClassName,
  headerProps,
  titleClassName,
  descriptionClassName,
  bodyClassName,
  footer,
  footerClassName,
  scrollableBody = true,
  showCloseButton = true,
  formProps,
  onOpenAutoFocus,
}: FormDialogShellProps) => {
  const closeBlocked = busy && preventCloseWhenBusy;
  const closeReasonRef = useRef<FormDialogCloseReason | null>(null);
  const dialogContentRef = useRef<HTMLDivElement | null>(null);
  const openComboboxAtDownRef = useOpenComboboxAtDown(open, dialogContentRef);
  const shellRef = useRef<HTMLDivElement | null>(null);
  useDialogResize(open, dialogContentRef, shellRef);
  const accessibilityProps = description
    ? {}
    : ({ "aria-describedby": undefined } as const);

  const requestClose = (reason: FormDialogCloseReason) => {
    closeReasonRef.current = reason;
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }

    if (closeBlocked) {
      return;
    }

    const reason = closeReasonRef.current ?? "open-change";
    closeReasonRef.current = null;
    onRequestClose?.(reason);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        ref={dialogContentRef}
        id={id}
        className={cn("max-h-[calc(100vh-2rem)] p-0", contentClassName)}
        style={contentStyle}
        {...accessibilityProps}
        {...(onOpenAutoFocus ? { onOpenAutoFocus } : {})}
        onEscapeKeyDown={(event) => {
          if (closeBlocked) {
            event.preventDefault();
            return;
          }

          requestClose("escape-key");
        }}
        onPointerDownOutside={(event) => {
          const shouldPreventClose = closeBlocked || openComboboxAtDownRef.current;
          openComboboxAtDownRef.current = false;

          if (shouldPreventClose) {
            event.preventDefault();
            return;
          }

          requestClose("pointer-down-outside");
        }}
      >
        <DialogShellContent
          bodyClassName={bodyClassName}
          closeBlocked={closeBlocked}
          closeLabel={closeLabel}
          description={description}
          descriptionClassName={descriptionClassName}
          footer={footer}
          footerClassName={footerClassName}
          formProps={formProps}
          headerClassName={headerClassName}
          headerProps={headerProps}
          onCloseButton={() => requestClose("close-button")}
          scrollableBody={scrollableBody}
          shellRef={shellRef}
          showCloseButton={showCloseButton}
          title={title}
          titleClassName={titleClassName}
        >
          {children}
        </DialogShellContent>
      </DialogContent>
    </Dialog>
  );
};
