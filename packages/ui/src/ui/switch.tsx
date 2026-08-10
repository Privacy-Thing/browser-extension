import * as SwitchPrimitive from "@radix-ui/react-switch";
import { forwardRef } from "react";

import { cn } from "../lib/utils";

const Switch = forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    className={cn(
      "gw-form-focus-visible peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 [border-color:var(--gw-form-border-color)] transition-colors hover:shadow-sm focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:hover:bg-primary/90 data-[state=unchecked]:bg-[color:var(--gw-form-field-surface)] data-[state=unchecked]:hover:bg-[color:var(--gw-form-field-hover-surface)] data-[state=unchecked]:hover:[border-color:var(--gw-form-border-hover-color)]",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-[color:var(--gw-form-foreground)] shadow-lg ring-0 transition-transform peer-hover:shadow-md data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
