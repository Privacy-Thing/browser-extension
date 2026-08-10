import { forwardRef, useCallback, useEffect, useRef, useState } from "react";

import { cn } from "../lib/utils";

export interface NumberInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value" | "defaultValue" | "type"
> {
  value?: number | "";
  defaultValue?: number;
  onChange?: (value: number | "") => void;
  min?: number;
  max?: number;
  step?: number;
  /** Number of decimal places to preserve. */
  decimalScale?: number;
  /** Show increment/decrement stepper buttons. */
  stepper?: boolean;
}

export const formatNumberInputValue = (value: number | "" | undefined): string =>
  value === undefined || value === "" ? "" : String(value);

export const isPartialNumber = (value: string): boolean => {
  let hasSeparator = false;

  for (const [index, character] of [...value].entries()) {
    if (character >= "0" && character <= "9") {
      continue;
    }

    if (character === "-" && index === 0) {
      continue;
    }

    if ((character === "." || character === ",") && !hasSeparator) {
      hasSeparator = true;
      continue;
    }

    return false;
  }

  return true;
};

export const parseNumberInputValue = (value: string): number | null => {
  const normalizedValue = value.trim().replace(",", ".");
  if (
    normalizedValue === "" ||
    normalizedValue === "-" ||
    normalizedValue === "." ||
    normalizedValue === "-."
  ) {
    return null;
  }

  const parsed = Number.parseFloat(normalizedValue);
  return Number.isNaN(parsed) ? null : parsed;
};

function clampAndRound(
  raw: number,
  min: number | undefined,
  max: number | undefined,
  decimalScale: number | undefined,
): number {
  let v = raw;
  if (min !== undefined) v = Math.max(v, min);
  if (max !== undefined) v = Math.min(v, max);
  if (decimalScale !== undefined) {
    const factor = 10 ** decimalScale;
    v = Math.round(v * factor) / factor;
  }
  return v;
}

type NumberStateOptions = {
  decimalScale: number | undefined;
  defaultValue: number | undefined;
  max: number | undefined;
  min: number | undefined;
  onChange: NumberInputProps["onChange"] | undefined;
  step: number;
  value: NumberInputProps["value"] | undefined;
};

const useNumberState = (options: NumberStateOptions) => {
  const isControlled = options.value !== undefined;
  const [inputValue, setInputValue] = useState(() =>
    formatNumberInputValue(isControlled ? options.value : options.defaultValue),
  );
  const [isFocused, setIsFocused] = useState(false);
  const commitRef = useRef(options.onChange);
  useEffect(() => {
    commitRef.current = options.onChange;
  }, [options.onChange]);
  useEffect(() => {
    if (!isControlled || isFocused) return;
    setInputValue(formatNumberInputValue(options.value));
  }, [isControlled, isFocused, options.value]);
  const commit = useCallback(
    (next: number | "") => {
      if (!isControlled) setInputValue(formatNumberInputValue(next));
      commitRef.current?.(next);
    },
    [isControlled],
  );
  const normalize = useCallback(
    (value: number) =>
      clampAndRound(value, options.min, options.max, options.decimalScale),
    [options.decimalScale, options.max, options.min],
  );
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      if (raw === "" || raw === "-") {
        setInputValue(raw);
        if (raw === "") commitRef.current?.("");
        return;
      }
      if (!isPartialNumber(raw)) return;
      setInputValue(raw);
      const parsed = parseNumberInputValue(raw);
      if (parsed !== null) commitRef.current?.(normalize(parsed));
    },
    [normalize],
  );
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const parsed = parseNumberInputValue(inputValue);
    if (parsed === null) {
      commit("");
      return;
    }
    const next = normalize(parsed);
    setInputValue(String(next));
    commit(next);
  }, [commit, inputValue, normalize]);
  const nudge = useCallback(
    (direction: 1 | -1) => {
      const current = parseNumberInputValue(inputValue) ?? 0;
      const next = normalize(current + (options.step ?? 1) * direction);
      setInputValue(String(next));
      commit(next);
    },
    [commit, inputValue, normalize, options.step],
  );
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      nudge(event.key === "ArrowUp" ? 1 : -1);
    },
    [nudge],
  );
  return { handleBlur, handleChange, handleKeyDown, inputValue, nudge, setIsFocused };
};

const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      className,
      value: controlledValue,
      defaultValue,
      onChange,
      min,
      max,
      step = 1,
      decimalScale,
      stepper = false,
      disabled,
      ...props
    },
    ref,
  ) => {
    const { handleBlur, handleChange, handleKeyDown, inputValue, nudge, setIsFocused } =
      useNumberState({
        decimalScale,
        defaultValue,
        max,
        min,
        onChange,
        step,
        value: controlledValue,
      });

    return (
      <div className={cn("relative flex items-center", className)}>
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={cn(
            "gw-form-control gw-form-focus-visible flex h-10 w-full rounded-md border px-3 py-2 text-sm transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            stepper && "pr-8",
          )}
          {...props}
        />
        {stepper && (
          <div className="absolute right-0 flex h-full flex-col border-l [border-color:var(--gw-form-border-color)]">
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              className="gw-form-decorative flex h-1/2 w-7 items-center justify-center hover:bg-[color:var(--gw-form-field-hover-surface)] hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
              onClick={() => nudge(1)}
              aria-label="Increment"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m18 15-6-6-6 6" />
              </svg>
            </button>
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              className="gw-form-decorative flex h-1/2 w-7 items-center justify-center border-t [border-color:var(--gw-form-border-color)] hover:bg-[color:var(--gw-form-field-hover-surface)] hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
              onClick={() => nudge(-1)}
              aria-label="Decrement"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>
        )}
      </div>
    );
  },
);
NumberInput.displayName = "NumberInput";

export { NumberInput };
