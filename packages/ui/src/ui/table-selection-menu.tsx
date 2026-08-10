import { cn } from "../lib/utils";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

export type TableSelectionMenuOption = {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
};

export type TableSelectionMenuProps = {
  checked: boolean | "indeterminate";
  onToggleAll: () => void;
  toggleAllAriaLabel: string;
  menuAriaLabel: string;
  options: readonly TableSelectionMenuOption[];
  className?: string;
};

const ChevronDownIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5">
    <path
      d="M4.22 6.47a.75.75 0 0 1 1.06 0L8 9.19l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.53a.75.75 0 0 1 0-1.06Z"
      fill="currentColor"
    />
  </svg>
);

const SelectionStateIcon = ({ checked }: { checked: boolean | "indeterminate" }) => (
  <span
    aria-hidden="true"
    className="flex h-4 w-4 items-center justify-center rounded-sm border border-border bg-background text-[10px] font-bold leading-none text-primary"
  >
    {checked === true ? "✓" : checked === "indeterminate" ? "−" : null}
  </span>
);

export const TableSelectionMenu = ({
  checked,
  onToggleAll,
  toggleAllAriaLabel,
  menuAriaLabel,
  options,
  className,
}: TableSelectionMenuProps) => {
  return (
    <div
      className={cn(
        "relative z-10 inline-flex items-center rounded-md border border-border/70 bg-background",
        className,
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked === "indeterminate" ? "mixed" : checked}
        aria-label={toggleAllAriaLabel}
        className="flex h-7 w-7 items-center justify-center rounded-l-md text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={onToggleAll}
      >
        <SelectionStateIcon checked={checked} />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={menuAriaLabel}
            className="flex h-7 w-5 items-center justify-center rounded-r-md border-l border-border/70 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ChevronDownIcon />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[12rem]">
          {options.map((option) => (
            <DropdownMenuItem
              key={option.id}
              {...(option.disabled !== undefined ? { disabled: option.disabled } : {})}
              onSelect={option.onSelect}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
