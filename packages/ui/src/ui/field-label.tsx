import { forwardRef } from "react";

import { cn } from "../lib/utils";

import { Label } from "./label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

type FieldLabelProps = React.ComponentPropsWithoutRef<typeof Label> & {
  info?: React.ReactNode;
  infoLabel?: string;
};

const InfoIcon = () => (
  <span
    aria-hidden="true"
    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-[10px] font-semibold leading-none text-primary transition-colors group-hover:border-primary/45 group-hover:bg-primary/15"
  >
    i
  </span>
);

const FieldLabel = forwardRef<HTMLLabelElement, FieldLabelProps>(
  ({ children, className, info, infoLabel = "Field help", ...props }, ref) => (
    <div className={cn("mb-2 flex items-center gap-1.5", className)}>
      <Label ref={ref} variant="field" {...props}>
        {children}
      </Label>
      {info ? (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={infoLabel}
                className="group inline-flex rounded-full text-primary outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <InfoIcon />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-72 space-y-2 px-3 py-2 text-xs leading-relaxed">
              {info}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  ),
);

FieldLabel.displayName = "FieldLabel";

export { FieldLabel };
