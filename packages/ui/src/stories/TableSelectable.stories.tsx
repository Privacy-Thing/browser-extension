import type { Meta, StoryObj } from "@storybook/react";
import { useCallback, useState } from "react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { TableSelectionNotice } from "../ui/table-selection-notice";
import { TableToolbar } from "../ui/table-toolbar";

const meta = {
  title: "Components/Table (Selectable)",
  component: Table,
  tags: ["autodocs"],
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

interface Rule {
  id: string;
  domain: string;
  location: string;
}

const rules: Rule[] = [
  { id: "1", domain: "browserleaks.com", location: "New York" },
  { id: "2", domain: "example.com", location: "Paris" },
  { id: "3", domain: "*.google.com", location: "London" },
  { id: "4", domain: "whatismybrowser.com", location: "Tokyo" },
];

function MultiSelectTable() {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected = selected.size === rules.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(rules.map((r) => r.id)));
  }, [allSelected]);

  const toggleRow = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="space-y-4">
      <TableToolbar
        actions={
          selected.size > 0 ? (
            <Button variant="destructive" size="sm">
              Delete selected
            </Button>
          ) : undefined
        }
      />
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <span className="sr-only">Select</span>
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Rule</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableSelectionNotice colSpan={4}>
              {selected.size > 0 ? (
                <span className="font-medium text-foreground">
                  {selected.size} of {rules.length} row(s) selected
                </span>
              ) : null}
            </TableSelectionNotice>
            {rules.map((rule) => (
              <TableRow
                key={rule.id}
                data-state={selected.has(rule.id) ? "selected" : undefined}
              >
                <TableCell>
                  <Checkbox
                    checked={selected.has(rule.id)}
                    onChange={() => toggleRow(rule.id)}
                    aria-label={`Select ${rule.domain}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{rule.domain}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{rule.location}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export const MultiSelect: Story = {
  render: () => <MultiSelectTable />,
};

function SingleSelectTable() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Selected: {selected ? rules.find((r) => r.id === selected)?.domain : "none"}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <span className="sr-only">Select</span>
            </TableHead>
            <TableHead>Rule</TableHead>
            <TableHead>Location</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule) => (
            <TableRow
              key={rule.id}
              data-state={selected === rule.id ? "selected" : undefined}
              className="cursor-pointer"
              onClick={() => setSelected(selected === rule.id ? null : rule.id)}
            >
              <TableCell>
                <Checkbox
                  checked={selected === rule.id}
                  onChange={() => setSelected(selected === rule.id ? null : rule.id)}
                  aria-label={`Select ${rule.domain}`}
                />
              </TableCell>
              <TableCell className="font-medium">{rule.domain}</TableCell>
              <TableCell>
                <Badge variant="secondary">{rule.location}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const SingleSelect: Story = {
  render: () => <SingleSelectTable />,
};
