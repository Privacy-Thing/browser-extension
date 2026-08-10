import { forwardRef } from "react";

import { cn } from "../lib/utils";

type LabelProps = React.ComponentProps<"label"> & {
  variant?: "default" | "field";
};

const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, variant: _variant = "default", ...props }, ref) => {
    return (
      // eslint-disable-next-line jsx-a11y/label-has-associated-control -- generic primitive; htmlFor/nesting supplied by the caller via ...props
      <label
        ref={ref}
        className={cn(
          "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
          className,
        )}
        {...props}
      />
    );
  },
);
Label.displayName = "Label";

export { Label };
