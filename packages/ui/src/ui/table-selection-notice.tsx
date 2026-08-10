import type { ReactNode } from "react";

import { cn } from "../lib/utils";

import { TableCell, TableRow } from "./table";

export type SelectionNoticeProps = React.HTMLAttributes<HTMLTableRowElement> & {
  children?: ReactNode;
  colSpan: number;
  action?: ReactNode;
};

export const TableSelectionNotice = ({
  children,
  colSpan,
  action,
  className,
  ...props
}: SelectionNoticeProps) => {
  if (!children) {
    return null;
  }

  return (
    <TableRow {...props} className={cn("hover:bg-transparent", className)}>
      <TableCell
        colSpan={colSpan}
        aria-live="polite"
        className="border-b bg-muted/20 px-4 py-2 text-center text-sm text-muted-foreground"
      >
        <div className="flex items-center justify-center gap-3">
          {children}
          {action}
        </div>
      </TableCell>
    </TableRow>
  );
};
