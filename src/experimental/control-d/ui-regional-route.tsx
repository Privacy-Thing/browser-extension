import type { ControlDMapping, ControlDProxyLocation } from "./contracts";

import { Button } from "@/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/components/ui/select";

const ruleCountLabel = (count: number): string =>
  `${count} ${count === 1 ? "rule" : "rules"}`;

const proxyLabel = (
  mapping: ControlDMapping,
  proxy: ControlDProxyLocation | undefined,
): string => {
  if (proxy) return `${proxy.city}, ${proxy.countryName}`;
  if (mapping.status === "skipped") return "Not synchronized";
  return "Control D exit unavailable";
};

const mappingDescription = (status: ControlDMapping["status"]): string => {
  if (status === "exact") {
    return "Automatically matched to the nearest exit in the same country.";
  }
  if (status === "approximate") {
    return "Nearest available exit. Review this route before applying.";
  }
  return "This regional profile is excluded from synchronization.";
};

type RouteProps = {
  busy: boolean;
  editing: boolean;
  mapping: ControlDMapping;
  proxies: readonly ControlDProxyLocation[];
  proxy: ControlDProxyLocation | undefined;
  onEditingChange: (editing: boolean) => void;
  onMappingChange: (mapping: ControlDMapping, proxyPk: string) => void;
};

export const ControlDRegionalRoute = ({
  busy,
  editing,
  mapping,
  proxies,
  proxy,
  onEditingChange,
  onMappingChange,
}: RouteProps) => {
  const label = mapping.locationLabel ?? mapping.locationId;
  const selectedProxyLabel = proxyLabel(mapping, proxy);
  let actionLabel = "Change";
  if (editing) actionLabel = "Cancel";
  else if (mapping.status === "skipped" || !proxy) actionLabel = "Choose exit";

  return (
    <div
      id={`control-d-route-${mapping.locationId}`}
      className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
    >
      <div className="grid gap-3 sm:grid-cols-2 sm:items-center">
        <div>
          <div className="font-medium text-foreground">{label}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {ruleCountLabel(mapping.ruleCount ?? 0)}
          </div>
        </div>
        {editing ? (
          <Select
            value={mapping.proxyPk ?? "skip"}
            onValueChange={(value) =>
              onMappingChange(mapping, value === "skip" ? "" : value)
            }
          >
            <SelectTrigger aria-label={`Choose Control D exit for ${label}`}>
              <SelectValue>{selectedProxyLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="skip">Do not synchronize</SelectItem>
              {proxies.map((availableProxy) => (
                <SelectItem key={availableProxy.pk} value={availableProxy.pk}>
                  {availableProxy.city}, {availableProxy.countryName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div>
            <div className="font-medium text-foreground">{selectedProxyLabel}</div>
            <div className="mt-0.5 text-xs leading-5 text-muted-foreground">
              {mappingDescription(mapping.status)}
            </div>
          </div>
        )}
      </div>
      <Button
        className="w-fit"
        type="button"
        size="sm"
        variant="ghost"
        disabled={busy}
        onClick={() => onEditingChange(!editing)}
      >
        {actionLabel}
      </Button>
    </div>
  );
};
