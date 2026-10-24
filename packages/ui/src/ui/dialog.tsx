import * as DialogPrimitive from "@radix-ui/react-dialog";
import { createContext, forwardRef, useContext } from "react";

import { cn } from "../lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

export type AnimatedBorderTiming = "steady" | "boosted" | "urgent";

/**
 * How a dialog sizes itself. "centered" floats it up to its own max width; "fill"
 * covers the whole surface, for narrow panels such as the X-Ray sidebar.
 */
export type DialogLayout = "centered" | "fill";

const DialogLayoutContext = createContext<DialogLayout>("centered");

/** Sets the layout of every dialog rendered inside, including portalled content. */
const DialogLayoutProvider = ({
  layout,
  children,
}: {
  layout: DialogLayout;
  children: React.ReactNode;
}) => <DialogLayoutContext value={layout}>{children}</DialogLayoutContext>;

const useDialogLayout = () => useContext(DialogLayoutContext);

const fillLayoutClassName = "h-full max-h-none w-full max-w-none";

const DialogCloseButton = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close> & {
    label?: string;
  }
>(({ className, label = "Close", children, ...props }, ref) => (
  <DialogPrimitive.Close
    ref={ref}
    aria-label={label}
    data-dialog-close=""
    className={cn(
      "absolute right-4 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  >
    {children ?? <span className="fa-solid fa-xmark" aria-hidden="true" />}
  </DialogPrimitive.Close>
));
DialogCloseButton.displayName = "DialogCloseButton";

const DialogOverlay = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn("gw-dialog-overlay fixed inset-0 z-50 backdrop-blur-sm", className)}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    animationTiming?: AnimatedBorderTiming;
    /** Overrides the layout set by the nearest DialogLayoutProvider. */
    layout?: DialogLayout;
  }
>(
  (
    { animationTiming = "steady", layout, className, children, style, ...props },
    ref,
  ) => {
    const inheritedLayout = useDialogLayout();
    const resolvedLayout = layout ?? inheritedLayout;
    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            "gw-dialog-content gw-animated-accent-border gw-animated-accent-halo gw-animated-accent-halo-surface gw-dialog-content--animated-border gw-dialog-surface fixed left-[50%] top-[50%] z-50 grid grid-cols-[minmax(0,1fr)] w-[calc(100%-var(--gw-dialog-viewport-gap)*2)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 p-6 outline-none focus:outline-none focus-visible:outline-none",
            className,
            // The surface decides: its size wins over a dialog's own max width and height.
            resolvedLayout === "fill" && fillLayoutClassName,
          )}
          data-animation-timing={animationTiming}
          data-layout={resolvedLayout}
          style={style}
          {...props}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-dialog-header=""
    className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
    {...props}
  />
);

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-dialog-footer=""
    className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
    {...props}
  />
);

const DialogTitle = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogLayoutProvider,
  useDialogLayout,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogCloseButton,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
