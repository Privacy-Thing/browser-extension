import { type ReactNode, useMemo, useState } from "react";

import { cn } from "../lib/utils";

import { Input } from "./input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

/* -------------------------------------------------------------------------- */
/*  Column definition                                                         */
/* -------------------------------------------------------------------------- */

export interface DataTableColumn<T> {
  /** Unique key for the column. */
  id: string;
  /** Header label. */
  header: ReactNode;
  /** Render the cell content for a row. */
  cell: (row: T) => ReactNode;
  /**
   * Extract a plain-text value used for filtering.
   * If omitted the column is not filterable.
   */
  filterValue?: (row: T) => string;
  /** Additional className for the `<th>` / `<td>`. */
  className?: string;
}

/* -------------------------------------------------------------------------- */
/*  Filter                                                                    */
/* -------------------------------------------------------------------------- */

export interface DataTableFilterDef {
  /** Placeholder text shown in the search input. */
  placeholder?: string;
  /**
   * Restrict filtering to a specific column id.
   * When omitted the filter searches across all filterable columns.
   */
  columnId?: string;
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  /** Row key extractor. Defaults to index. */
  rowKey?: (row: T, index: number) => string;
  /** Enable a text filter above the table. */
  filter?: DataTableFilterDef | boolean;
  /** Content rendered between the filter and the table (e.g. bulk actions). */
  toolbar?: ReactNode;
  /** Content rendered as a selection/status row above the table header. */
  selectionNotice?: ReactNode;
  /** Message shown when the (filtered) data set is empty. */
  emptyMessage?: string;
  className?: string;
  /** Callback when a row is clicked. */
  onRowClick?: (row: T, index: number) => void;
  /** Render extra props onto each `<tr>`. */
  rowProps?: (
    row: T,
    index: number,
  ) => React.HTMLAttributes<HTMLTableRowElement> | undefined;
}

type FilterBarProps = {
  dataCount: number;
  filteredCount: number;
  filterDef: DataTableFilterDef;
  onQueryChange: (query: string) => void;
  query: string;
};

const FilterBar = ({
  dataCount,
  filteredCount,
  filterDef,
  onQueryChange,
  query,
}: FilterBarProps) => (
  <div className="flex items-center gap-2">
    <div className="relative max-w-sm flex-1">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <Input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={filterDef.placeholder ?? "Filter..."}
        className="pl-9 pr-8"
      />
      {query ? (
        <button
          type="button"
          onClick={() => onQueryChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear filter"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      ) : null}
    </div>
    {query ? (
      <span className="text-xs text-muted-foreground">
        {filteredCount} of {dataCount}
      </span>
    ) : null}
  </div>
);

type DataRowsProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  emptyMessage: string | undefined;
  onRowClick: DataTableProps<T>["onRowClick"] | undefined;
  rowKey: DataTableProps<T>["rowKey"] | undefined;
  rowProps: DataTableProps<T>["rowProps"] | undefined;
};

const DataRows = <T,>({
  columns,
  data,
  emptyMessage,
  onRowClick,
  rowKey,
  rowProps,
}: DataRowsProps<T>) => {
  if (data.length === 0) {
    return (
      <TableRow>
        <TableCell
          colSpan={columns.length}
          className="h-24 text-center text-muted-foreground"
        >
          {emptyMessage}
        </TableCell>
      </TableRow>
    );
  }
  return data.map((row, index) => {
    const key = rowKey ? rowKey(row, index) : String(index);
    const extra = rowProps?.(row, index);
    return (
      <TableRow
        key={key}
        {...extra}
        className={cn(onRowClick && "cursor-pointer", extra?.className)}
        onClick={(event) => {
          onRowClick?.(row, index);
          extra?.onClick?.(event);
        }}
      >
        {columns.map((column) => (
          <TableCell key={column.id} className={column.className}>
            {column.cell(row)}
          </TableCell>
        ))}
      </TableRow>
    );
  });
};

export function DataTable<T>({
  columns,
  data,
  rowKey,
  filter = false,
  toolbar,
  selectionNotice,
  emptyMessage = "No results.",
  className,
  onRowClick,
  rowProps,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");

  const filterDef: DataTableFilterDef | null =
    filter === true ? { placeholder: "Filter..." } : filter === false ? null : filter;

  const filterableColumns = useMemo(
    () =>
      columns.filter((col) => {
        if (!col.filterValue) return false;
        if (filterDef?.columnId) return col.id === filterDef.columnId;
        return true;
      }),
    [columns, filterDef?.columnId],
  );

  const filteredData = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q || filterableColumns.length === 0) return data;
    return data.filter((row) =>
      filterableColumns.some((col) => col.filterValue!(row).toLowerCase().includes(q)),
    );
  }, [data, query, filterableColumns]);

  return (
    <div className={cn("space-y-4", className)}>
      {filterDef ? (
        <FilterBar
          dataCount={data.length}
          filteredCount={filteredData.length}
          filterDef={filterDef}
          onQueryChange={setQuery}
          query={query}
        />
      ) : null}

      {toolbar}

      <div className="overflow-hidden rounded-md border">
        {selectionNotice}
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.id} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {selectionNotice}
            <DataRows
              columns={columns}
              data={filteredData}
              emptyMessage={emptyMessage}
              onRowClick={onRowClick}
              rowKey={rowKey}
              rowProps={rowProps}
            />
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
