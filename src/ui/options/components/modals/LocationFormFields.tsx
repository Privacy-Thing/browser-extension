import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/ui/components/lib/utils";
import { Label } from "@/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/components/ui/select";
import { DialogFieldRow } from "@/ui/options/components/modals/dialog-primitives";

export type PresetOption = {
  value: string;
  label: string;
};

export const UNASSIGNED_VALUE = "unassigned";

type LocationFormFieldsProps = {
  sectionLabel: string;
  sectionHint: ReactNode;
  warning?: ReactNode;
  selectId: string;
  selectLabel: string;
  selectPlaceholder: string;
  selectValue: string;
  selectDisabled?: boolean;
  selectInvalid?: boolean;
  selectContentStyle?: CSSProperties;
  selectItemClassName?: string;
  selectOptions: readonly PresetOption[];
  onSelectValueChange: (value: string) => void;
};

export const LocationFormFields = ({
  sectionLabel,
  sectionHint,
  warning,
  selectId,
  selectLabel,
  selectPlaceholder,
  selectValue,
  selectDisabled = false,
  selectInvalid = false,
  selectContentStyle,
  selectItemClassName,
  selectOptions,
  onSelectValueChange,
}: LocationFormFieldsProps) => (
  <>
    <div className="space-y-2">
      <Label variant="field" className="mb-0 block">
        {sectionLabel}
      </Label>
      <div className="text-sm text-muted-foreground [&_p+p]:mt-2">{sectionHint}</div>
    </div>
    <DialogFieldRow htmlFor={selectId} label={selectLabel}>
      <div className="min-w-0 space-y-1">
        <Select
          disabled={selectDisabled}
          value={selectValue}
          onValueChange={onSelectValueChange}
        >
          <SelectTrigger
            id={selectId}
            data-selected-value={selectValue}
            className={cn(
              "h-10 w-full",
              selectInvalid &&
                "border-destructive/70 text-foreground ring-1 ring-destructive/30",
            )}
            aria-invalid={selectInvalid}
          >
            <SelectValue placeholder={selectPlaceholder} />
          </SelectTrigger>
          <SelectContent style={selectContentStyle}>
            {selectOptions.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className={selectItemClassName}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {warning ? (
          <div className="text-xs text-muted-foreground">{warning}</div>
        ) : null}
      </div>
    </DialogFieldRow>
  </>
);
