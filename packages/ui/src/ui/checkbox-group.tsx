import { useMemo } from "react";

import { cn } from "../lib/utils";

import { Button } from "./button";
import { Checkbox } from "./checkbox";

export type CheckboxOption = {
  id: string;
  label: string;
};

export interface CheckboxGroupProps {
  title: string;
  options: CheckboxOption[];
  selectedKeys: Set<string>;
  onSelectionChange: (keys: Set<string>) => void;
  className?: string;
}

export function CheckboxGroup({
  title,
  options,
  selectedKeys,
  onSelectionChange,
  className,
}: CheckboxGroupProps) {
  const allSelected = useMemo(() => {
    if (options.length === 0) return false;
    return options.every((opt) => selectedKeys.has(opt.id));
  }, [options, selectedKeys]);

  const someSelected = useMemo(() => {
    return options.some((opt) => selectedKeys.has(opt.id));
  }, [options, selectedKeys]);

  const masterState = allSelected ? true : someSelected ? "indeterminate" : false;

  const handleMasterChange = () => {
    const next = new Set(selectedKeys);
    if (allSelected) {
      options.forEach((opt) => next.delete(opt.id));
    } else {
      options.forEach((opt) => next.add(opt.id));
    }
    onSelectionChange(next);
  };

  const handleClear = () => {
    const next = new Set(selectedKeys);
    options.forEach((opt) => next.delete(opt.id));
    onSelectionChange(next);
  };

  const handleToggle = (id: string) => {
    const next = new Set(selectedKeys);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer select-none">
          <Checkbox
            checked={masterState}
            onChange={handleMasterChange}
            onClick={handleMasterChange}
          />
          {title}
        </label>
        {someSelected && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleClear}
          >
            Clear
          </Button>
        )}
      </div>
      {options.length > 0 ? (
        <div className="flex flex-col gap-2 pl-6">
          {options.map((opt) => (
            <label
              key={opt.id}
              className="flex items-center gap-2 text-sm text-foreground/80 cursor-pointer select-none"
            >
              <Checkbox
                checked={selectedKeys.has(opt.id)}
                onChange={() => handleToggle(opt.id)}
                onClick={() => handleToggle(opt.id)}
              />
              <span className="truncate">{opt.label}</span>
            </label>
          ))}
        </div>
      ) : (
        <div className="pl-6 text-xs text-muted-foreground">No options available</div>
      )}
    </div>
  );
}
