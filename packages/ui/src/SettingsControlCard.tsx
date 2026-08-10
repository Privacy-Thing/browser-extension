import { type HTMLAttributes, type ReactNode, useCallback, useRef } from "react";

import { AnchorHeading } from "./AnchorHeading";
import { focusFirstSettingControl } from "./focus-first-setting-control";
import { cn } from "./lib/utils";
import {
  getSettingDescriptionId,
  getSettingHintId,
  getSettingTitleId,
  renderSettingTitle,
} from "./settings-control-metadata";
import { Card, CardContent } from "./ui/card";

type SettingsControlCardProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  anchorId?: string;
  copyLabel?: string;
  title: ReactNode;
  description?: ReactNode;
  hint?: ReactNode;
  highlighted?: boolean;
  action?: ReactNode;
  contentClassName?: string;
  headerClassName?: string;
  descriptionClassName?: string;
  hintClassName?: string;
  actionClassName?: string;
  focusControlOnTitleClick?: boolean;
};

export const SettingsControlCard = ({
  anchorId,
  copyLabel,
  title,
  description,
  hint,
  highlighted = false,
  action,
  className,
  contentClassName,
  headerClassName,
  descriptionClassName,
  hintClassName,
  actionClassName,
  focusControlOnTitleClick = false,
  children,
  ...props
}: SettingsControlCardProps) => {
  const actionRef = useRef<HTMLDivElement>(null);
  const childrenRef = useRef<HTMLDivElement>(null);
  const titleId = getSettingTitleId(anchorId);
  const descriptionId = description ? getSettingDescriptionId(anchorId) : undefined;
  const hintId = hint ? getSettingHintId(anchorId) : undefined;
  const handleTitleClick = useCallback(() => {
    focusFirstSettingControl(actionRef.current, childrenRef.current);
  }, []);

  const headerTitle = renderSettingTitle({
    title,
    titleId,
    focusControlOnTitleClick,
    onTitleClick: handleTitleClick,
  });

  return (
    <Card
      id={anchorId}
      data-anchor-id={anchorId}
      className={cn(
        "border-dashed border-transparent gw-anchor-target scroll-mt-7",
        highlighted && "gw-anchor-highlighted",
        className,
      )}
      {...props}
    >
      <CardContent
        className={cn(children ? "flex flex-col gap-4 pt-4" : "pt-4", contentClassName)}
      >
        <div
          className={cn(
            "flex flex-wrap items-start justify-between gap-4 sm:flex-nowrap",
            headerClassName,
          )}
        >
          <div className="min-w-0 flex-1">
            {anchorId && copyLabel ? (
              <AnchorHeading anchorId={anchorId} label={copyLabel}>
                {headerTitle}
              </AnchorHeading>
            ) : (
              headerTitle
            )}
            {description ? (
              <div
                id={descriptionId}
                className={cn(
                  "mt-0.5 text-sm text-muted-foreground",
                  descriptionClassName,
                )}
              >
                {description}
              </div>
            ) : null}
            {hint ? (
              <div id={hintId} className={cn("mt-1.5 text-sm", hintClassName)}>
                {hint}
              </div>
            ) : null}
          </div>
          {action ? (
            <div
              ref={actionRef}
              className={cn("w-full shrink-0 sm:w-auto", actionClassName)}
            >
              {action}
            </div>
          ) : null}
        </div>

        {children ? <div ref={childrenRef}>{children}</div> : null}
      </CardContent>
    </Card>
  );
};
