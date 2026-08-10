import { type HTMLAttributes, type ReactNode, useCallback, useRef } from "react";

import { AnchorHeading } from "./AnchorHeading";
import { focusFirstSettingControl } from "./focus-first-setting-control";
import { cn } from "./lib/utils";
import {
  getSettingDescriptionId,
  getSettingTitleId,
  renderSettingTitle,
} from "./settings-control-metadata";
import { Card, CardContent } from "./ui/card";

type SettingsSectionCardProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  anchorId?: string;
  copyLabel?: string;
  title?: ReactNode;
  description?: ReactNode;
  headerActions?: ReactNode;
  highlighted?: boolean;
  contentClassName?: string;
  headerClassName?: string;
  descriptionClassName?: string;
  actionsClassName?: string;
  focusControlOnTitleClick?: boolean;
};

export const SettingsSectionCard = ({
  anchorId,
  copyLabel,
  title,
  description,
  headerActions,
  highlighted = false,
  className,
  contentClassName,
  headerClassName,
  descriptionClassName,
  actionsClassName,
  focusControlOnTitleClick = false,
  children,
  ...props
}: SettingsSectionCardProps) => {
  const actionsRef = useRef<HTMLDivElement>(null);
  const titleId = title ? getSettingTitleId(anchorId) : undefined;
  const descriptionId = description ? getSettingDescriptionId(anchorId) : undefined;
  const handleTitleClick = useCallback(() => {
    focusFirstSettingControl(actionsRef.current);
  }, []);

  const titleNode =
    title !== undefined
      ? renderSettingTitle({
          title,
          titleId,
          focusControlOnTitleClick,
          onTitleClick: handleTitleClick,
        })
      : undefined;

  const headerTitle =
    anchorId && copyLabel ? (
      <AnchorHeading anchorId={anchorId} label={copyLabel}>
        {titleNode}
      </AnchorHeading>
    ) : (
      titleNode
    );

  return (
    <Card
      id={anchorId}
      data-anchor-id={anchorId}
      className={cn(
        anchorId && "gw-anchor-target scroll-mt-7",
        highlighted && "gw-anchor-highlighted",
        className,
      )}
      {...props}
    >
      <CardContent className={cn("flex flex-col gap-5 pt-6", contentClassName)}>
        {title || description || headerActions ? (
          <div
            className={cn(
              "flex flex-wrap items-start justify-between gap-4",
              headerClassName,
            )}
          >
            <div className="min-w-0 flex-1">
              {headerTitle}
              {description ? (
                <div
                  id={descriptionId}
                  className={cn(
                    "mt-1 text-sm text-muted-foreground",
                    descriptionClassName,
                  )}
                >
                  {description}
                </div>
              ) : null}
            </div>
            {headerActions ? (
              <div
                ref={actionsRef}
                className={cn(
                  "flex shrink-0 flex-wrap items-center gap-2",
                  actionsClassName,
                )}
              >
                {headerActions}
              </div>
            ) : null}
          </div>
        ) : null}

        {children}
      </CardContent>
    </Card>
  );
};
