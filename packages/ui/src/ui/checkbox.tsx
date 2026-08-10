import { forwardRef, useEffect, useRef } from "react";

import { cn } from "../lib/utils";

export interface CheckboxProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "checked"
> {
  checked?: boolean | "indeterminate";
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, ...props }, ref) => {
    const innerRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      if (innerRef.current) {
        innerRef.current.indeterminate = checked === "indeterminate";
        // Also ensure native component state matches for true/false explicitly if needed
        if (checked === true) innerRef.current.checked = true;
        if (checked === false) innerRef.current.checked = false;
      }
    }, [checked]);

    return (
      <input
        type="checkbox"
        ref={(node) => {
          innerRef.current = node;
          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
          }
        }}
        checked={checked === "indeterminate" ? false : checked}
        className={cn(
          "gw-form-focus-visible h-4 w-4 shrink-0 rounded-sm border transition-colors [border-color:var(--gw-form-border-color)] hover:[border-color:var(--gw-form-border-hover-color)] hover:bg-[color:var(--gw-form-field-hover-surface)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:[border-color:var(--gw-form-border-color)] disabled:hover:bg-transparent",
          "accent-primary",
          className,
        )}
        {...props}
      />
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
