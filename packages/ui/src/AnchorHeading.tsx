import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

import { cn } from "./lib/utils";

type AnchorHeadingProps = {
  anchorId: string;
  label: string;
  children: ReactNode;
  className?: string;
  copyButtonClassName?: string;
};

export const AnchorHeading = ({
  children,
  className = "",
  anchorId,
  label: _label,
  copyButtonClassName: _copyButtonClassName,
}: AnchorHeadingProps) => {
  // The UI-core wrapper intentionally preserves the old settings-card prop
  // shape even though the shared package does not own any copy-link button UI.
  // Existing callers still pass these values, so we keep them source-compatible
  // here until the app-specific anchor action is designed separately.
  const headingChild = isValidElement(children)
    ? (() => {
        const element = children as ReactElement<{ id?: string }>;

        if (element.props.id) {
          return element;
        }

        return cloneElement(element, { id: anchorId });
      })()
    : children;

  return (
    <div className={cn("gw-anchor-heading flex items-center gap-1.5", className)}>
      {headingChild}
    </div>
  );
};
