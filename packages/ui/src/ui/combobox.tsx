import { Command as CommandPrimitive } from "cmdk";
import {
  forwardRef,
  type WheelEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "../lib/utils";

import {
  dropdownPanelChromeClass,
  dropdownPanelSideOffset,
  getPanelChromeClass,
  getTriggerChromeClass,
  resolveChromeSide,
} from "./dropdown-chrome";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

/* -------------------------------------------------------------------------- */
/*  Low-level Command parts (reusable outside Combobox)                       */
/* -------------------------------------------------------------------------- */

const Command = forwardRef<
  React.ComponentRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-md bg-transparent text-[color:var(--gw-form-foreground)]",
      className,
    )}
    {...props}
  />
));
Command.displayName = "Command";

const CommandInput = forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center border-b px-3 [border-color:var(--gw-form-border-color)]">
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
      className="gw-form-decorative mr-2 h-4 w-4 shrink-0"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md bg-transparent py-3 text-sm text-[color:inherit] outline-none placeholder:text-[color:var(--gw-form-muted-foreground)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = "CommandInput";

const CommandList = forwardRef<
  React.ComponentRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
    {...props}
  />
));
CommandList.displayName = "CommandList";

const CommandEmpty = forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty ref={ref} className="py-6 text-center text-sm" {...props} />
));
CommandEmpty.displayName = "CommandEmpty";

const CommandGroup = forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-hidden p-1 text-[color:var(--gw-form-foreground)] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-[color:var(--gw-form-muted-foreground)]",
      className,
    )}
    {...props}
  />
));
CommandGroup.displayName = "CommandGroup";

const CommandItem = forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      className,
    )}
    {...props}
  />
));
CommandItem.displayName = "CommandItem";

const CommandSeparator = forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 h-px bg-border", className)}
    {...props}
  />
));
CommandSeparator.displayName = "CommandSeparator";

/* -------------------------------------------------------------------------- */
/*  Combobox — high-level searchable select                                   */
/* -------------------------------------------------------------------------- */

export interface ComboboxOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  size?: "default" | "sm";
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  className?: string;
  contentClassName?: string;
}

type ElementState = {
  contentElement: HTMLDivElement | null;
  open: boolean;
  triggerElement: HTMLButtonElement | null;
};

const useNativeWheel = (
  contentElement: HTMLDivElement | null,
  handleWheel: (event: WheelEvent<HTMLDivElement>) => void,
  open: boolean,
): void => {
  useEffect(() => {
    if (!open || !contentElement) return;
    const handleNativeWheel = (event: globalThis.WheelEvent) =>
      handleWheel(event as unknown as WheelEvent<HTMLDivElement>);
    contentElement.addEventListener("wheel", handleNativeWheel, {
      capture: true,
      passive: false,
    });
    return () => contentElement.removeEventListener("wheel", handleNativeWheel, true);
  }, [contentElement, handleWheel, open]);
};

const useContentSide = ({
  contentElement,
  open,
  triggerElement,
}: ElementState): "bottom" | "top" => {
  const [side, setSide] = useState<"bottom" | "top">("bottom");
  useLayoutEffect(() => {
    if (!open) {
      setSide("bottom");
      return;
    }
    if (!contentElement || !triggerElement) return;
    const sync = () => setSide(resolveChromeSide(triggerElement, contentElement));
    sync();
    const frame = requestAnimationFrame(sync);
    const observer = new MutationObserver(sync);
    observer.observe(contentElement, {
      attributeFilter: ["data-side", "style"],
      attributes: true,
    });
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(sync);
    resizeObserver?.observe(contentElement);
    resizeObserver?.observe(triggerElement);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver?.disconnect();
    };
  }, [contentElement, open, triggerElement]);
  return side;
};

type SearchFocusOptions = {
  inputRef: React.RefObject<HTMLInputElement | null>;
  open: boolean;
  selectedLabel: string | undefined;
  setActiveValue: (value: string) => void;
  setSearch: (value: string) => void;
};

const useSearchFocus = (options: SearchFocusOptions): void => {
  const { inputRef, open, selectedLabel, setActiveValue, setSearch } = options;
  useEffect(() => {
    if (!open) {
      setSearch("");
      setActiveValue("");
      return;
    }
    setActiveValue(selectedLabel ?? "");
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [inputRef, open, selectedLabel, setActiveValue, setSearch]);
};

type SelectedScrollOptions = {
  listRef: React.RefObject<React.ComponentRef<typeof CommandPrimitive.List> | null>;
  open: boolean;
  optionRefs: React.RefObject<Map<string, HTMLElement>>;
  search: string;
  value: string | undefined;
};

const useSelectedScroll = (options: SelectedScrollOptions): void => {
  const { listRef, open, optionRefs, search, value } = options;
  useLayoutEffect(() => {
    if (!open || !value || search !== "") return;
    const scroll = () => {
      const list = listRef.current;
      const selected = optionRefs.current.get(value);
      if (!list || !selected) return;
      selected.scrollIntoView({ block: "nearest" });
      const top = selected.offsetTop;
      const bottom = top + selected.offsetHeight;
      if (top < list.scrollTop) list.scrollTop = top;
      else if (bottom > list.scrollTop + list.clientHeight) {
        list.scrollTop = bottom - list.clientHeight;
      }
    };
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(scroll);
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [listRef, open, optionRefs, search, value]);
};

type ComboboxTriggerProps = {
  ariaDescribedby: string | undefined;
  ariaLabel: string | undefined;
  ariaLabelledby: string | undefined;
  contentId: string;
  contentSide: "bottom" | "top";
  disabled: boolean;
  id: string | undefined;
  onRef: (node: HTMLButtonElement | null) => void;
  open: boolean;
  placeholder: string;
  selectedLabel: string | undefined;
  size: "default" | "sm";
};

const ComboboxTrigger = (props: ComboboxTriggerProps) => (
  <PopoverTrigger asChild>
    <button
      ref={props.onRef}
      id={props.id}
      type="button"
      role="combobox"
      aria-controls={props.contentId}
      aria-expanded={props.open}
      aria-label={props.ariaLabel ?? props.placeholder}
      aria-labelledby={props.ariaLabelledby}
      aria-describedby={props.ariaDescribedby}
      disabled={props.disabled}
      className={cn(
        "flex w-full items-center justify-between disabled:cursor-not-allowed disabled:opacity-50",
        getTriggerChromeClass({ open: props.open, side: props.contentSide }),
        props.size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-3 py-2 text-sm",
        !props.selectedLabel && "gw-form-decorative",
      )}
    >
      <span className="truncate">{props.selectedLabel ?? props.placeholder}</span>
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
        className="gw-form-decorative ml-2 h-4 w-4 shrink-0"
      >
        <path d="m7 15 5 5 5-5" />
        <path d="m7 9 5-5 5 5" />
      </svg>
    </button>
  </PopoverTrigger>
);

type ComboboxContentProps = {
  activeValue: string;
  className: string | undefined;
  contentId: string;
  contentSide: "bottom" | "top";
  emptyMessage: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  listRef: React.RefObject<React.ComponentRef<typeof CommandPrimitive.List> | null>;
  onContentRef: (node: HTMLDivElement | null) => void;
  onSearchChange: (value: string) => void;
  onSelect: (value: string) => void;
  onValueChange: (value: string) => void;
  optionRefs: React.RefObject<Map<string, HTMLElement>>;
  options: ComboboxOption[];
  search: string;
  searchPlaceholder: string;
  value: string | undefined;
};

const ComboboxContent = (props: ComboboxContentProps) => (
  <PopoverContent
    ref={props.onContentRef}
    id={props.contentId}
    data-slot="combobox-content"
    sideOffset={dropdownPanelSideOffset}
    className={cn(
      "border",
      "w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)]",
      "data-[state=open]:animate-none data-[state=closed]:animate-none",
      dropdownPanelChromeClass,
      "max-h-[min(24rem,var(--radix-popover-content-available-height))]",
      props.className,
    )}
    onOpenAutoFocus={(event) => event.preventDefault()}
  >
    <Command
      shouldFilter
      value={props.activeValue}
      onValueChange={props.onValueChange}
      className={getPanelChromeClass(props.contentSide)}
    >
      <CommandInput
        ref={props.inputRef}
        placeholder={props.searchPlaceholder}
        value={props.search}
        onValueChange={props.onSearchChange}
      />
      <CommandList
        ref={props.listRef}
        className="max-h-[min(300px,var(--radix-popover-content-available-height))]"
      >
        <CommandEmpty>{props.emptyMessage}</CommandEmpty>
        <CommandGroup>
          {props.options.map((option) => (
            <CommandItem
              key={option.value}
              ref={(node) => {
                if (node) props.optionRefs.current.set(option.value, node);
                else props.optionRefs.current.delete(option.value);
              }}
              data-combobox-option-value={option.value}
              value={option.label}
              {...(option.disabled ? { disabled: true } : {})}
              onSelect={() => props.onSelect(option.value)}
            >
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
                className={cn(
                  "mr-2 h-4 w-4",
                  props.value === option.value ? "opacity-100" : "opacity-0",
                )}
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {option.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
);

function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  size = "default",
  disabled = false,
  id,
  ariaLabel,
  "aria-labelledby": ariaLabelledby,
  "aria-describedby": ariaDescribedby,
  className,
  contentClassName,
}: ComboboxProps) {
  const generatedId = useId();
  const contentId = `${id ?? generatedId}-content`;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCommandValue, setActiveCommandValue] = useState("");
  const [triggerElement, setTriggerElement] = useState<HTMLButtonElement | null>(null);
  const [contentElement, setContentElement] = useState<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<React.ComponentRef<typeof CommandPrimitive.List>>(null);
  const optionRefs = useRef(new Map<string, HTMLElement>());

  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label,
    [options, value],
  );

  const handleSelect = useCallback(
    (selectedValue: string) => {
      onValueChange?.(selectedValue === value ? "" : selectedValue);
      setOpen(false);
      setSearch("");
    },
    [onValueChange, value],
  );

  const handleMenuWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    const list = listRef.current;
    if (!list || event.ctrlKey || event.metaKey) {
      return;
    }

    const maxScrollTop = list.scrollHeight - list.clientHeight;
    if (maxScrollTop <= 0) {
      return;
    }

    const deltaY =
      event.deltaMode === 1
        ? event.deltaY * 16
        : event.deltaMode === 2
          ? event.deltaY * list.clientHeight
          : event.deltaY;

    if (deltaY === 0) {
      return;
    }

    const nextScrollTop = Math.min(Math.max(list.scrollTop + deltaY, 0), maxScrollTop);

    if (nextScrollTop === list.scrollTop) {
      return;
    }

    event.preventDefault();
    list.scrollTop = nextScrollTop;
  }, []);

  useNativeWheel(contentElement, handleMenuWheel, open);

  const handleTriggerRef = useCallback((node: HTMLButtonElement | null) => {
    setTriggerElement(node);
  }, []);

  const handleContentRef = useCallback((node: HTMLDivElement | null) => {
    setContentElement(node);
  }, []);

  useSearchFocus({
    inputRef,
    open,
    selectedLabel,
    setActiveValue: setActiveCommandValue,
    setSearch,
  });
  const contentSide = useContentSide({ contentElement, open, triggerElement });
  useSelectedScroll({ listRef, open, optionRefs, search, value });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={className}>
        <ComboboxTrigger
          ariaDescribedby={ariaDescribedby}
          ariaLabel={ariaLabel}
          ariaLabelledby={ariaLabelledby}
          contentId={contentId}
          contentSide={contentSide}
          disabled={disabled}
          id={id}
          onRef={handleTriggerRef}
          open={open}
          placeholder={placeholder}
          selectedLabel={selectedLabel}
          size={size}
        />
      </div>
      <ComboboxContent
        activeValue={activeCommandValue}
        className={contentClassName}
        contentId={contentId}
        contentSide={contentSide}
        emptyMessage={emptyMessage}
        inputRef={inputRef}
        listRef={listRef}
        onContentRef={handleContentRef}
        onSearchChange={setSearch}
        onSelect={handleSelect}
        onValueChange={setActiveCommandValue}
        optionRefs={optionRefs}
        options={options}
        search={search}
        searchPlaceholder={searchPlaceholder}
        value={value}
      />
    </Popover>
  );
}

export {
  Combobox,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
};
