import { forwardRef } from "react";

import { cn } from "../lib/utils";

const Textarea = forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "gw-form-control gw-form-focus-visible flex min-h-[96px] w-full rounded-md border px-3 py-2 text-sm transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
