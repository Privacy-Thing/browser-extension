import { PopupButton } from "./PopupButton";

type PopupIconButtonProps = {
  id?: string;
  title?: string;
  ariaLabel: string;
  onClick?: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  className?: string;
  iconClassName?: string;
};

export const PopupIconButton = ({
  id,
  title,
  ariaLabel,
  onClick,
  disabled = false,
  icon,
  className,
  iconClassName,
}: PopupIconButtonProps) => (
  <PopupButton
    id={id}
    type="button"
    title={title}
    aria-label={ariaLabel}
    disabled={disabled}
    onClick={onClick}
    variant="secondary"
    size="icon"
    className={["gw-popup-icon-button", className].filter(Boolean).join(" ")}
  >
    <span className={["gw-popup-icon", iconClassName].filter(Boolean).join(" ")}>
      {icon}
    </span>
  </PopupButton>
);
