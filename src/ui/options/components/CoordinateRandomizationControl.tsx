import { useEffect, useState } from "react";

import { MAX_RANDOM_RADIUS_KM, MIN_RANDOM_RADIUS_KM } from "@/shared/settings-defaults";
import { cn } from "@/ui/components/lib/utils";
import { Input } from "@/ui/components/ui/input";
import { Switch } from "@/ui/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/components/ui/tooltip";
import { t } from "@/ui/i18n";

type RandomizeControlProps = {
  id: string;
  checked: boolean;
  radiusKm: number;
  disabled?: boolean;
  compact?: boolean;
  onCheckedChange: (checked: boolean) => void;
  onRadiusKmChange: (radiusKm: number) => void;
};

const clampRadiusKm = (value: number): number =>
  Math.min(Math.max(value, MIN_RANDOM_RADIUS_KM), MAX_RANDOM_RADIUS_KM);

export const RandomizationControl = ({
  id,
  checked,
  radiusKm,
  disabled = false,
  compact = false,
  onCheckedChange,
  onRadiusKmChange,
}: RandomizeControlProps) => {
  const inputId = `${id}-radius`;
  const labelId = `${id}-label`;
  const [draftRadius, setDraftRadius] = useState(String(radiusKm));

  useEffect(() => {
    setDraftRadius(String(radiusKm));
  }, [radiusKm]);

  const commitDraft = (value: string): void => {
    const parsed = Number.parseInt(value, 10);
    const nextRadius = clampRadiusKm(Number.isFinite(parsed) ? parsed : radiusKm);
    setDraftRadius(String(nextRadius));
    if (nextRadius !== radiusKm) {
      onRadiusKmChange(nextRadius);
    }
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div
          id={labelId}
          className={cn(
            "flex flex-wrap items-center gap-x-1.5 gap-y-1 font-medium leading-8",
            compact ? "text-sm" : "text-base",
          )}
        >
          <span>{t.common.coordinateRandomization.labelBefore}</span>
          <Input
            id={inputId}
            aria-label={t.common.coordinateRandomization.radiusInputLabel}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={2}
            value={draftRadius}
            disabled={disabled || !checked}
            className="h-8 w-14 px-2 text-center"
            onChange={(event) => {
              const nextDraft = event.currentTarget.value
                .replace(/\D/g, "")
                .slice(0, 2);
              setDraftRadius(nextDraft);
              if (nextDraft) {
                onRadiusKmChange(clampRadiusKm(Number.parseInt(nextDraft, 10)));
              }
            }}
            onBlur={() => commitDraft(draftRadius)}
          />
          <span>{t.common.coordinateRandomization.labelAfter}</span>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                >
                  {t.common.coordinateRandomization.readWhy}
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-80 px-3 py-2 text-xs leading-relaxed">
                <p>{t.common.coordinateRandomization.tooltipPrivacy}</p>
                <p className="mt-2">{t.common.coordinateRandomization.tooltipExact}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <Switch
        id={id}
        aria-labelledby={labelId}
        checked={checked}
        disabled={disabled}
        className="mt-1 shrink-0"
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
};
