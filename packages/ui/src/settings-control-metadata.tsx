import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

const TITLE_BUTTON_STYLE = { font: "inherit" } as const;
const TITLE_BUTTON_CLASS =
  "min-w-0 max-w-full cursor-pointer rounded-sm text-left text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

type HeadingElement = ReactElement<{
  id?: string;
  children?: ReactNode;
}>;

const isHeadingElement = (value: ReactNode): value is HeadingElement =>
  isValidElement(value) &&
  typeof value.type === "string" &&
  /^h[1-6]$/.test(value.type);

export const getSettingTitleId = (anchorId?: string): string | undefined =>
  anchorId ? `${anchorId}__title` : undefined;

export const getSettingDescriptionId = (anchorId?: string): string | undefined =>
  anchorId ? `${anchorId}__description` : undefined;

export const getSettingHintId = (anchorId?: string): string | undefined =>
  anchorId ? `${anchorId}__hint` : undefined;

export const joinAriaIds = (
  ...ids: Array<string | false | null | undefined>
): string | undefined => {
  const filteredIds = ids.filter((id): id is string => Boolean(id));
  return filteredIds.length > 0 ? filteredIds.join(" ") : undefined;
};

export const renderSettingTitle = ({
  title,
  titleId,
  focusControlOnTitleClick,
  onTitleClick,
}: {
  title: ReactNode;
  titleId: string | undefined;
  focusControlOnTitleClick: boolean;
  onTitleClick: () => void;
}): ReactNode => {
  if (isHeadingElement(title)) {
    return cloneElement(
      title,
      titleId ? { id: titleId } : undefined,
      focusControlOnTitleClick ? (
        <button
          type="button"
          data-settings-focus-title="true"
          className={TITLE_BUTTON_CLASS}
          style={TITLE_BUTTON_STYLE}
          onClick={onTitleClick}
        >
          {title.props.children}
        </button>
      ) : (
        title.props.children
      ),
    );
  }

  if (!focusControlOnTitleClick) {
    return titleId ? <div id={titleId}>{title}</div> : title;
  }

  return (
    <button
      id={titleId}
      type="button"
      data-settings-focus-title="true"
      className={TITLE_BUTTON_CLASS}
      style={TITLE_BUTTON_STYLE}
      onClick={onTitleClick}
    >
      {title}
    </button>
  );
};
