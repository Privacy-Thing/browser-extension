import type { Meta, StoryObj } from "@storybook/react";
import { useCallback, useState } from "react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { type DataTableColumn, DataTable } from "../ui/data-table";
import { TableSelectionNotice } from "../ui/table-selection-notice";
import { TableToolbar } from "../ui/table-toolbar";

const meta = {
  title: "Components/DataTable",
  component: DataTable,
  tags: ["autodocs"],
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/* -------------------------------------------------------------------------- */
/*  Rules table                                                               */
/* -------------------------------------------------------------------------- */

interface Rule {
  id: string;
  domain: string;
  location: string;
  status: "active" | "unused";
}

const rules: Rule[] = [
  { id: "1", domain: "browserleaks.com", location: "New York", status: "active" },
  { id: "2", domain: "example.com", location: "Paris", status: "unused" },
  { id: "3", domain: "*.google.com", location: "London", status: "active" },
  { id: "4", domain: "whatismybrowser.com", location: "Tokyo", status: "active" },
  { id: "5", domain: "ipleak.net", location: "Warsaw", status: "unused" },
  { id: "6", domain: "whoer.net", location: "Berlin", status: "active" },
  { id: "7", domain: "docs.example.org", location: "Sydney", status: "unused" },
];

const ruleColumns: DataTableColumn<Rule>[] = [
  {
    id: "domain",
    header: "Rule",
    cell: (row) => <span className="font-medium">{row.domain}</span>,
    filterValue: (row) => row.domain,
  },
  {
    id: "location",
    header: "Location",
    cell: (row) => <Badge variant="secondary">{row.location}</Badge>,
    filterValue: (row) => row.location,
  },
  {
    id: "status",
    header: "Status",
    cell: (row) => (
      <Badge variant={row.status === "active" ? "success" : "outline"}>
        {row.status}
      </Badge>
    ),
    filterValue: (row) => row.status,
  },
  {
    id: "actions",
    header: <span className="text-right block">Actions</span>,
    cell: () => (
      <div className="text-right">
        <Button variant="ghost" size="sm">
          Edit
        </Button>
      </div>
    ),
    className: "text-right",
  },
];

export const FilterableRules: Story = {
  args: {
    columns: ruleColumns as DataTableColumn<unknown>[],
    data: rules,
    rowKey: (row) => (row as Rule).id,
    filter: { placeholder: "Filter rules..." },
  },
};

export const FilterByColumn: Story = {
  args: {
    columns: ruleColumns as DataTableColumn<unknown>[],
    data: rules,
    rowKey: (row) => (row as Rule).id,
    filter: { placeholder: "Filter by domain...", columnId: "domain" },
  },
};

/* -------------------------------------------------------------------------- */
/*  Profiles table with filter + selection                                    */
/* -------------------------------------------------------------------------- */

interface Profile {
  id: string;
  name: string;
  mode: string;
  preset: string;
  quality: "low" | "medium" | "high";
  linked: number;
  created: string;
}

const profiles: Profile[] = [
  {
    id: "1",
    name: "Profile 2",
    mode: "stationary",
    preset: "quick",
    quality: "medium",
    linked: 0,
    created: "Mar 31, 2026",
  },
  {
    id: "2",
    name: "standard",
    mode: "stationary",
    preset: "full",
    quality: "high",
    linked: 1,
    created: "Mar 25, 2026",
  },
  {
    id: "3",
    name: "walking-paris",
    mode: "pedestrian",
    preset: "quick",
    quality: "low",
    linked: 2,
    created: "Feb 10, 2026",
  },
  {
    id: "4",
    name: "driving-test",
    mode: "vehicle",
    preset: "full",
    quality: "medium",
    linked: 0,
    created: "Jan 5, 2026",
  },
];

const qualityColor = (q: Profile["quality"]) =>
  q === "high" ? "success" : q === "medium" ? "warning" : "error";

function SelectableProfilesTable() {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected = selected.size === profiles.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(profiles.map((p) => p.id)));
  }, [allSelected]);

  const toggleRow = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const columns: DataTableColumn<Profile>[] = [
    {
      id: "select",
      header: (
        <Checkbox
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = someSelected;
          }}
          onChange={toggleAll}
          aria-label="Select all"
        />
      ),
      cell: (row) => (
        <Checkbox
          checked={selected.has(row.id)}
          onChange={() => toggleRow(row.id)}
          aria-label={`Select ${row.name}`}
        />
      ),
      className: "w-[50px]",
    },
    {
      id: "name",
      header: "Profile",
      cell: (row) => <span className="font-medium">{row.name}</span>,
      filterValue: (row) => row.name,
    },
    {
      id: "mode",
      header: "Mode",
      cell: (row) => row.mode,
      filterValue: (row) => row.mode,
    },
    {
      id: "preset",
      header: "Preset",
      cell: (row) => row.preset,
    },
    {
      id: "quality",
      header: "Quality",
      cell: (row) => <Badge variant={qualityColor(row.quality)}>{row.quality}</Badge>,
    },
    {
      id: "linked",
      header: "Linked",
      cell: (row) => row.linked,
    },
    {
      id: "created",
      header: "Created",
      cell: (row) => <span className="text-muted-foreground">{row.created}</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={profiles}
      rowKey={(row) => row.id}
      filter={{ placeholder: "Search profiles..." }}
      toolbar={
        selected.size > 0 ? (
          <TableToolbar
            actions={
              <Button variant="destructive" size="sm">
                Delete
              </Button>
            }
          />
        ) : undefined
      }
      selectionNotice={
        <TableSelectionNotice colSpan={columns.length}>
          {selected.size > 0 ? (
            <span className="font-medium text-foreground">
              {selected.size} selected
            </span>
          ) : null}
        </TableSelectionNotice>
      }
      rowProps={(row) =>
        selected.has(row.id)
          ? ({ "data-state": "selected" } as React.HTMLAttributes<HTMLTableRowElement>)
          : undefined
      }
    />
  );
}

export const FilterableWithSelection: Story = {
  render: () => <SelectableProfilesTable />,
  args: {
    columns: [],
    data: [],
  },
};

/* -------------------------------------------------------------------------- */
/*  Empty state                                                               */
/* -------------------------------------------------------------------------- */

export const EmptyFiltered: Story = {
  args: {
    columns: ruleColumns as DataTableColumn<unknown>[],
    data: [],
    filter: { placeholder: "Filter rules..." },
    emptyMessage: "No rules match your filter.",
  },
};
