import * as SelectPrimitive from "@radix-ui/react-select";
import {
  createContext,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

import { cn } from "../lib/utils";

import {
  type DropdownChromeSide,
  dropdownPanelChromeClass,
  dropdownPanelSideOffset,
  getPanelChromeClass,
  getTriggerChromeClass,
  resolveChromeSide,
} from "./dropdown-chrome";
type SelectChromeContextValue = {
  open: boolean;
  side: DropdownChromeSide;
  setSide: (side: DropdownChromeSide) => void;
  setTriggerElement: (element: HTMLElement | null) => void;
  triggerElement: HTMLElement | null;
};

const SelectChromeContext = createContext<SelectChromeContextValue | null>(null);

const useSelectChromeContext = (): SelectChromeContextValue =>
  useContext(SelectChromeContext) ?? {
    open: false,
    side: "bottom",
    setSide: () => {},
    setTriggerElement: () => {},
    triggerElement: null,
  };

const Select = ({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [side, setSide] = useState<DropdownChromeSide>("bottom");
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);
  const open = openProp ?? uncontrolledOpen;

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (openProp === undefined) {
        setUncontrolledOpen(nextOpen);
      }

      if (!nextOpen) {
        setSide("bottom");
      }

      onOpenChange?.(nextOpen);
    },
    [onOpenChange, openProp],
  );

  useEffect(() => {
    if (!open) {
      setSide("bottom");
    }
  }, [open]);

  const contextValue = useMemo(
    () => ({
      open,
      side,
      setSide,
      setTriggerElement,
      triggerElement,
    }),
    [open, side, triggerElement],
  );

  return (
    <SelectChromeContext.Provider value={contextValue}>
      <SelectPrimitive.Root open={open} onOpenChange={handleOpenChange} {...props} />
    </SelectChromeContext.Provider>
  );
};

const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  const { open, side, setTriggerElement } = useSelectChromeContext();

  const handleTriggerRef = useCallback(
    (node: React.ComponentRef<typeof SelectPrimitive.Trigger> | null) => {
      setTriggerElement(node);

      if (typeof ref === "function") {
        ref(node);
        return;
      }

      if (ref) {
        ref.current = node;
      }
    },
    [ref, setTriggerElement],
  );

  return (
    <SelectPrimitive.Trigger
      ref={handleTriggerRef}
      className={cn(
        "flex h-10 w-full items-center justify-between px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        getTriggerChromeClass({ open, side }),
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
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
          className="gw-form-decorative"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => {
  const { open, setSide, side, triggerElement } = useSelectChromeContext();
  const [contentElement, setContentElement] = useState<React.ComponentRef<
    typeof SelectPrimitive.Content
  > | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    if (!contentElement || !triggerElement) {
      return;
    }

    const syncSide = () => {
      setSide(resolveChromeSide(triggerElement, contentElement));
    };

    syncSide();

    const frame = requestAnimationFrame(syncSide);

    const observer = new MutationObserver(syncSide);
    observer.observe(contentElement, {
      attributes: true,
      attributeFilter: ["data-side", "style"],
    });

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(syncSide);
    resizeObserver?.observe(contentElement);
    resizeObserver?.observe(triggerElement);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver?.disconnect();
    };
  }, [contentElement, open, setSide, triggerElement]);

  useLayoutEffect(() => {
    if (!open || !contentElement) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const selectedItem = contentElement.querySelector<HTMLElement>(
        '[data-state="checked"]',
      );
      selectedItem?.scrollIntoView({
        block: "nearest",
      });
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [contentElement, open]);

  const handleContentRef = useCallback(
    (node: React.ComponentRef<typeof SelectPrimitive.Content> | null) => {
      setContentElement(node);

      if (typeof ref === "function") {
        ref(node);
        return;
      }

      if (ref) {
        ref.current = node;
      }
    },
    [ref],
  );

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={handleContentRef}
        className={cn(
          "relative z-[80] max-h-96 overflow-visible border transition-none",
          position === "popper" &&
            "w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)]",
          dropdownPanelChromeClass,
          className,
        )}
        position={position}
        sideOffset={dropdownPanelSideOffset}
        {...props}
      >
        <SelectPrimitive.Viewport
          className={cn(
            "overflow-hidden p-1",
            getPanelChromeClass(side),
            position === "popper" && "h-[var(--radix-select-trigger-height)] w-full",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
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
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </SelectPrimitive.ItemIndicator>
    </span>
    {isValidElement(children) ? (
      <SelectPrimitive.ItemText asChild>{children}</SelectPrimitive.ItemText>
    ) : (
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    )}
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
};
