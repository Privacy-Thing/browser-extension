import { useState } from "react";

import { t } from "@/ui/i18n";

type XRayRowProps = {
  label: React.ReactNode;
  value: string | null | undefined;
};

export const XRayValueRow = ({ label, value }: XRayRowProps) => {
  if (value === null || value === undefined) return null;

  return (
    <div className="flex justify-between gap-2 py-1 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs text-right font-mono truncate max-w-[55%]">{value}</span>
    </div>
  );
};

export const XRayExpandableValueRow = ({ label, value }: XRayRowProps) => {
  const [expanded, setExpanded] = useState(false);
  if (value === null || value === undefined) return null;

  return (
    <div className="py-1 border-b border-border/30 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-muted-foreground shrink-0 pt-px">{label}</span>
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex items-start gap-1 min-w-0 text-foreground/90 hover:text-foreground transition-colors cursor-pointer"
          title={expanded ? t.sidebar.surfaces.collapse : t.sidebar.surfaces.expand}
        >
          <span
            className={`text-xs font-mono text-right${expanded ? " break-all" : " truncate max-w-[160px]"}`}
          >
            {value}
          </span>
          <i
            className={`fa-solid ${expanded ? "fa-chevron-up" : "fa-chevron-down"} text-[9px] text-muted-foreground shrink-0 mt-[3px]`}
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  );
};

export const XRayExpandableGroupRow = ({
  label,
  value,
  children,
}: XRayRowProps & { children: React.ReactNode }) => {
  const [expanded, setExpanded] = useState(false);
  if (value === null || value === undefined) return null;

  return (
    <>
      <div className="py-1 border-b border-border/30">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs text-muted-foreground shrink-0 pt-px">{label}</span>
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="flex items-start gap-1 min-w-0 text-foreground/90 hover:text-foreground transition-colors cursor-pointer"
            title={expanded ? t.sidebar.surfaces.collapse : t.sidebar.surfaces.expand}
          >
            <span
              className={`text-xs font-mono text-right${expanded ? " break-all" : " truncate max-w-[160px]"}`}
            >
              {value}
            </span>
            <i
              className={`fa-solid ${expanded ? "fa-chevron-up" : "fa-chevron-down"} text-[9px] text-muted-foreground shrink-0 mt-[3px]`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
      {expanded ? children : null}
    </>
  );
};

export const XRayStatusDot = ({
  className,
  label,
}: {
  className: string;
  label?: string;
}) => (
  <span
    className={`w-2 h-2 rounded-full shrink-0 ${className}`}
    role={label ? "img" : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
  />
);
