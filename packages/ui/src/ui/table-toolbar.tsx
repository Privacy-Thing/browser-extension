import type { ReactNode } from "react";

import { cn } from "../lib/utils";

export type TableToolbarProps = React.HTMLAttributes<HTMLDivElement> & {
  search?: ReactNode;
  actions?: ReactNode;
};

export const TableToolbar = ({
  search,
  actions,
  className,
  ...props
}: TableToolbarProps) => {
  return (
    <div
      {...props}
      className={cn("rounded-lg border bg-muted/30 px-3 py-3", className)}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">{search}</div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:justify-end">
            {actions}
          </div>
        ) : (
          <div className="min-h-9" />
        )}
      </div>
    </div>
  );
};
