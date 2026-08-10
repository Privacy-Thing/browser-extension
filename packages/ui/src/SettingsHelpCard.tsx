import { type HTMLAttributes, useState } from "react";

import { AnchorHeading } from "./AnchorHeading";
import { cn } from "./lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type SettingsHelpCardProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  anchorId?: string;
  copyLabel?: string;
  title: string;
  highlighted?: boolean;
  contentClassName?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
};

export const SettingsHelpCard = ({
  anchorId,
  copyLabel,
  title,
  highlighted = false,
  className,
  contentClassName,
  collapsible = false,
  defaultOpen = true,
  children,
  ...props
}: SettingsHelpCardProps) => {
  const [open, setOpen] = useState(defaultOpen);

  const titleNode =
    anchorId && copyLabel ? (
      <AnchorHeading
        anchorId={anchorId}
        label={copyLabel}
        copyButtonClassName="text-tone-success-text/70 hover:text-tone-success-text focus-visible:text-tone-success-text"
      >
        <CardTitle className="text-tone-success-text">{title}</CardTitle>
      </AnchorHeading>
    ) : (
      <CardTitle className="text-tone-success-text">{title}</CardTitle>
    );

  const endcap = (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-tone-success-border/80 bg-background/70 text-lg font-semibold leading-none text-tone-success-text shadow-sm backdrop-blur-[2px]"
      >
        ?
      </span>
      {collapsible ? (
        <span
          aria-hidden="true"
          className="shrink-0 text-tone-success-text/80 transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      ) : null}
    </div>
  );

  return (
    <Card
      id={anchorId}
      data-anchor-id={anchorId}
      className={cn(
        anchorId && "gw-anchor-target scroll-mt-7",
        "relative overflow-hidden border-tone-success-border bg-gradient-to-b from-tone-success-bg via-tone-success-bg/45 to-transparent text-tone-success-text",
        highlighted && "gw-anchor-highlighted",
        className,
      )}
      {...props}
    >
      <CardHeader>
        {collapsible ? (
          <button
            type="button"
            className="flex w-full items-center justify-between gap-4 text-left"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            <div className="min-w-0 flex-1">{titleNode}</div>
            {endcap}
          </button>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">{titleNode}</div>
            {endcap}
          </div>
        )}
      </CardHeader>
      {!collapsible || open ? (
        <CardContent
          className={cn(
            "flex flex-col gap-3 pb-4 text-sm text-tone-success-text/90",
            contentClassName,
          )}
        >
          {children}
        </CardContent>
      ) : null}
    </Card>
  );
};
