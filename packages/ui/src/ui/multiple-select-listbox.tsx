import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "../lib/utils";

export type MultiSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type MultiSelectListboxProps = {
  options: readonly MultiSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
};

const getEnabledIndex = (
  options: readonly MultiSelectOption[],
  startIndex: number,
  direction: 1 | -1,
): number => {
  for (
    let index = startIndex;
    index >= 0 && index < options.length;
    index += direction
  ) {
    if (!options[index]?.disabled) {
      return index;
    }
  }

  return -1;
};

const useListboxState = (
  options: readonly MultiSelectOption[],
  value: string,
  onValueChange: (value: string) => void,
  disabled: boolean,
) => {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value],
  );
  const [activeIndex, setActiveIndex] = useState(
    selectedIndex >= 0 ? selectedIndex : -1,
  );
  useEffect(
    () => setActiveIndex(selectedIndex >= 0 ? selectedIndex : -1),
    [selectedIndex],
  );
  useEffect(() => {
    if (activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex]);
  const selectIndex = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    setActiveIndex(index);
    onValueChange(option.value);
  };
  const move = (direction: 1 | -1) => {
    if (options.length === 0) return;
    const start =
      activeIndex >= 0
        ? activeIndex + direction
        : direction > 0
          ? 0
          : options.length - 1;
    const next = getEnabledIndex(options, start, direction);
    if (next >= 0) setActiveIndex(next);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const actions: Partial<Record<string, () => void>> = {
      ArrowDown: () => move(1),
      ArrowUp: () => move(-1),
      End: () => setActiveIndex(getEnabledIndex(options, options.length - 1, -1)),
      Home: () => setActiveIndex(getEnabledIndex(options, 0, 1)),
      Enter: () => activeIndex >= 0 && selectIndex(activeIndex),
      " ": () => activeIndex >= 0 && selectIndex(activeIndex),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };
  return { activeIndex, handleKeyDown, optionRefs, selectIndex, setActiveIndex };
};

export function MultipleSelectListbox({
  options,
  value,
  onValueChange,
  id,
  disabled = false,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  "aria-describedby": ariaDescribedby,
}: MultiSelectListboxProps) {
  const reactId = useId();
  const { activeIndex, handleKeyDown, optionRefs, selectIndex, setActiveIndex } =
    useListboxState(options, value, onValueChange, disabled);

  return (
    <div
      id={id}
      role="listbox"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      aria-describedby={ariaDescribedby}
      aria-disabled={disabled}
      aria-activedescendant={
        activeIndex >= 0 ? `${reactId}-option-${activeIndex}` : undefined
      }
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      className={cn(
        "gw-form-panel-control gw-form-focus-visible rounded-2xl border p-3 shadow-[inset_0_1px_0_var(--gw-form-panel-inset-highlight-color),0_10px_30px_var(--gw-form-panel-shadow-color)] outline-none",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <div className="max-h-40 overflow-y-auto pr-1">
        <div className="space-y-1">
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;

            return (
              <button
                key={option.value}
                id={`${reactId}-option-${index}`}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={disabled || option.disabled}
                onClick={() => selectIndex(index)}
                onFocus={() => setActiveIndex(index)}
                className={cn(
                  "flex w-full items-start rounded-md px-3 py-2 text-left text-sm leading-5 text-foreground transition-colors outline-none",
                  "focus-visible:bg-accent/70 focus-visible:text-accent-foreground",
                  !option.disabled && "hover:bg-accent/40",
                  isActive && !isSelected && "bg-accent/15",
                  isSelected &&
                    "bg-accent text-accent-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]",
                  option.disabled && "cursor-not-allowed opacity-50",
                )}
              >
                <span className="block w-full break-words whitespace-normal">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
