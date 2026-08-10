import { type HTMLAttributes, type ReactNode, useCallback, useRef } from "react";

import { focusFirstSettingControl } from "./focus-first-setting-control";
import { cn } from "./lib/utils";
import {
  getSettingDescriptionId,
  getSettingTitleId,
  renderSettingTitle,
} from "./settings-control-metadata";

type SettingsSubcardProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  anchorId?: string;
  copyLabel?: string;
  title: ReactNode;
  description?: ReactNode;
  highlighted?: boolean;
  action?: ReactNode;
  contentClassName?: string;
  descriptionClassName?: string;
  actionClassName?: string;
  focusControlOnTitleClick?: boolean;
};

export const SettingsSubcard = ({
  anchorId,
  copyLabel: _copyLabel,
  title,
  description,
  highlighted = false,
  action,
  className,
  contentClassName,
  descriptionClassName,
  actionClassName,
  focusControlOnTitleClick = false,
  children,
  ...props
}: SettingsSubcardProps) => {
  const actionRef = useRef<HTMLDivElement>(null);
  const childrenRef = useRef<HTMLDivElement>(null);
  const titleId = getSettingTitleId(anchorId);
  const descriptionId = description ? getSettingDescriptionId(anchorId) : undefined;
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
    <div
      id={anchorId}
      data-anchor-id={anchorId}
      className={cn(
        "gw-anchor-target scroll-mt-7 flex items-start gap-2 text-sm text-muted-foreground",
        highlighted && "gw-anchor-highlighted",
        className,
      )}
      {...props}
    >
      {action ? (
        <div ref={actionRef} className={cn("mt-0.5 shrink-0", actionClassName)}>
          {action}
        </div>
      ) : null}
      <div className={cn("min-w-0 flex-1", contentClassName)}>
        {headerTitle}
        {description ? (
          <div
            id={descriptionId}
            className={cn(
              "mt-1 text-xs leading-5 text-muted-foreground",
              descriptionClassName,
            )}
          >
            {description}
          </div>
        ) : null}
        {children ? (
          <div ref={childrenRef} className="mt-3">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
};
